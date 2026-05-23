// Search every project for Marcus Cole / Dante Cole — find where they actually live.

const BASE = "http://localhost:3200";

async function main() {
  const listRes = await fetch(`${BASE}/api/hybrid/saved-state?list=true`);
  const data = await listRes.json();
  const projects = data.projects || [];
  console.log(`Searching ${projects.length} projects for Marcus Cole / Dante Cole...`);

  for (const p of projects) {
    try {
      const r = await fetch(`${BASE}/api/hybrid/saved-state?localId=${encodeURIComponent(p.id)}`);
      if (!r.ok) continue;
      const d = await r.json();
      if (!d.found || !d.data) continue;
      const chars = d.data.characters || [];

      const has = chars.some(c => /(MARCUS|DANTE).*COLE|COLE.*(MARCUS|DANTE)/i.test(c.displayName || c.name || ""));
      const hasGeneric = chars.some(c => /MARCUS|DANTE/i.test(c.displayName || c.name || ""));

      if (has || hasGeneric) {
        console.log(`\n${has ? "✓✓✓ EXACT MATCH" : "✓ partial"}: ${p.id} (${p.title})`);
        console.log(`   updated: ${new Date(p.lastModified).toISOString()}`);
        for (const c of chars) {
          const n = c.displayName || c.name || "(unnamed)";
          if (/MARCUS|DANTE|COLE/i.test(n)) {
            console.log(`     - ${n}: color="${c.colorDescription || "—"}", skin="${c.skinTone || "—"}", age=${c.ageRange || "—"}/${c.ageAppearance || "—"}`);
          }
        }
      }
    } catch { /* skip */ }
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
