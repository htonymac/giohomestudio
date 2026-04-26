// Diolux Serviced Apartments — Create 4 separate flat videos via API
// Run: node scripts/create-diolux-flats.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = "http://localhost:3200";
const IMAGES_DIR = "C:/Users/USER/Desktop/CLAUDE/giohomestudio/update/Images";

// ── Flat definitions ──────────────────────────────────────────────────────────

const FLATS = [
  {
    name: "Diolux Flat 1 — Classic Suite",
    brandName: "Diolux Serviced Apartments",
    tagline: "Flat 1 – Classic Suite",
    narration:
      "Welcome to Flat 1 at Diolux Serviced Apartments. This beautifully finished Classic Suite features a spacious living area, two elegant bedrooms, a fully equipped kitchen, and a pristine bathroom. Perfect for short or long stays. Book now — WhatsApp or visit dioluxapartments.com.",
    images: [
      { file: "flat1-living.jpg",    caption: "Diolux Flat 1 — Classic Suite" },
      { file: "flat1-bedroom-a.jpg", caption: "Elegant Master Bedroom" },
      { file: "flat1-bedroom-b.jpg", caption: "Comfortable Second Bedroom" },
      { file: "flat1-kitchen.jpg",   caption: "Fully Equipped Kitchen" },
      { file: "flat1-bathroom.jpg",  caption: "Modern En-Suite Bathroom" },
      { file: "building.jpg",        caption: "📲 Book Now — WhatsApp Us Today!" },
    ],
  },
  {
    name: "Diolux Flat 2 — Premium Suite",
    brandName: "Diolux Serviced Apartments",
    tagline: "Flat 2 – Premium Suite",
    narration:
      "Introducing Flat 2 — our Premium Suite at Diolux Serviced Apartments. Enjoy a stunning living room, two fully furnished bedrooms, a modern kitchen, and a luxurious bathroom. Ideal for families and professionals. Book your stay today on WhatsApp or dioluxapartments.com.",
    images: [
      { file: "flat2-living.jpg",    caption: "Diolux Flat 2 — Premium Suite" },
      { file: "flat2-bedroom-a.jpg", caption: "Luxurious Master Bedroom" },
      { file: "flat2-bedroom-b.jpg", caption: "Well-Appointed Second Bedroom" },
      { file: "flat2-kitchen.jpg",   caption: "Gourmet Kitchen" },
      { file: "flat2-bathroom.jpg",  caption: "Spa-Style Bathroom" },
      { file: "building.jpg",        caption: "📲 Book Now — WhatsApp Us Today!" },
    ],
  },
  {
    name: "Diolux Flat 3 — Executive Suite",
    brandName: "Diolux Serviced Apartments",
    tagline: "Flat 3 – Executive Suite",
    narration:
      "Experience Flat 3 — the Executive Suite at Diolux Serviced Apartments. Four stunning bedrooms, multiple sitting areas, a relaxing sitout, and immaculate bathrooms. Perfect for large families or group stays. Contact us on WhatsApp or visit dioluxapartments.com.",
    images: [
      { file: "flat3 sitting room 1.jpg", caption: "Diolux Flat 3 — Executive Suite" },
      { file: "flat3 sitting room 2.jpg", caption: "Grand Living Area" },
      { file: "flat3 sitting room 3.jpg", caption: "Second Sitting Room" },
      { file: "flat3 sitting room 4.jpg", caption: "Stylish Lounge Space" },
      { file: "flat3 bedroom 1.jpg",      caption: "Spacious Bedroom 1" },
      { file: "flat3 bedroom 2.jpg",      caption: "Elegant Bedroom 2" },
      { file: "flat3 bedroom 4.jpg",      caption: "Bedroom 3 with Garden View" },
      { file: "flat3 bedroom 5.jpg",      caption: "Master Bedroom" },
      { file: "flat3 Sitout.jpg",         caption: "Private Sitout & Relaxation Area" },
      { file: "flat3 toilet1.jpg",        caption: "Premium Bathroom" },
      { file: "flat3 toilet 4.jpg",       caption: "En-Suite Bathroom" },
      { file: "building.jpg",             caption: "📲 Book Now — WhatsApp Us Today!" },
    ],
  },
  {
    name: "Diolux Flat 4 — Grand Suite",
    brandName: "Diolux Serviced Apartments",
    tagline: "Flat 4 – Grand Suite",
    narration:
      "Welcome to Flat 4 — the Grand Suite at Diolux Serviced Apartments. Our largest and most lavish offering features five bedrooms, three sitting areas, a premium kitchen, a private sitout, and beautifully appointed bathrooms. The ultimate shortlet experience. Book on WhatsApp or visit dioluxapartments.com.",
    images: [
      { file: "flat4 sitting room 1.jpg", caption: "Diolux Flat 4 — Grand Suite" },
      { file: "flat4 sitting room 2.jpg", caption: "Elegant Sitting Room" },
      { file: "flat4 sitting room 3.jpg", caption: "Third Lounge Area" },
      { file: "flat4 bedroom 1.jpg",      caption: "Grand Master Bedroom" },
      { file: "flat4 bedroom 2.jpg",      caption: "Stylish Bedroom 2" },
      { file: "flat4 bedroom 3.jpg",      caption: "Bedroom 3 — Serene & Bright" },
      { file: "flat4 bedroom 5.jpg",      caption: "Bedroom 4 with En-Suite" },
      { file: "flat4 bedroom 6.jpg",      caption: "Bedroom 5 — Premium Finish" },
      { file: "flat4 kitchen 1.jpg",      caption: "Chef's Kitchen" },
      { file: "flat4 kitchen 2.jpg",      caption: "Fully Stocked Kitchen" },
      { file: "flat4 kitchen 5.jpg",      caption: "Modern Kitchen Bar" },
      { file: "flat4 sitout.jpg",         caption: "Private Sitout with Views" },
      { file: "flat4 toilet.jpg",         caption: "Luxury Bathroom" },
      { file: "building.jpg",             caption: "📲 Book Now — WhatsApp Us Today!" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${url} → ${res.status}: ${txt}`);
  }
  return res.json();
}

async function apiPatch(url, body) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH ${url} → ${res.status}: ${txt}`);
  }
  return res.json();
}

async function uploadImage(projectId, slideId, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".png" ? "image/png"
    : "image/webp";

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("image", blob, fileName);

  const res = await fetch(`${BASE_URL}/api/commercial/projects/${projectId}/slides/${slideId}/image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upload image ${fileName} → ${res.status}: ${txt}`);
  }
  return res.json();
}

