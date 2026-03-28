// Phase 1 — end-to-end pipeline test
// Run: npx tsx scripts/test-pipeline.ts

import { runPipeline } from "../src/core/pipeline";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("\n=== GioHomeStudio — Pipeline E2E Test ===\n");

  const result = await runPipeline({
    rawInput: "A golden sunrise over a calm ocean, waves gently breaking on the shore",
    durationSeconds: 5,
    musicMood: "calm",
    aspectRatio: "9:16",
  });

  console.log("\n=== Pipeline Result ===");
  console.log(JSON.stringify(result, null, 2));

  // Show all job records for this content item
  const jobs = await prisma.job.findMany({
    where: { contentItemId: result.contentItemId },
    orderBy: { createdAt: "asc" },
    select: { type: true, status: true, providerUsed: true, error: true },
  });

  console.log("\n=== Job Steps ===");
  for (const job of jobs) {
    const icon = job.status === "COMPLETED" ? "✓" : job.status === "FAILED" ? "✗" : "~";
    console.log(`  ${icon} ${job.type.padEnd(16)} ${job.status.padEnd(10)} provider=${job.providerUsed ?? "—"}${job.error ? ` error=${job.error}` : ""}`);
  }

  // Final content item state
  const item = await prisma.contentItem.findUnique({
    where: { id: result.contentItemId },
    select: { status: true, notes: true, videoProvider: true, voiceProvider: true, musicProvider: true },
  });

  console.log("\n=== Final DB State ===");
  console.log(JSON.stringify(item, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
