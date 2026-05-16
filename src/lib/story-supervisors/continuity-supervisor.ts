// Continuity Supervisor — tracks character/prop/time continuity across scenes

import type {
  SupervisorResult,
  ScenePlan,
  CastBibleEntry,
  ContinuityLedger,
} from "./types";

interface CharacterState {
  lastSeen: string; // scene_id
  lastTimeOfDay: string;
  lastLocation: string;
  lastClothing: string;
  injuryNotes: string[];
  propNotes: string[];
  consecutiveAbsence: number;
}

const TIME_ORDER: Record<string, number> = {
  morning: 0,
  noon: 1,
  afternoon: 2,
  evening: 3,
  night: 4,
  midnight: 5,
};

function getTimeOrder(timeOfDay: string): number {
  const lower = timeOfDay.toLowerCase();
  for (const [key, val] of Object.entries(TIME_ORDER)) {
    if (lower.includes(key)) return val;
  }
  return -1; // unknown
}

function detectCostumeChangeMention(visualPrompt: string, currentClothing: string): boolean {
  const promptLower = visualPrompt.toLowerCase();
  const clothingLower = currentClothing.toLowerCase();

  // Check if the prompt mentions clothing different from what's tracked
  const clothingKeywords = clothingLower.split(/[\s,]+/).filter((w) => w.length > 3);
  const hasMatchingKeyword = clothingKeywords.some((kw) => promptLower.includes(kw));

  // If no clothing keywords match but we have a detailed description, flag it
  return !hasMatchingKeyword && clothingKeywords.length > 0 && promptLower.length > 20;
}

function detectInjuryReferences(text: string): string[] {
  const injuries: string[] = [];
  const injuryPatterns = [
    /\b(injured|wound|blood|hurt|broken|limping|bandage|bruise|scar)\b/gi,
    /\b(crying|tears|sobbing)\b/gi,
  ];

  for (const pattern of injuryPatterns) {
    const matches = text.match(pattern) ?? [];
    injuries.push(...matches.map((m) => m.toLowerCase()));
  }

  return [...new Set(injuries)];
}

function detectPropReferences(text: string): string[] {
  const props: string[] = [];
  const propPatterns = [
    /\b(bag|briefcase|suitcase|basket|book|letter|phone|knife|gun|sword|weapon|key|lantern|torch|document|money|food|water)\b/gi,
  ];

  for (const pattern of propPatterns) {
    const matches = text.match(pattern) ?? [];
    props.push(...matches.map((m) => m.toLowerCase()));
  }

  return [...new Set(props)];
}

