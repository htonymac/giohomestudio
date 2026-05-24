// Orchestrator — v2 alternative supervisor pipeline.
//
// Wave 4 Phase A (2026-05-23) — IMPORTANT CONTEXT:
// The existing `/api/story/supervise` (calls runFullStoryQCPipeline from
// src/lib/story-supervisors/, 4549 LOC across 23 supervisor implementations) is the
// CURRENT production supervisor pipeline. It IS wired into the hybrid planner.
//
// This new /api/story-qc/run is a v2 alternative with cleaner contracts:
//   - typed SupervisorInput / SupervisorReport / OrchestratorPlan / OrchestratorResult
//   - topological dep ordering with cascade-skip on blocking dep failure
//   - per-tier timeout (FIX 8 — 12s/25s/60s for fast/smart/premium)
//   - plan-only mode for cost/coverage preview
//   - persists to StorySupervisorReport Prisma model
//
// NOT YET WIRED into any planner. To migrate Hybrid → use this:
//   - hybrid-planner page.tsx line ~1534 currently calls `/api/story/supervise`
//   - swap to `/api/story-qc/run` after we wrap the existing supervisor implementations
//     as registry entries (TODO: replace placeholder prompts with calls to runStoryScreening,
//     generateCastBible, runCultureCheck, etc. from src/lib/story-supervisors/)
//
// Until that wrapping is done, this orchestrator runs ITS OWN simple supervisor prompts
// (defined in registry.ts) which are placeholder — DO NOT use in production. Use
// /api/story/supervise for real supervisor work.

import { prisma } from "@/lib/prisma";
import { callLLM, type LLMRole } from "@/lib/llm";
import type {
  SupervisorInput,
  SupervisorName,
  SupervisorReport,
  OrchestratorPlan,
  OrchestratorResult,
} from "./types";
import { SUPERVISORS, allSupervisors } from "./registry";

/** Per-tier LLM call timeout — FIX 8 of 2026-05-22 plan (8s per provider, scaled by tier). */
const TIER_TIMEOUT_MS: Record<string, number> = {
  fast: 12000,
  smart: 25000,
  premium: 60000,
};

// Map our internal tier names → actual LLMRole values supported by callLLM.
const TIER_MODEL: Record<string, LLMRole> = {
  fast: "fast",
  smart: "supervisor",
  premium: "quality",
};

/** Build the execution plan: which supervisors to run, in what order, what's skipped. */
export function buildPlan(input: SupervisorInput, requested?: SupervisorName[]): OrchestratorPlan {
  const candidates = requested
    ? requested.map(n => SUPERVISORS[n]).filter(Boolean)
    : allSupervisors();

  const skipped: Array<{ name: SupervisorName; reason: string }> = [];
  const eligible = candidates.filter(s => {
    // Check required inputs present + non-empty
    const missing = s.requires.filter(r => {
      const v = input[r];
      if (v === undefined || v === null) return true;
      if (Array.isArray(v) && v.length === 0) return true;
      if (typeof v === "string" && v.trim().length === 0) return true;
      return false;
    });
    if (missing.length > 0) {
      skipped.push({ name: s.name, reason: `missing inputs: ${missing.join(", ")}` });
      return false;
    }
    // Custom skip predicate
    if (s.shouldSkip) {
      const reason = s.shouldSkip(input);
      if (reason) {
        skipped.push({ name: s.name, reason });
        return false;
      }
    }
    return true;
  });

  // Topological sort by dependsOn
  const ordered: SupervisorName[] = [];
  const visited = new Set<SupervisorName>();
  function visit(name: SupervisorName) {
    if (visited.has(name)) return;
    const def = SUPERVISORS[name];
    if (!def || !eligible.includes(def)) return; // skip ineligible deps
    visited.add(name);
    for (const dep of def.dependsOn ?? []) visit(dep);
    ordered.push(name);
  }
  for (const s of eligible) visit(s.name);

  // Cost estimate (~$0.001 per fast supervisor, $0.005 per smart, $0.02 per premium)
  const tierCost = { fast: 0.001, smart: 0.005, premium: 0.02 } as const;
  const estimatedCostUsd = ordered.reduce((sum, name) => sum + (tierCost[SUPERVISORS[name].tier] ?? 0.001), 0);

  return { toRun: ordered, skipped, estimatedCostUsd };
}

