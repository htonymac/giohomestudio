// One-shot repair: find characters whose visualDescription says "fair skin" / "light tan"
// despite their NAMES or STORY context implying Black/Latina/etc. — and patch them.
// Also lists every character so we can see what's broken.

async function main() {
  console.log("=== Fetching all character voices ===");
  const res = await fetch("http://localhost:3200/api/character-voices");
  if (!res.ok) {
    console.error(`Failed to list: ${res.status}`);
    return;
  }
  const data = await res.json();
  const voices = data.voices || data || [];
  console.log(`Total characters in DB: ${voices.length}`);

  const broken = [];
  for (const v of voices) {
    const desc = (v.visualDescription || "").toLowerCase();
    const looksLight = /\b(fair|pale|light\s+tan|caucasian|white\s+skin|light\s+skin|peach)\b/.test(desc);
    if (looksLight) {
      broken.push(v);
    }
  }

  console.log(`\n=== Characters with white/fair-skin descriptions: ${broken.length} ===`);
  for (const v of broken) {
    console.log(`\n  ${v.name} (${v.id})`);
    console.log(`    characterId: ${v.characterId}`);
    console.log(`    age: ${v.age}`);
    console.log(`    visualDescription: "${v.visualDescription}"`);
  }

  if (broken.length === 0) {
    console.log("\n✓ No broken characters found. Already fixed?");
    return;
  }

  console.log("\n=== Run with --fix to delete + re-extract recommendation ===");
  if (process.argv.includes("--fix")) {
    console.log("\n⚠ Deleting all broken characters...");
    for (const v of broken) {
      try {
        const delRes = await fetch(`http://localhost:3200/api/character-voices/${v.id}`, { method: "DELETE" });
        if (delRes.ok) {
          console.log(`  ✓ deleted ${v.name}`);
        } else {
          console.log(`  ✗ failed to delete ${v.name}: ${delRes.status}`);
        }
      } catch (e) {
        console.log(`  ✗ error deleting ${v.name}: ${e.message}`);
      }
    }
    console.log("\n✓ Done. Go to your project → Story tab → click 'Make Characters' to re-extract with the new prompt.");
  } else {
    console.log("\nDry run only. To actually delete, re-run with: node tests/fix-broken-characters.mjs --fix");
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
