// Reproduce the drift scenario: a realistic scene about a completed model PLANE whose
// "wings catch the light" — must render an AIRCRAFT, NOT an angel with wings.
const body = {
  sceneId: "PLANETEST",
  projectId: "planetest",
  sceneText: "Malik stands before the completed model airplane on his workbench, its wings catching the warm twilight light. A masterpiece finished after months of work. He smiles with pride.",
  projectStyle: "3d-cinematic",
  storyEra: "2024",
  storyCulture: "Contemporary",
  location: "interior of a woodworking workshop, workbench, a finished wooden model airplane with wings",
  mood: "proud, warm",
  timeOfDay: "twilight",
  cameraFraming: "medium shot",
  characterIds: ["MALIK"],
  characterOverrides: [
    { characterId: "MALIK", name: "Malik", visualDescription: "young Black man in his early twenties, short dark hair, clean-shaven, wearing a denim jacket", age: "young_adult" },
  ],
};
const res = await fetch("http://localhost:3200/api/hybrid/scene-image", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
});
const d = await res.json();
console.log("HTTP", res.status, "| success:", d.success, "| imagePath:", d.imagePath);
console.log("neg tail:", (d.prompt ? "(prompt present)" : "") , "| has antifantasy in negative? check via render");
