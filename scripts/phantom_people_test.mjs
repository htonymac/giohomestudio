// Generate a 2-character scene and report the saved image path. Visual check: should
// render EXACTLY 2 people (Marcus + Lena), no phantom 3rd person.
const body = {
  sceneId: "PHANTOMTEST",
  projectId: "phantomtest",
  sceneText: "Marcus and Lena stand together talking in a quiet park at golden hour, calm conversation",
  projectStyle: "3d-cinematic",
  storyEra: "2024",
  storyCulture: "Contemporary",
  characterIds: ["CH01", "CH02"],
  characterOverrides: [
    { characterId: "CH01", name: "Marcus", visualDescription: "tall bald Black man with a thick grey beard, wearing a brown leather jacket", age: "adult" },
    { characterId: "CH02", name: "Lena", visualDescription: "young white woman with long red curly hair and freckles, wearing a green dress", age: "young_adult" },
  ],
};
const res = await fetch("http://localhost:3200/api/hybrid/scene-image", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
});
const d = await res.json();
console.log("HTTP", res.status, "| success:", d.success, "| model:", d.model);
console.log("imagePath:", d.imagePath);
console.log("warning:", d.warning || "(none)");
console.log("prompt tail:", (d.prompt || "").slice(-260));
