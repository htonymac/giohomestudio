// Regenerate Henry's problem scene: Malik (early 20s) in a workshop with a woman.
// Verify: (a) no film camera / cameraman, (b) Malik looks early-20s not 40s, (c) 2 people.
const body = {
  sceneId: "WORKSHOPTEST",
  projectId: "workshoptest",
  sceneText: "Malik stands at a cluttered workbench in his workshop, a half-built model plane in front of him, talking warmly with Amara. Tools and wood shavings around. Warm afternoon light.",
  projectStyle: "3d-cinematic",
  storyEra: "2024",
  storyCulture: "Contemporary",
  location: "interior of a cluttered woodworking workshop, workbench with tools and wood shavings, half-built model plane",
  mood: "warm",
  timeOfDay: "afternoon",
  cameraFraming: "medium two-shot",
  characterIds: ["MALIK", "AMARA"],
  characterOverrides: [
    { characterId: "MALIK", name: "Malik", visualDescription: "young Black man in his early twenties, short dark hair, clean-shaven, slim build, wearing a denim jacket over a t-shirt", age: "young_adult" },
    { characterId: "AMARA", name: "Amara", visualDescription: "young Black woman with natural curly hair, mid twenties, wearing a grey tank top", age: "young_adult" },
  ],
};
const res = await fetch("http://localhost:3200/api/hybrid/scene-image", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
});
const d = await res.json();
console.log("HTTP", res.status, "| success:", d.success, "| model:", d.model);
console.log("imagePath:", d.imagePath);
