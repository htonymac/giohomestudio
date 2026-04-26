// GioHomeStudio — GET /api/voices
// Returns available ElevenLabs voices with category metadata.
// Falls back to a hardcoded default list if ElevenLabs is not configured.
//
// Voice metadata (category, quality, accent, languages) is layered on top
// of the ElevenLabs response using a known-voice lookup table.
// Unknown voices get no metadata and display without category filters.

import { NextResponse } from "next/server";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";

// ── Voice metadata lookup ────────────────────────────────────
// ElevenLabs does not return category/accent/language natively.
// We maintain this for known premade and commonly used voices.
// quality values: bass | tenor | soft | commanding | elder | youthful
// accent values:  american | british | african | australian | neutral

interface VoiceMeta {
  category: "man" | "woman" | "boy" | "girl";
  quality: string;
  accent: string;
  languages: string[];
}

const KNOWN_VOICE_META: Record<string, VoiceMeta> = {
  // Premade free-tier voices
  "EXAVITQu4vr4xnSDxMaL": { category: "woman",  quality: "soft",       accent: "american", languages: ["en","es","fr","de","pt","hi","it","pl","ar","sw"] },  // Sarah
  "TX3LPaxmHKxFdv7VOQHJ": { category: "man",    quality: "tenor",      accent: "american", languages: ["en"] },  // Liam
  "pFZP5JQG7iQjIQuC4Bku": { category: "woman",  quality: "soft",       accent: "british",  languages: ["en"] },  // Lily
  "onwK4e9ZLuTAKqWW03F9": { category: "man",    quality: "bass",       accent: "british",  languages: ["en","de","fr","es","pt","hi"] },  // Daniel
  "IKne3meq5aSn9XLyUdCD": { category: "man",    quality: "tenor",      accent: "british",  languages: ["en"] },  // Charlie
  "XB0fDUnXU5powFXDhCwa": { category: "woman",  quality: "commanding", accent: "american", languages: ["en","de","fr","es","pt"] },  // Charlotte

  // Default multi-voice pool
  "pNInz6obpgDQGcFmaJgB": { category: "man",    quality: "bass",       accent: "american", languages: ["en"] },  // Adam
  "TxGEqnHWrfWFTfGW9XjX": { category: "man",    quality: "tenor",      accent: "american", languages: ["en"] },  // Josh
  "MF3mGyEYCl7XYWbV9V6O": { category: "woman",  quality: "soft",       accent: "american", languages: ["en"] },  // Elli
  "jBpfuIE2acCO8z3wKNLl": { category: "girl",   quality: "youthful",   accent: "american", languages: ["en"] },  // Matilda
  "VR6AewLTigWG4xSOukaG": { category: "man",    quality: "elder",      accent: "american", languages: ["en"] },  // Arnold

  // Additional common voices
  "29vD33N1CtxCmqQRPOHJ": { category: "man",    quality: "commanding", accent: "american", languages: ["en","es","fr","de"] },  // Drew
  "D38z5RcWu1voky8WS1ja": { category: "man",    quality: "tenor",      accent: "american", languages: ["en"] },  // Fin
  "ErXwobaYiN019PkySvjV": { category: "man",    quality: "tenor",      accent: "american", languages: ["en","es","fr","de","pt","hi"] },  // Antoni
  "GBv7mTt0atIp3Br8iCZE": { category: "man",    quality: "bass",       accent: "african",  languages: ["en"] },  // Thomas
  "N2lVS1w4EtoT3dr4eOWO": { category: "man",    quality: "bass",       accent: "american", languages: ["en"] },  // Callum
  "ODq5zdih1sEFCuKCNMgu": { category: "man",    quality: "tenor",      accent: "british",  languages: ["en"] },  // Patrick
  "SOYHLrjzK2X1ezoPC6cr": { category: "man",    quality: "commanding", accent: "american", languages: ["en"] },  // Harry
  "ThT5KcBeYPX3keUQqHPh": { category: "woman",  quality: "youthful",   accent: "american", languages: ["en","es","fr","de","pt"] },  // Dorothy
  "flq6f7yk4E4fJM5XTYuZ": { category: "man",    quality: "elder",      accent: "american", languages: ["en"] },  // Michael
  "g5CIjZEefAph4nQFvHAz": { category: "man",    quality: "tenor",      accent: "african",  languages: ["en"] },  // Ethan (African-accent)
  "piTKgcLEGmPE4e6mEKli": { category: "man",    quality: "commanding", accent: "british",  languages: ["en"] },  // Giovanni
  "t0jbNlBVZ17f02VDIeMI": { category: "woman",  quality: "commanding", accent: "american", languages: ["en","es","fr"] },  // Jessie
  "wViXBPUzp2ZZixB1xQuM": { category: "woman",  quality: "elder",      accent: "american", languages: ["en"] },  // Grace
  "yoZ06aMxZJJ28mfd3POQ": { category: "man",    quality: "commanding", accent: "american", languages: ["en"] },  // Sam
  "z9fAnlkpzviPz146aGWa": { category: "man",    quality: "bass",       accent: "british",  languages: ["en","de","es","fr"] },  // Glinda
  "zcAOhNBS3c14rBihAFp1": { category: "man",    quality: "tenor",      accent: "american", languages: ["en"] },  // Giovanni (alt)
};

// ── Hardcoded fallback when ElevenLabs not configured ────────
const FALLBACK_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah"     },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam"      },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily"      },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel"    },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie"   },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam"      },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh"      },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli"      },
  { id: "jBpfuIE2acCO8z3wKNLl", name: "Matilda"   },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold"    },
];

// ── Language support honesty ─────────────────────────────────
// Languages supported by eleven_multilingual_v2 (ElevenLabs official list).
// Nigerian/African languages are NOT officially supported — we flag them honestly.
export const OFFICIALLY_SUPPORTED_LANGUAGES: Record<string, boolean> = {
  en: true, es: true, fr: true, de: true, pt: true, hi: true,
  it: true, pl: true, ar: true, ko: true, ja: true, zh: true,
  nl: true, sv: true, ru: true, tr: true, uk: true, cs: true,
  // Below: partial/unofficial support only
  yo: false,   // Yoruba — not officially supported
  ig: false,   // Igbo — not officially supported
  ha: false,   // Hausa — not officially supported
  sw: true,    // Swahili — supported on some models
  zu: false,   // Zulu — not officially supported
  pidgin: false, // Nigerian Pidgin — use English model, results vary
};

function enrichVoice(v: { id: string; name: string }) {
  const meta = KNOWN_VOICE_META[v.id];
  if (!meta) return { ...v };
  return {
    ...v,
    category: meta.category,
    quality: meta.quality,
    accent: meta.accent,
    languages: meta.languages,
  };
}

export async function GET() {
  try {
    const voices = await elevenLabsVoiceProvider.listVoices();

    if (voices.length > 0) {
      return NextResponse.json({
        voices: voices.map(enrichVoice),
        source: "elevenlabs",
        supportedLanguages: OFFICIALLY_SUPPORTED_LANGUAGES,
      });
    }

    // ElevenLabs returned empty (key not set or API error) → fallback
    return NextResponse.json({
      voices: FALLBACK_VOICES.map(enrichVoice),
      source: "fallback",
      supportedLanguages: OFFICIALLY_SUPPORTED_LANGUAGES,
    });
  } catch {
    return NextResponse.json({
      voices: FALLBACK_VOICES.map(enrichVoice),
      source: "fallback",
      supportedLanguages: OFFICIALLY_SUPPORTED_LANGUAGES,
    });
  }
}
