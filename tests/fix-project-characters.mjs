// One-shot repair for the Twins Guns Hybrid Project — finds Marcus/Dante/Rivera
// in saved project state and patches their colorDescription so they stop generating
// as white. Code-side fixes can't touch already-stored data; this directly edits the
// project JSON in hybrid_saved_states.

const BASE = "http://localhost:3200";

// Mappings: name patterns → corrected color/skin tone description
const SKIN_PATCHES = [
  { match: /^MARCUS\b/i, color: "dark brown skin, African-American features, melanated", species: "human" },
  { match: /^DANTE\b/i,  color: "dark brown skin, African-American features, melanated", species: "human" },
  { match: /\bRIVERA\b/i, color: "olive-brown Latina skin, Hispanic features, dark hair, dark eyes", species: "human" },
];

async function main() {
  console.log("=== Listing all projects ===");
  const listRes = await fetch(`${BASE}/api/hybrid/saved-state?list=true`);
  const listData = await listRes.json();
  const projects = listData.projects || listData || [];
  console.log(`Found ${projects.length} projects`);

  // Find Twins Guns project (or any with Marcus Cole)
  const candidates = projects.filter(p => {
    const title = (p.projectTitle || p.title || "").toLowerCase();
    return title.includes("twin") || title.includes("guns") || title.includes("hybrid");
  });

  console.log(`\nCandidate projects (twin/guns/hybrid in title): ${candidates.length}`);
  for (const c of candidates.slice(0, 10)) {
    console.log(`  ${c.id} → "${c.title || "(no title)"}" — ${c.sceneCount || 0} scenes, ${c.characterCount || 0} chars`);
  }

  let target = null;
  // Try to find the one with Marcus or Dante
  for (const p of projects) {
    const r = await fetch(`${BASE}/api/hybrid/saved-state?localId=${encodeURIComponent(p.id)}`);
    if (!r.ok) continue;
    const d = await r.json();
    if (!d.found || !d.data) continue;
    const chars = d.data.characters || [];
    const hasMarcus = chars.some(c => /MARCUS/i.test(c.displayName || c.name || ""));
    const hasDante = chars.some(c => /DANTE/i.test(c.displayName || c.name || ""));
    if (hasMarcus || hasDante) {
      target = { localId: p.id, data: d.data };
      console.log(`\n✓ Found project with Marcus/Dante: ${p.id}`);
      console.log(`  title: ${d.data.projectTitle || "(no title)"}`);
      console.log(`  characters: ${chars.length}`);
      break;
    }
  }

  if (!target) {
    console.log("\n⚠ No project found with Marcus/Dante. Looking at all projects' character lists...");
    return;
  }

  // Show current state of characters
  console.log("\n=== Characters in target project ===");
  for (const c of (target.data.characters || [])) {
    console.log(`\n  ${c.displayName || c.name}`);
    console.log(`    species: ${c.species || "(empty)"}`);
    console.log(`    colorDescription: "${c.colorDescription || "(empty)"}"`);
    console.log(`    skinTone: "${c.skinTone || "(empty)"}"`);
    console.log(`    ageRange: "${c.ageRange || "(empty)"}"`);
  }

  // Apply patches
  let patched = 0;
  const patchedChars = (target.data.characters || []).map(c => {
    const name = c.displayName || c.name || "";
    for (const p of SKIN_PATCHES) {
      if (p.match.test(name)) {
        console.log(`\n  PATCHING ${name} → colorDescription="${p.color}"`);
        patched++;
        return {
          ...c,
          colorDescription: p.color,
          skinTone: p.color,                          // legacy field — keep in sync
          species: c.species || p.species || "human",
          // Clear ageAppearance — the "appears 10-12 years old" garbage
          ageAppearance: "",
        };
      }
    }
    return c;
  });

  if (patched === 0) {
    console.log("\nNo matching characters to patch in this project.");
    return;
  }

  if (!process.argv.includes("--apply")) {
    console.log(`\n[DRY RUN] Would patch ${patched} characters. Re-run with --apply to save.`);
    return;
  }

  // Save back
  const newData = { ...target.data, characters: patchedChars };
  console.log(`\nSaving back to project ${target.localId}...`);
  const saveRes = await fetch(`${BASE}/api/hybrid/saved-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ localId: target.localId, data: newData }),
  });
  if (saveRes.ok) {
    console.log("✓ Saved. Reload the planner page — characters should show correct ethnicity now.");
    console.log("  Then click 'Regen (3 angles)' on each character to produce correct portraits.");
  } else {
    console.log(`✗ Save failed: ${saveRes.status} ${await saveRes.text()}`);
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
