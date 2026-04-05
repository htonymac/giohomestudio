// GioHomeStudio — Multi-Voice Dialogue Generator
//
// Takes a parsed dialogue script and generates one audio file per speaker turn,
// then concatenates them in order into a single voice track.
//
// Character voice resolution order:
//   1. CharacterVoice registry (DB lookup by speaker name)
//   2. Default voice pool by gender/role
//   3. Fallback to narrator default voice

import * as path from "path";
import * as fs from "fs";
import { prisma } from "@/lib/prisma";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { mockVoiceProvider } from "@/modules/voice-provider/mock";
import { concatenateAudio } from "@/modules/ffmpeg";
import { env } from "@/config/env";
import type { DialogueTurn } from "@/modules/dialogue-parser";
import type { IVoiceProvider, SpeechStyle } from "@/types/providers";

// Built-in default voice pool — ElevenLabs premade voices (Starter plan)
// These are used when no CharacterVoice registry entry exists for a speaker.
export const DEFAULT_VOICE_POOL = {
  narrator:   { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah"   },   // warm, clear narrator
  male:       { id: "pNInz6obpgDQGcFmaJgB", name: "Adam"    },   // deep, confident
  male_alt:   { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh"    },   // energetic, young
  female:     { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah"   },   // neutral female
  female_alt: { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli"    },   // soft female
  boy:        { id: "jBpfuIE2acCO8z3wKNLl", name: "Matilda" },   // younger tone
  elder:      { id: "VR6AewLTigWG4xSOukaG", name: "Arnold"  },   // aged, gravelly
};

// Assign a voice ID to a speaker name using the registry then defaults
async function resolveVoiceForSpeaker(
  speakerName: string,
  isNarrator: boolean,
  assignedVoices: Map<string, string>   // cache to keep speakers consistent
): Promise<string> {
  if (assignedVoices.has(speakerName)) return assignedVoices.get(speakerName)!;

  // 1. Check DB registry
  try {
    const reg = await prisma.characterVoice.findUnique({ where: { name: speakerName } });
    if (reg?.voiceId) {
      assignedVoices.set(speakerName, reg.voiceId);
      return reg.voiceId;
    }
  } catch { /* DB may not have CharacterVoice table yet — ignore */ }

  // 2. Use defaults
  let voiceId: string;
  if (isNarrator) {
    voiceId = DEFAULT_VOICE_POOL.narrator.id;
  } else {
    // Distribute characters across male/female alternating pool
    const nonNarratorCount = assignedVoices.size;
    const pool = [
      DEFAULT_VOICE_POOL.male.id,
      DEFAULT_VOICE_POOL.female.id,
      DEFAULT_VOICE_POOL.male_alt.id,
      DEFAULT_VOICE_POOL.female_alt.id,
      DEFAULT_VOICE_POOL.elder.id,
    ];
    voiceId = pool[nonNarratorCount % pool.length];
  }

  assignedVoices.set(speakerName, voiceId);
  return voiceId;
}

export interface MultiVoiceResult {
  success: boolean;
  mergedVoicePath?: string;
  segmentPaths?: string[];
  error?: string;
}

export async function generateMultiVoiceAudio(
  contentItemId: string,
  turns: DialogueTurn[],
  voiceProvider: IVoiceProvider,
  options?: {
    speed?: number;
    language?: string;
    defaultSpeechStyle?: SpeechStyle; // applied to all turns unless overridden at turn level
  }
): Promise<MultiVoiceResult> {
  if (turns.length === 0) {
    return { success: false, error: "No dialogue turns provided" };
  }

  const segmentDir = path.join(env.storagePath, "voice", "segments", contentItemId);
  if (!fs.existsSync(segmentDir)) fs.mkdirSync(segmentDir, { recursive: true });

  const assignedVoices = new Map<string, string>();
  const segmentPaths: string[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (!turn.text.trim()) continue;

    const voiceId = await resolveVoiceForSpeaker(turn.speaker, turn.isNarrator, assignedVoices);
    const segmentFile = path.join(segmentDir, `turn_${String(i).padStart(3, "0")}_${turn.speaker}.mp3`);

    // Turn-level direction wins; scene default is the fallback for turns without explicit style
    const speechStyle = turn.speechStyle ?? options?.defaultSpeechStyle;

    const result = await voiceProvider.generate({
      text: turn.text,
      voiceId,
      speed: options?.speed,
      language: options?.language,
      outputPath: segmentFile,
      speechStyle,
    });

    if (result.status === "failed") {
      console.warn(`[MultiVoice] Turn ${i} (${turn.speaker}) failed: ${result.error} — using mock fallback`);
      // Fall back to mock for this turn
      const fallback = await mockVoiceProvider.generate({
        text: turn.text,
        voiceId,
        outputPath: segmentFile,
        speechStyle,
      });
      if (fallback.status === "completed" && fallback.localPath) {
        segmentPaths.push(fallback.localPath);
      }
    } else if (result.localPath) {
      segmentPaths.push(result.localPath);
    }
  }

  if (segmentPaths.length === 0) {
    return { success: false, error: "All voice segments failed to generate" };
  }

  // Concatenate all segments into one voice track
  const mergedFileName = `voice_${contentItemId}_${Date.now()}.mp3`;
  const mergedPath = path.join(env.storagePath, "voice", mergedFileName);

  const concatResult = await concatenateAudio(segmentPaths, mergedPath);
  if (!concatResult.success) {
    return { success: false, error: concatResult.error };
  }

  return {
    success: true,
    mergedVoicePath: mergedPath,
    segmentPaths,
  };
}
