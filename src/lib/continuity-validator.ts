// GHS Hybrid Pipeline — Continuity Validation System (Step 17)
// Checks for consistency failures before assembly.
// Source of truth: update/GHS_HYBRID_MASTER_WORKFLOW.md

import type { ValidationError, ValidationResult } from "./hybrid-types";

// ── Input shape expected from DB join ──

export interface HybridProjectFull {
  project: { id: string; characterIds: string[] };
  scenes: Array<{
    id: string;
    sceneId: string;
    sceneType: string;
    characterIds: string[];
    primarySpeaker?: string;
    shots: Array<{
      shotId: string;
      visibleCharacterIds: string[];
      speakingCharacterId?: string;
    }>;
    dialogueLines: Array<{
      characterId: string;
      voiceId?: string;
      lineText: string;
    }>;
    audioPlan: { narrationTrack?: unknown } | null;
  }>;
  characters: Array<{
    id: string;
    characterId?: string;
    name: string;
    voiceId?: string;
  }>;
}

// ── Validator ──

export function validateHybridProject(
  project: HybridProjectFull,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const registeredCharacterIds = new Set(
    project.characters
      .map((c) => c.characterId ?? c.id)
      .filter(Boolean),
  );

  // Check 4: duplicate_character — same characterId used for different characters
  const charIdCounts = new Map<string, string[]>();
  for (const ch of project.characters) {
    const cid = ch.characterId ?? ch.id;
    const existing = charIdCounts.get(cid);
    if (existing) {
      existing.push(ch.name);
    } else {
      charIdCounts.set(cid, [ch.name]);
    }
  }
  for (const [cid, names] of charIdCounts) {
    if (names.length > 1) {
      errors.push({
        type: "duplicate_character",
        characterId: cid,
        message: `Character ID "${cid}" is used by multiple characters: ${names.join(", ")}`,
        severity: "error",
      });
    }
  }

  // Check 5: scene_order_conflict — scenes with conflicting orderIndex
  const orderMap = new Map<number, string[]>();
  for (const scene of project.scenes) {
    // Extract numeric order from sceneId (SC01 -> 1) as fallback
    const idx = parseInt(scene.sceneId.replace(/\D/g, ""), 10) || 0;
    const existing = orderMap.get(idx);
    if (existing) {
      existing.push(scene.sceneId);
    } else {
      orderMap.set(idx, [scene.sceneId]);
    }
  }
  for (const [idx, sceneIds] of orderMap) {
    if (sceneIds.length > 1) {
      errors.push({
        type: "scene_order_conflict",
        message: `Scenes share the same order index ${idx}: ${sceneIds.join(", ")}`,
        severity: "error",
      });
    }
  }

  // Per-scene checks
  for (const scene of project.scenes) {
    // Check 3: missing_character_ref — character in scene but not in registry
    for (const cid of scene.characterIds) {
      if (!registeredCharacterIds.has(cid)) {
        errors.push({
          type: "missing_character_ref",
          sceneId: scene.sceneId,
          characterId: cid,
          message: `Character "${cid}" is in scene ${scene.sceneId} but not found in the character registry`,
          severity: "error",
        });
      }
    }

    // Check 6: missing_shot — scene has no shots
    if (!scene.shots || scene.shots.length === 0) {
      errors.push({
        type: "missing_shot",
        sceneId: scene.sceneId,
        message: `Scene ${scene.sceneId} has no shots`,
        severity: "error",
      });
    }

    // Check 8: missing_audio_plan — scene has no audio plan
    if (!scene.audioPlan) {
      warnings.push({
        type: "missing_audio_plan",
        sceneId: scene.sceneId,
        message: `Scene ${scene.sceneId} has no audio plan`,
        severity: "warning",
      });
    }

    // Check 9: missing_narration — image-led or audio-bridge scene has no narration
    const needsNarration =
      scene.sceneType === "image-led" || scene.sceneType === "audio-bridge";
    if (needsNarration && (!scene.audioPlan || !scene.audioPlan.narrationTrack)) {
      warnings.push({
        type: "missing_narration",
        sceneId: scene.sceneId,
        message: `Scene ${scene.sceneId} (${scene.sceneType}) has no narration track — narration is expected for this scene type`,
        severity: "warning",
      });
    }

    const sceneCharSet = new Set(scene.characterIds);

    // Per-dialogue checks
    for (const line of scene.dialogueLines) {
      // Check 7: unowned_dialogue — dialogue line with no characterId
      if (!line.characterId) {
        errors.push({
          type: "unowned_dialogue",
          sceneId: scene.sceneId,
          message: `Dialogue line in scene ${scene.sceneId} has no characterId: "${line.lineText.slice(0, 50)}..."`,
          severity: "error",
        });
        continue;
      }

      // Check 1: wrong_speaker — dialogue line assigned to character not in scene
      if (!sceneCharSet.has(line.characterId)) {
        errors.push({
          type: "wrong_speaker",
          sceneId: scene.sceneId,
          characterId: line.characterId,
          message: `Dialogue line assigned to "${line.characterId}" who is not listed in scene ${scene.sceneId}`,
          severity: "error",
        });
      }

      // Check 2: voice_mismatch — character has dialogue but no voiceId
      if (!line.voiceId) {
        // Check if the character has a voiceId in the registry
        const charRecord = project.characters.find(
          (c) => (c.characterId ?? c.id) === line.characterId,
        );
        if (!charRecord?.voiceId) {
          warnings.push({
            type: "voice_mismatch",
            sceneId: scene.sceneId,
            characterId: line.characterId,
            message: `Character "${line.characterId}" has dialogue in scene ${scene.sceneId} but no voiceId assigned`,
            severity: "warning",
          });
        }
      }
    }

    // Check shots for unregistered speaking characters
    for (const shot of scene.shots) {
      if (shot.speakingCharacterId && !sceneCharSet.has(shot.speakingCharacterId)) {
        errors.push({
          type: "wrong_speaker",
          sceneId: scene.sceneId,
          shotId: shot.shotId,
          characterId: shot.speakingCharacterId,
          message: `Shot ${shot.shotId} has speaking character "${shot.speakingCharacterId}" who is not in scene ${scene.sceneId}`,
          severity: "error",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
