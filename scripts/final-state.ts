import { prisma } from "../src/lib/prisma";

async function main() {
  const items = await prisma.contentItem.findMany({
    orderBy: { createdAt: "desc" }, take: 6,
    select: { id: true, status: true, durationSeconds: true, videoProvider: true, voiceProvider: true, musicProvider: true, musicPath: true }
  });

  console.log("=== Final Registry State ===");
  for (const i of items) {
    const music = i.musicPath ? "YES " + (i.musicPath.split("\\").pop() ?? i.musicPath) : "NO";
    console.log(
      `  ${i.id.slice(0, 8)} [${i.status.padEnd(9)}] dur=${String(i.durationSeconds ?? "-").padEnd(3)}` +
      ` vid=${(i.videoProvider ?? "-").padEnd(10)} voice=${(i.voiceProvider ?? "-").padEnd(11)} music=${music}`
    );
  }
  await prisma.$disconnect();
}
main();