/** Run a single supervisor — returns a typed report, never throws. */
async function runOne(name: SupervisorName, input: SupervisorInput): Promise<SupervisorReport> {
  const def = SUPERVISORS[name];
  const t0 = Date.now();
  if (!def) {
    return {
      supervisorName: name,
      passed: false,
      score: 0,
      blockingIssues: [`Unknown supervisor: ${name}`],
      warnings: [],
      suggestedFixes: [],
      runAt: new Date().toISOString(),
      durationMs: 0,
    };
  }
  try {
    const { system, user } = def.buildPrompt(input);
    // FIX 8: per-tier timeout — caps cascading hang
    const role = TIER_MODEL[def.tier] ?? "fast";
    const timeoutMs = TIER_TIMEOUT_MS[def.tier] ?? 12000;
    const llmResult = await callLLM(user, system, { role, maxTokens: 1200, temperature: 0.3, timeoutMs });
    const rawText = typeof llmResult === "string" ? llmResult : (llmResult as { content?: string }).content ?? String(llmResult);
    const parsed = def.parse(rawText, input);
    return {
      supervisorName: name,
      ...parsed,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      modelUsed: role,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Soft fail — non-blocking warning. Blocking supervisors that error STILL block via overallPassed.
    return {
      supervisorName: name,
      passed: false,
      score: 0,
      blockingIssues: def.blocking ? [`Supervisor ${name} errored: ${msg.slice(0, 200)}`] : [],
      warnings: def.blocking ? [] : [`Supervisor ${name} errored (non-blocking): ${msg.slice(0, 200)}`],
      suggestedFixes: [],
      runAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
    };
  }
}

/** Run all supervisors in the plan with dep ordering + within-tier parallelism. */
export async function runOrchestrator(input: SupervisorInput, requested?: SupervisorName[]): Promise<OrchestratorResult> {
  const tStart = Date.now();
  const plan = buildPlan(input, requested);
  const reports: SupervisorReport[] = [];

  // Simple sequential execution for now — dep-correct.
  // TODO Phase 4 polish: group by "no remaining deps" and run those groups in Promise.all batches.
  for (const name of plan.toRun) {
    const def = SUPERVISORS[name];
    // If any of MY blocking deps already failed, skip ME (cascade)
    const blockedByDep = (def.dependsOn ?? []).some(depName => {
      const depReport = reports.find(r => r.supervisorName === depName);
      if (!depReport) return false;
      const depDef = SUPERVISORS[depName];
      return depDef?.blocking === true && depReport.passed === false;
    });
    if (blockedByDep) {
      reports.push({
        supervisorName: name,
        passed: false,
        score: 0,
        blockingIssues: [],
        warnings: [`Skipped — blocking dependency failed`],
        suggestedFixes: [],
        runAt: new Date().toISOString(),
        durationMs: 0,
      });
      continue;
    }
    const report = await runOne(name, input);
    reports.push(report);
  }

  // Aggregate
  const overallPassed = reports.every(r => {
    const def = SUPERVISORS[r.supervisorName];
    return !def?.blocking || r.passed;
  });
  const blockingIssues = reports.flatMap(r => r.blockingIssues);
  const warnings = reports.flatMap(r => r.warnings);
  const suggestedFixes = reports.flatMap(r => r.suggestedFixes);

  const result: OrchestratorResult = {
    projectId: input.projectId,
    draftHash: input.draftHash ?? "",
    plan,
    reports,
    overallPassed,
    blockingIssues,
    warnings,
    suggestedFixes,
    ranAt: new Date().toISOString(),
    totalDurationMs: Date.now() - tStart,
  };

  // Persist reports (best-effort — don't fail orchestration if DB write fails)
  try {
    await prisma.storySupervisorReport.createMany({
      // Prisma JSON columns want `InputJsonValue` — cast through unknown so structurally-OK
      // plain objects are accepted without bringing every supervisor schema into the type.
      data: reports.map(r => ({
        projectId: input.projectId,
        supervisorName: r.supervisorName,
        passed: r.passed,
        score: r.score,
        blockingIssues: r.blockingIssues as unknown as object,
        warnings: r.warnings as unknown as object,
        suggestedFixes: r.suggestedFixes as unknown as object,
        revisedData: (r.revisedData ?? undefined) as unknown as object | undefined,
        runAt: new Date(r.runAt),
      })),
      skipDuplicates: false,
    });
  } catch (dbErr) {
    console.warn("[story-qc] Failed to persist reports:", dbErr instanceof Error ? dbErr.message : dbErr);
  }

  return result;
}