async function updateProjectNarration(projectId, narration) {
  const res = await fetch(`${BASE_URL}/api/commercial/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ narrationScript: narration }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`  ⚠ Could not set narration: ${res.status}: ${txt}`);
  }
}

async function triggerRender(projectId) {
  const res = await fetch(`${BASE_URL}/api/commercial/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Render ${projectId} → ${res.status}: ${txt}`);
  }
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function createFlatProject(flat) {
  console.log(`\n────────────────────────────────────────────`);
  console.log(`Creating: ${flat.name}`);

  // 1. Create project
  const project = await apiPost("/api/commercial/projects", {
    projectName:  flat.name,
    brandName:    flat.brandName,
    tagline:      flat.tagline,
    aspectRatio:  "9:16",
  });
  const projectId = project.id;
  console.log(`  ✓ Project created: ${projectId}`);

  // 2. Set narration script
  await updateProjectNarration(projectId, flat.narration);
  console.log(`  ✓ Narration set`);

  // 3. Create slides in batch
  const validImages = flat.images.filter(img => {
    const fp = path.join(IMAGES_DIR, img.file);
    const exists = fs.existsSync(fp);
    if (!exists) console.warn(`  ⚠ Image not found, skipping: ${img.file}`);
    return exists;
  });

  const batchRes = await fetch(`${BASE_URL}/api/commercial/projects/${projectId}/slides?batch=${validImages.length}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const slides = await batchRes.json();
  console.log(`  ✓ ${slides.length} slides created`);

  // 4. Upload images + set captions
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const img = validImages[i];
    const filePath = path.join(IMAGES_DIR, img.file);

    process.stdout.write(`  ↑ Uploading [${i+1}/${slides.length}] ${img.file}...`);
    await uploadImage(projectId, slide.id, filePath);
    process.stdout.write(` ✓\n`);

    // Set caption
    await apiPatch(`/api/commercial/projects/${projectId}/slides/${slide.id}`, {
      captionOriginal: img.caption,
    });
  }
  console.log(`  ✓ All images uploaded and captions set`);

  // 5. Trigger render
  console.log(`  ▶ Triggering render...`);
  const renderRes = await triggerRender(projectId);
  console.log(`  ✓ Render started (contentItemId: ${renderRes.contentItemId ?? renderRes.id ?? "ok"})`);

  return { projectId, name: flat.name };
}

async function main() {
  console.log("Diolux Serviced Apartments — Creating 4 Flat Videos");
  console.log("Server:", BASE_URL);

  const results = [];
  for (const flat of FLATS) {
    try {
      const result = await createFlatProject(flat);
      results.push({ ...result, status: "started" });
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      results.push({ name: flat.name, status: "failed", error: err.message });
    }
  }

  console.log("\n════════════════════════════════════════════");
  console.log("SUMMARY");
  for (const r of results) {
    const icon = r.status === "started" ? "✓" : "✗";
    console.log(`  ${icon} ${r.name} — ${r.status}${r.error ? ` (${r.error})` : ""}`);
    if (r.projectId) console.log(`      → http://localhost:3200/dashboard/commercial/${r.projectId}`);
  }
  console.log("\nRenders are running in background. Check Registry page for progress.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
