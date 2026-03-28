// Phase 1 — review flow test (approve + reject)
// Run: npx tsx --env-file=.env scripts/test-review.ts

import { approveContent, rejectContent, getPendingReviewItems } from "../src/modules/review";
import { runPipeline } from "../src/core/pipeline";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("\n=== GioHomeStudio — Review Flow Test ===\n");

  // ── Find or create an IN_REVIEW item for approve test ──────
  let reviewItems = await getPendingReviewItems();
  console.log(`Items IN_REVIEW: ${reviewItems.length}`);

  if (reviewItems.length === 0) {
    console.log("No IN_REVIEW items — running pipeline to create one...");
    await runPipeline({ rawInput: "Review test: a lighthouse at dusk", durationSeconds: 5 });
    reviewItems = await getPendingReviewItems();
  }

  const approveTarget = reviewItems[0];
  console.log(`\n── TEST 1: APPROVE ──────────────────`);
  console.log(`Target: ${approveTarget.id} (${approveTarget.status})`);

  const approveResult = await approveContent(approveTarget.id, "Looks great, approved in Phase 1 test");
  console.log("approveContent result:", approveResult);

  const afterApprove = await prisma.contentItem.findUnique({
    where: { id: approveTarget.id },
    select: { status: true, approvedAt: true, notes: true },
  });
  console.log("DB after approve:", JSON.stringify(afterApprove, null, 2));

  const approveActions = await prisma.reviewAction.findMany({
    where: { contentItemId: approveTarget.id },
    select: { action: true, reviewerNote: true, createdAt: true },
  });
  console.log("ReviewActions:", JSON.stringify(approveActions, null, 2));

  // ── Create a second item for reject test ───────────────────
  console.log(`\n── TEST 2: REJECT ───────────────────`);
  console.log("Running pipeline for reject target...");
  const pipelineResult = await runPipeline({
    rawInput: "Review test: a city skyline at night with neon lights",
    durationSeconds: 5,
    musicMood: "epic",
  });
  console.log(`Reject target contentItemId: ${pipelineResult.contentItemId} (${pipelineResult.status})`);

  if (pipelineResult.status !== "review_pending") {
    console.error("Pipeline did not reach IN_REVIEW — cannot test reject");
  } else {
    const rejectResult = await rejectContent(
      pipelineResult.contentItemId,
      "Wrong mood — needs more dramatic lighting"
    );
    console.log("rejectContent result:", rejectResult);

    const afterReject = await prisma.contentItem.findUnique({
      where: { id: pipelineResult.contentItemId },
      select: { status: true, rejectedAt: true, notes: true },
    });
    console.log("DB after reject:", JSON.stringify(afterReject, null, 2));

    const rejectActions = await prisma.reviewAction.findMany({
      where: { contentItemId: pipelineResult.contentItemId },
      select: { action: true, reviewerNote: true, createdAt: true },
    });
    console.log("ReviewActions:", JSON.stringify(rejectActions, null, 2));

    const versions = await prisma.contentVersion.findMany({
      where: { contentItemId: pipelineResult.contentItemId },
      select: { versionNumber: true, status: true, reason: true },
    });
    console.log("Versions after reject:", JSON.stringify(versions, null, 2));
  }

  // ── Final registry state ───────────────────────────────────
  console.log(`\n── FINAL REGISTRY STATE ─────────────`);
  const all = await prisma.contentItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, status: true, videoProvider: true, createdAt: true },
  });
  console.log(JSON.stringify(all, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
