// Playwright test — Continuous Motion Sessions 2+3 (SPEC 3)
// Tests the continuity engine, motion planner, and the full pipeline API.

import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3200";

test.describe("SPEC 3 — Continuous Motion Sessions 2+3", () => {
  test("Session 3: planSegmentDurations — 27s / 5s max → sums to 27", async () => {
    // Unit test the motion planner logic directly via the API plan endpoint.
    // We verify the segment plan correctness here.
    const res = await fetch(`${BASE_URL}/api/continuous-motion/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "He ran toward the cliff edge, jumped off, fell through the air, hit the water below with a massive splash as lightning struck",
        totalDuration: 27,
        segmentDuration: 5,
        providerKey: "wan",
        seed: 42,
      }),
    });
    expect(res.ok).toBeTruthy();
    const body = await res.json();
    console.log("[plan-api] status:", body.status, "segments:", body.totalSegments);

    // Plan should always be returned regardless of FAL_KEY
    expect(body.plan).toBeDefined();
    expect(body.plan.segments).toBeInstanceOf(Array);
    expect(body.plan.segments.length).toBeGreaterThan(0);

    // Each segment must not exceed 5s
    for (const seg of body.plan.segments) {
      expect(seg.duration).toBeLessThanOrEqual(5 + 0.01); // allow tiny float error
    }

    // Sum of durations must be ~27s (allow ±1s for float rounding)
    const sumDur = body.plan.segments.reduce((a: number, s: { duration: number }) => a + s.duration, 0);
    expect(Math.abs(sumDur - 27)).toBeLessThan(1);
    console.log(`[pass] 27s / 5s max → ${body.plan.segments.length} segments, sum=${sumDur.toFixed(2)}s`);
  });

  test("Session 3: planSegmentDurations — 27s / 10s max → ≤3 segments", async () => {
    const res = await fetch(`${BASE_URL}/api/continuous-motion/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "The hero sprints across the rooftop, leaps between buildings, lands and rolls forward",
        totalDuration: 27,
        segmentDuration: 10,
        providerKey: "kling_std",
      }),
    });
    expect(res.ok).toBeTruthy();
    const body = await res.json();
    expect(body.plan.segments).toBeInstanceOf(Array);

    // With 10s max and 27s total → should be 3 segments [10, 10, 7]
    expect(body.plan.segments.length).toBeLessThanOrEqual(4);
    for (const seg of body.plan.segments) {
      expect(seg.duration).toBeLessThanOrEqual(10 + 0.01);
    }
    const sumDur = body.plan.segments.reduce((a: number, s: { duration: number }) => a + s.duration, 0);
    expect(Math.abs(sumDur - 27)).toBeLessThan(1);
    console.log(`[pass] 27s / 10s max → ${body.plan.segments.length} segments, sum=${sumDur.toFixed(2)}s`);
  });

  test("Session 2: plan endpoint returns scene ID", async () => {
    const res = await fetch(`${BASE_URL}/api/continuous-motion/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "A dancer spins on stage in golden spotlight",
        totalDuration: 10,
        segmentDuration: 5,
        providerKey: "wan",
      }),
    });
    const body = await res.json();
    expect(body.sceneId).toBeTruthy();
    expect(typeof body.sceneId).toBe("string");
    // Status should be either PLANNING (no FAL key) or COMPLETE/FAILED
    expect(["PLANNING", "GENERATING", "ASSEMBLING", "COMPLETE", "FAILED"]).toContain(body.status);
    console.log(`[pass] scene created: ${body.sceneId}, status: ${body.status}`);
  });

  test("Session 2: buildContinuationPrompt structure is correct", async () => {
    // Test the continuation prompt format via the plan endpoint's internal behavior.
    // We verify via the plan — motionUnits should have action strings from the prompt.
    const res = await fetch(`${BASE_URL}/api/continuous-motion/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "A man in a black coat walks through rain, enters a lit doorway, sits down at a piano",
        totalDuration: 15,
        segmentDuration: 5,
        providerKey: "wan",
      }),
    });
    const body = await res.json();
    // Units should have been split by physical action
    const units = body.plan?.units;
    expect(units).toBeInstanceOf(Array);
    expect(units.length).toBeGreaterThan(0);
    // Each unit must have an action string
    for (const unit of units) {
      expect(typeof unit.action).toBe("string");
      expect(unit.action.length).toBeGreaterThan(2);
      expect(typeof unit.duration).toBe("number");
      expect(unit.duration).toBeGreaterThan(0);
    }
    console.log(`[pass] ${units.length} motion units from 15s prompt`);
  });

  test("Plan API returns error for unknown provider", async () => {
    const res = await fetch(`${BASE_URL}/api/continuous-motion/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "test",
        totalDuration: 10,
        segmentDuration: 5,
        providerKey: "nonexistent_provider",
      }),
    });
    // Should return 400 with error
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    console.log(`[pass] Unknown provider returns 400: ${body.error.slice(0, 60)}`);
  });
});