export function runContinuityCheck(
  scenes: ScenePlan[],
  castBible: CastBibleEntry[]
): SupervisorResult<{ ledger: ContinuityLedger }> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];
  const ledger: ContinuityLedger = {};

  if (scenes.length === 0) {
    return {
      passed: true,
      score: 100,
      blockingIssues: [],
      warnings: ["No scenes to check continuity on."],
      suggestedFixes: [],
      revisedData: { ledger: {} },
    };
  }

  // Build character state tracker
  const characterStates = new Map<string, CharacterState>();
  const characterIdToEntry = new Map<string, CastBibleEntry>();

  for (const entry of castBible) {
    characterIdToEntry.set(entry.character_id, entry);
    characterStates.set(entry.character_id, {
      lastSeen: "",
      lastTimeOfDay: "",
      lastLocation: "",
      lastClothing: entry.clothing ?? "",
      injuryNotes: [],
      propNotes: [],
      consecutiveAbsence: 0,
    });
  }

  let prevTimeOrder = -1;
  let prevTimeOfDay = "";

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneChanges: string[] = [];
    const nextSceneReqs: string[] = [];

    // ── Time-of-day continuity ─────────────────────────────────────────────
    const currentTimeOrder = getTimeOrder(scene.time_of_day);
    if (prevTimeOrder !== -1 && currentTimeOrder !== -1) {
      const timeDiff = currentTimeOrder - prevTimeOrder;

      if (timeDiff < 0 && timeDiff !== -5) {
        // Going backward in time (not midnight wrapping)
        blockingIssues.push(
          `Scene "${scene.scene_id}" (${scene.time_of_day}) goes backward in time from ` +
            `scene "${scenes[i - 1].scene_id}" (${prevTimeOfDay}). ` +
            `Add a time jump note or flashback indicator.`
        );
        suggestedFixes.push(
          `Add "FLASHBACK:" to scene "${scene.scene_id}" title, or update time_of_day to be consistent.`
        );
      } else if (timeDiff >= 3) {
        // Large time jump (skipping multiple time periods)
        warnings.push(
          `Scene "${scene.scene_id}" jumps from "${prevTimeOfDay}" to "${scene.time_of_day}" ` +
            `(skipping ${timeDiff} time periods). Consider a transition note.`
        );
        sceneChanges.push(`Time jump: ${prevTimeOfDay} → ${scene.time_of_day}`);
        nextSceneReqs.push(`Acknowledge time change from ${scene.time_of_day}`);
      }
    }

    if (currentTimeOrder !== -1) {
      prevTimeOrder = currentTimeOrder;
      prevTimeOfDay = scene.time_of_day;
    }

    // ── Character presence continuity ─────────────────────────────────────
    const sceneCharIds = new Set(scene.characters ?? []);

    // Check all tracked characters
    for (const [charId, state] of characterStates) {
      const charEntry = characterIdToEntry.get(charId);
      const charName = charEntry?.name ?? charId;
      const isInScene = sceneCharIds.has(charId);

      if (!isInScene) {
        state.consecutiveAbsence++;

        // Protagonist missing for 3+ consecutive scenes = warning
        if (charEntry?.role === "protagonist" && state.consecutiveAbsence >= 3) {
          warnings.push(
            `Protagonist "${charName}" (${charId}) absent from ` +
              `${state.consecutiveAbsence} consecutive scenes ending at "${scene.scene_id}".`
          );
          suggestedFixes.push(
            `Reintroduce protagonist "${charName}" in scene "${scene.scene_id}" or nearby.`
          );
        }

        // Character was injured and suddenly missing
        if (state.injuryNotes.length > 0 && state.lastSeen && state.consecutiveAbsence >= 2) {
          warnings.push(
            `Character "${charName}" had injury notes (${state.injuryNotes.join(", ")}) ` +
              `but is absent from scene "${scene.scene_id}" without resolution.`
          );
        }
      } else {
        state.consecutiveAbsence = 0;
        state.lastSeen = scene.scene_id;
        state.lastLocation = scene.location ?? "";
        state.lastTimeOfDay = scene.time_of_day ?? "";

        // Check injury continuity in prompt
        const sceneInjuries = detectInjuryReferences(scene.visual_prompt + " " + scene.image_prompt);
        for (const injury of sceneInjuries) {
          if (!state.injuryNotes.includes(injury)) {
            state.injuryNotes.push(injury);
            sceneChanges.push(`${charName} shows ${injury}`);
            nextSceneReqs.push(`${charName} should still show ${injury} in next scene`);
          }
        }

        // Check prop continuity
        const sceneProps = detectPropReferences(scene.visual_prompt + " " + scene.voiceover_text);
        for (const prop of sceneProps) {
          if (!state.propNotes.includes(prop)) {
            state.propNotes.push(prop);
            sceneChanges.push(`${charName} has ${prop}`);
            nextSceneReqs.push(`${charName} should still have ${prop} unless explicitly lost`);
          }
        }

        // Check for costume changes without note
        if (state.lastClothing && charEntry?.clothing) {
          const visualLower = scene.visual_prompt.toLowerCase();
          const expectedClothingWords = charEntry.clothing.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 3);
          const promptHasClothingInfo = expectedClothingWords.some((w) => visualLower.includes(w));

          if (!promptHasClothingInfo && scene.visual_prompt.length > 30) {
            // Only warn if the prompt is detailed enough to have included clothing
            const hasOtherClothing = /\b(shirt|dress|gown|suit|jeans|blouse|wrapper|agbada|kaftan|outfit|wearing)\b/i.test(scene.visual_prompt);
            if (hasOtherClothing) {
              warnings.push(
                `Scene "${scene.scene_id}": ${charName}'s clothing may differ from Cast Bible ("${charEntry.clothing}"). ` +
                  `Verify or add costume_change note.`
              );
            }
          }
        }
      }
    }

    // ── Prop continuity across scenes ─────────────────────────────────────
    if (i > 0) {
      const prevScene = scenes[i - 1];
      const prevProps = detectPropReferences(prevScene.visual_prompt);
      const currentProps = detectPropReferences(scene.visual_prompt);

      for (const prop of prevProps) {
        if (
          !currentProps.includes(prop) &&
          prevScene.characters.some((c) => scene.characters.includes(c))
        ) {
          // Same characters but prop disappeared without mention
          // Only warn for significant props (weapon, document, bag, etc.)
          const significantProps = ["weapon", "gun", "knife", "sword", "document", "letter", "bag", "suitcase"];
          if (significantProps.includes(prop)) {
            warnings.push(
              `Prop "${prop}" was present in scene "${prevScene.scene_id}" but not mentioned in ` +
                `"${scene.scene_id}" with the same characters. Confirm if intentional.`
            );
            suggestedFixes.push(
              `Add continuity note: "${prop} still present" or explicitly note it was set down/lost.`
            );
          }
        }
      }
    }

    // ── Location jump continuity ───────────────────────────────────────────
    if (i > 0 && scenes[i - 1].location && scene.location) {
      const prevLocation = scenes[i - 1].location.toLowerCase();
      const currLocation = scene.location.toLowerCase();

      if (prevLocation !== currLocation && prevLocation !== "unspecified" && currLocation !== "unspecified") {
        // Location changed — check if any continuity note acknowledges it
        const hasTransitionNote = scene.continuity_notes.some(
          (note) =>
            note.toLowerCase().includes("arrive") ||
            note.toLowerCase().includes("travel") ||
            note.toLowerCase().includes("move") ||
            note.toLowerCase().includes("location change") ||
            note.toLowerCase().includes("cut to")
        );

        if (!hasTransitionNote) {
          sceneChanges.push(`Location changed: "${scenes[i - 1].location}" → "${scene.location}"`);
          nextSceneReqs.push(`Establish new location "${scene.location}" clearly at scene start`);
        }
      }
    }

    // Write ledger entry
    if (sceneChanges.length > 0 || nextSceneReqs.length > 0) {
      ledger[scene.scene_id] = {
        important_changes: sceneChanges,
        next_scene_requirements: nextSceneReqs,
      };
    }
  }

  // Final check: protagonist appears in at least 50% of scenes
  for (const [charId, state] of characterStates) {
    const charEntry = characterIdToEntry.get(charId);
    if (charEntry?.role === "protagonist") {
      const totalAbsent = state.consecutiveAbsence;
      const lastSceneId = scenes[scenes.length - 1].scene_id;
      if (state.lastSeen === "" && scenes.length > 0) {
        blockingIssues.push(
          `Protagonist "${charEntry.name}" (${charId}) never appears in any scene. ` +
            `Check character IDs in scenes match Cast Bible.`
        );
        suggestedFixes.push(
          `Ensure scenes reference protagonist by character_id "${charId}".`
        );
      }
    }
  }

  const penaltyPerBlock = 20;
  const penaltyPerWarning = 5;
  const score = Math.max(
    0,
    100 - blockingIssues.length * penaltyPerBlock - warnings.length * penaltyPerWarning
  );
  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { ledger },
    metadata: {
      totalScenes: scenes.length,
      ledgerEntries: Object.keys(ledger).length,
      charactersTracked: characterStates.size,
    },
  };
}
