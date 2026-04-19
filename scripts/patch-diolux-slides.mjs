/**
 * Patch captions + narration on the existing Diolux project slides.
 * Run after the main build script to fix the 400 errors caused by the
 * `status` field that the PATCH schema does not accept.
 */

const BASE       = "http://localhost:3200";
const PROJECT_ID = "cmnmlx4a4002289iq2k2ck63z";

const SLIDE_PLAN = [
  { caption: "Diolux Serviced Apartments\nComfort you'll love",            narration: "Welcome to Diolux Serviced Apartments — where comfort meets elegance.", durationMs: 5000 },
  { caption: "Stylish Living Spaces",                                       narration: "Unwind in our beautifully designed living rooms.",                        durationMs: 4000 },
  { caption: "Every Detail Thoughtfully Done",                              narration: "Each apartment is designed with attention to every detail.",               durationMs: 4000 },
  { caption: "Spacious Bedrooms",                                           narration: "Rest easy in our spacious, well-furnished bedrooms.",                     durationMs: 4000 },
  { caption: "Your Perfect Retreat",                                        narration: "Wake up refreshed every morning in your private retreat.",                durationMs: 4000 },
  { caption: "Modern Kitchen",                                              narration: "Cook, create and entertain in our fully equipped modern kitchens.",        durationMs: 4000 },
  { caption: "Fully Equipped for You",                                      narration: "Everything you need is right here, ready and waiting.",                   durationMs: 4000 },
  { caption: "Elegant Bathrooms",                                           narration: "Refresh and recharge in our pristine elegant bathrooms.",                  durationMs: 4000 },
  { caption: "Your Home Away from Home",                                    narration: "Step out and breathe — a perfect space to relax after a long day.",       durationMs: 4000 },
  { caption: "Short-Let · Long-Let · Premium Stays",                        narration: "Available for short-let and long-let. Premium stays at great value.",     durationMs: 4000 },
  { caption: "Book Your Stay Today\ndioluxapartments.com\nCall / WhatsApp: +234 9025147449", narration: "Book your stay today. Visit dioluxapartments.com or call us on WhatsApp.", durationMs: 5000 },
];

async function run() {
  // Fetch current slides
  const projResp = await fetch(`${BASE}/api/commercial/projects/${PROJECT_ID}`);
  if (!projResp.ok) { console.error("Failed to fetch project"); process.exit(1); }
  const project = await projResp.json();
  const slides = project.slides ?? [];

  console.log(`Project: ${project.projectName} — ${slides.length} slides found`);

  if (slides.length !== SLIDE_PLAN.length) {
    console.warn(`Slide count mismatch: expected ${SLIDE_PLAN.length}, got ${slides.length}`);
  }

  // Sort slides by slideOrder to ensure correct pairing
  slides.sort((a, b) => a.slideOrder - b.slideOrder);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < Math.min(slides.length, SLIDE_PLAN.length); i++) {
    const slide = slides[i];
    const plan  = SLIDE_PLAN[i];

    const r = await fetch(`${BASE}/api/commercial/projects/${PROJECT_ID}/slides/${slide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        captionOriginal: plan.caption,
        captionPolished: plan.caption,
        captionApproved: true,
        narrationLine:   plan.narration,
        durationMs:      plan.durationMs,
        brandingEnabled: true,
      }),
    });

    if (r.ok) {
      console.log(`  ✓ Slide ${i + 1} patched — "${plan.caption.split("\n")[0]}"`);
      ok++;
    } else {
      const body = await r.text();
      console.error(`  ✗ Slide ${i + 1} FAILED (HTTP ${r.status}): ${body.slice(0, 200)}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} patched, ${fail} failed.`);

  if (fail === 0) {
    // Trigger a fresh render
    console.log("\nTriggering render …");
    const renderResp = await fetch(`${BASE}/api/commercial/projects/${PROJECT_ID}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const renderBody = await renderResp.text();
    console.log(`Render: HTTP ${renderResp.status} — ${renderBody.slice(0, 300)}`);
  }
}

run().catch(err => { console.error("FATAL:", err.message); process.exit(1); });
