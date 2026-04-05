// GioHomeStudio — African English Narration Accent Profiles
// Single source of truth for all accent data, locale codes, and ElevenLabs Voice Design prompts.

export type AccentLocale =
  | "en-NG-yoruba"
  | "en-NG-igbo"
  | "en-NG-hausa"
  | "en-NG-standard"
  | "en-NG-polished"
  | "en-GH-standard"
  | "en-GH-accra"
  | "en-ZA-johannesburg"
  | "en-ZA-capetown"
  | "en-GB"
  | "en-US"
  | "custom";

export type SpeakerProfile =
  | "young_man"
  | "young_woman"
  | "adult_man"
  | "adult_woman"
  | "elderly_man"
  | "elderly_woman";

export type DeliveryStyle =
  | "formal"
  | "conversational"
  | "commercial"
  | "storytelling"
  | "news_anchor";

export type VoicePacing = "slow" | "normal" | "fast";
export type VoiceEmotion = "calm" | "warm" | "energetic" | "dramatic" | "authoritative";

export interface AccentProfile {
  locale: AccentLocale;
  label: string;           // display name in UI
  region: string;          // e.g. "Nigerian English"
  subLabel?: string;       // e.g. "Yoruba-influenced (Lagos, Southwest)"
  hasSubAccent: boolean;   // false for en-GB, en-US, custom
}

export interface NarrationSettings {
  locale: AccentLocale;
  speakerProfile: SpeakerProfile;
  deliveryStyle: DeliveryStyle;
  pacing: VoicePacing;
  emotion: VoiceEmotion;
  customInstruction: string;
  voiceSource: "auto_design" | "library_search" | "selected_id";
  voiceId?: string;
}

// ── Accent Profile Registry ────────────────────────────────────────────────

export const ACCENT_PROFILES: AccentProfile[] = [
  { locale: "en-NG-yoruba",        label: "Nigerian English — Yoruba",          region: "Nigerian English",      subLabel: "Yoruba-influenced (Lagos, Southwest)",     hasSubAccent: true },
  { locale: "en-NG-igbo",          label: "Nigerian English — Igbo",            region: "Nigerian English",      subLabel: "Igbo-influenced (Southeast)",              hasSubAccent: true },
  { locale: "en-NG-hausa",         label: "Nigerian English — Hausa",           region: "Nigerian English",      subLabel: "Hausa-influenced (Northern Nigeria)",      hasSubAccent: true },
  { locale: "en-NG-standard",      label: "Nigerian English — Standard",        region: "Nigerian English",      subLabel: "Standard (Educated, Formal)",              hasSubAccent: true },
  { locale: "en-NG-polished",      label: "Nigerian English — Fluent Polished", region: "Nigerian English",      subLabel: "TV Presenter / Professional",              hasSubAccent: true },
  { locale: "en-GH-standard",      label: "Ghanaian English — Standard",        region: "Ghanaian English",      subLabel: "Standard (Formal)",                        hasSubAccent: true },
  { locale: "en-GH-accra",         label: "Ghanaian English — Accra",           region: "Ghanaian English",      subLabel: "Accra (Capital, Urban)",                   hasSubAccent: true },
  { locale: "en-ZA-johannesburg",  label: "South African English — Joburg",     region: "South African English", subLabel: "Johannesburg (Urban Black)",               hasSubAccent: true },
  { locale: "en-ZA-capetown",      label: "South African English — Cape Town",  region: "South African English", subLabel: "Cape Town (Western Cape)",                 hasSubAccent: true },
  { locale: "en-GB",               label: "British English",                    region: "British English",       subLabel: "Standard RP",                              hasSubAccent: false },
  { locale: "en-US",               label: "American English",                   region: "American English",      subLabel: "General American",                         hasSubAccent: false },
  { locale: "custom",              label: "Custom",                             region: "Custom",                subLabel: "Describe in instruction box",              hasSubAccent: false },
];

export const SPEAKER_PROFILES: { id: SpeakerProfile; label: string; gender: "male" | "female"; ageGroup: "young" | "adult" | "elderly" }[] = [
  { id: "young_man",    label: "Young Man (18–28)",    gender: "male",   ageGroup: "young"   },
  { id: "young_woman",  label: "Young Woman (18–28)",  gender: "female", ageGroup: "young"   },
  { id: "adult_man",    label: "Adult Man (35–55)",    gender: "male",   ageGroup: "adult"   },
  { id: "adult_woman",  label: "Adult Woman (35–55)",  gender: "female", ageGroup: "adult"   },
  { id: "elderly_man",  label: "Elderly Man (60+)",    gender: "male",   ageGroup: "elderly" },
  { id: "elderly_woman",label: "Elderly Woman (60+)",  gender: "female", ageGroup: "elderly" },
];

export const DELIVERY_STYLES: { id: DeliveryStyle; label: string }[] = [
  { id: "formal",         label: "Formal"         },
  { id: "conversational", label: "Conversational" },
  { id: "commercial",     label: "Commercial"     },
  { id: "storytelling",   label: "Storytelling"   },
  { id: "news_anchor",    label: "News Anchor"    },
];

// ── Known fallback voice IDs ────────────────────────────────────────────────

export const FALLBACK_VOICES: Record<string, { voiceId: string; name: string; description: string }> = {
  "en-NG-yoruba-female": {
    voiceId: "9Dbo4hEvXQ5l7MXGZFQA",
    name: "Olufunmilola",
    description: "African Female, Nigerian Accent, Yoruba",
  },
  "en-NG-male": {
    voiceId: "gsyHQ9kWCDIipR26RqQ1",
    name: "NZ The African Man - Nigerian Voice Pro",
    description: "Nigerian Male Voice",
  },
};

// ── Voice Design Prompt Templates ──────────────────────────────────────────
// Keys: "{locale}_{speakerProfile}" — exact matches take priority.
// If no exact match exists, buildVoiceDesignPrompt() assembles from the base locale template.

const PROMPT_TEMPLATES: Partial<Record<string, string>> = {
  "en-NG-yoruba_adult_man":
    "Nigerian male voice, approximately 40 years old. Nigerian English accent with Yoruba language influence. Syllable-timed rhythm where each syllable is clearly pronounced without reduction. Musical, melodic intonation with level tones on most syllables. TH sounds replaced with T and D. Authoritative, professional delivery. Warm resonant tone. Clear vowels, no vowel reduction. Confident pacing.",

  "en-NG-yoruba_young_woman":
    "Nigerian female voice, approximately 24 years old. Nigerian English accent with Yoruba language influence. Syllable-timed clear pronunciation. Musical intonation, melodic and warm. L and R sometimes mixed in Yoruba fashion. Energetic, expressive. Clear enunciation of all syllables. Friendly confident tone.",

  "en-NG-igbo_young_woman":
    "Nigerian female voice, approximately 24 years old. Nigerian English accent with Igbo language influence. Syllable-timed clear pronunciation. High pitch on stressed syllables, melodic quality. Energetic warm delivery. Clear enunciation of all syllables. Musical intonation pattern. Friendly, expressive tone.",

  "en-NG-hausa_adult_man":
    "Nigerian male voice, approximately 42 years old. Nigerian English accent with Hausa language influence from Northern Nigeria. Emphatic consonants. P sounds can carry F-like quality. Stronger consonant stress. Slightly more formal, measured delivery. Syllable-timed rhythm. Authoritative and deliberate.",

  "en-NG-standard_adult_man":
    "Nigerian male voice, approximately 45 years old. Standard Nigerian English at educated formal register. Syllable-timed rhythm, every syllable clear. Melodic Nigerian intonation, level tones. Unmistakably Nigerian but internationally intelligible. Professional authoritative delivery. Close to what you hear from Nigerian academics and legal professionals.",

  "en-NG-polished_adult_man":
    "Nigerian male voice, approximately 42 years old. Educated Nigerian English at the highest register — fluent, polished, professional. Syllable-timed rhythm where every syllable is clear and fully pronounced, giving a composed even cadence. Musical Nigerian intonation with level tones, controlled and warm. Consonants crisp and clean. Pure open vowels. Authoritative, confident delivery with warmth. The voice of a Nigerian TV presenter or senior executive. Internationally intelligible but unmistakably Nigerian. No Pidgin influence. No heavy dialect features.",

  "en-NG-polished_adult_woman":
    "Nigerian female voice, approximately 38 years old. Educated Nigerian English — fluent, articulate, poised. Clear syllable-timed rhythm, every syllable given full weight. Warm musical Nigerian intonation, controlled and professional. Pure vowel sounds, open and clear. Precise consonants. The vocal quality of a Nigerian news anchor or corporate professional. Confident, warm, authoritative. Internationally intelligible but distinctly, proudly Nigerian. No heavy regional dialect. No Pidgin. Composed delivery.",

  "en-GH-standard_adult_woman":
    "Ghanaian female voice, approximately 45 years old. Ghanaian English accent. Formal, deliberate speech pattern. Syllable-timed with emphasis on syllables that British English would not stress. Rising intonation at end of statements. Clear distinction between V and B sounds. Slightly British-influenced vowels. Dignified, warm, professional delivery.",

  "en-ZA-johannesburg_adult_man":
    "South African male voice, approximately 38 years old. Black South African English accent from Johannesburg. Deep, full warm voice quality produced toward back of mouth. Syllable-timed rhythm with flat, even pitch pattern. Less melodic than West African English. Crisper consonants. Simplified vowel system with vowel mergers. Confident, grounded delivery.",
};

// ── Base locale descriptions (used to construct prompts for unlisted combinations) ──

const BASE_LOCALE_DESCRIPTIONS: Record<string, string> = {
  "en-NG-yoruba":       "Nigerian English accent with Yoruba language influence. Syllable-timed rhythm. Musical, melodic intonation with level tones. TH sounds replaced with T and D. Clear vowels, no vowel reduction.",
  "en-NG-igbo":         "Nigerian English accent with Igbo language influence. Syllable-timed clear pronunciation. High pitch on stressed syllables, melodic quality.",
  "en-NG-hausa":        "Nigerian English accent with Hausa language influence from Northern Nigeria. Emphatic consonants. Stronger consonant stress. Syllable-timed rhythm.",
  "en-NG-standard":     "Standard Nigerian English at educated formal register. Syllable-timed rhythm, every syllable clear. Melodic Nigerian intonation. Unmistakably Nigerian but internationally intelligible.",
  "en-NG-polished":     "Educated Nigerian English at the highest register — fluent, polished, professional. Syllable-timed rhythm. Musical Nigerian intonation with level tones. Internationally intelligible but unmistakably Nigerian. No Pidgin. No heavy dialect features.",
  "en-GH-standard":     "Ghanaian English accent. Syllable-timed with emphasis on syllables that British English would not stress. Rising intonation at end of statements. Clear distinction between V and B sounds. Slightly British-influenced vowels.",
  "en-GH-accra":        "Ghanaian English accent, Accra urban variety. Syllable-timed rhythm. Slightly faster pace than formal Ghanaian English. Clear, confident.",
  "en-ZA-johannesburg": "Black South African English accent from Johannesburg. Syllable-timed rhythm with flat, even pitch pattern. Less melodic than West African English. Crisper consonants. Simplified vowel system.",
  "en-ZA-capetown":     "South African English accent, Cape Town variety. Slightly different vowel pattern than Johannesburg. Clear, confident delivery.",
  "en-GB":              "Standard British English, Received Pronunciation. Non-rhotic. Precise consonants. Long and short vowel distinction.",
  "en-US":              "Standard American English, General American accent. Rhotic. Clear, neutral accent.",
  "custom":             "",
};

const SPEAKER_DESCRIPTIONS: Record<SpeakerProfile, { gender: string; age: string }> = {
  young_man:    { gender: "male",   age: "approximately 23 years old" },
  young_woman:  { gender: "female", age: "approximately 24 years old" },
  adult_man:    { gender: "male",   age: "approximately 42 years old" },
  adult_woman:  { gender: "female", age: "approximately 38 years old" },
  elderly_man:  { gender: "male",   age: "approximately 65 years old" },
  elderly_woman:{ gender: "female", age: "approximately 63 years old" },
};

const DELIVERY_DESCRIPTIONS: Record<DeliveryStyle, string> = {
  formal:         "Formal, authoritative delivery.",
  conversational: "Warm conversational tone, natural and approachable.",
  commercial:     "Commercial delivery — confident, persuasive, clear call-to-action energy.",
  storytelling:   "Storytelling delivery — narrative, engaging, emotionally expressive.",
  news_anchor:    "News anchor delivery — clear, measured, authoritative, professionally neutral.",
};

const PACING_DESCRIPTIONS: Record<VoicePacing, string> = {
  slow:   "Deliberate, slow pacing.",
  normal: "Natural, normal pacing.",
  fast:   "Energetic, slightly faster pacing.",
};

const EMOTION_DESCRIPTIONS: Record<VoiceEmotion, string> = {
  calm:         "Calm, composed energy.",
  warm:         "Warm, friendly energy.",
  energetic:    "Energetic, upbeat energy.",
  dramatic:     "Dramatic, impactful energy.",
  authoritative:"Authoritative, commanding energy.",
};

// ── Main prompt builder ─────────────────────────────────────────────────────

export function buildVoiceDesignPrompt(settings: NarrationSettings): string {
  const templateKey = `${settings.locale}_${settings.speakerProfile}`;

  // Use exact template if available
  if (PROMPT_TEMPLATES[templateKey]) {
    let prompt = PROMPT_TEMPLATES[templateKey]!;
    if (settings.customInstruction.trim()) {
      prompt += ` ${settings.customInstruction.trim()}`;
    }
    return prompt;
  }

  // Build from components
  const speaker = SPEAKER_DESCRIPTIONS[settings.speakerProfile];
  const baseDesc = BASE_LOCALE_DESCRIPTIONS[settings.locale] ?? "";
  const deliveryDesc = DELIVERY_DESCRIPTIONS[settings.deliveryStyle];
  const pacingDesc = PACING_DESCRIPTIONS[settings.pacing];
  const emotionDesc = EMOTION_DESCRIPTIONS[settings.emotion];

  const genderLabel = speaker.gender === "male" ? "male" : "female";
  const regionProfile = ACCENT_PROFILES.find(p => p.locale === settings.locale);
  const regionLabel = regionProfile?.region ?? "English";

  const parts = [
    `${regionLabel} ${genderLabel} voice, ${speaker.age}.`,
    baseDesc,
    deliveryDesc,
    pacingDesc,
    emotionDesc,
  ].filter(Boolean);

  if (settings.customInstruction.trim()) {
    parts.push(settings.customInstruction.trim());
  }

  return parts.join(" ");
}

// ── Preview text used for Voice Design API ──────────────────────────────────

export const VOICE_PREVIEW_TEXT =
  "Welcome to GioHomeStudio. This is a preview of your selected voice and accent. " +
  "Experience the quality and character of this narration before generating your content.";

// ── Default settings ────────────────────────────────────────────────────────

export const DEFAULT_NARRATION_SETTINGS: NarrationSettings = {
  locale: "en-NG-polished",
  speakerProfile: "adult_man",
  deliveryStyle: "commercial",
  pacing: "normal",
  emotion: "authoritative",
  customInstruction: "",
  voiceSource: "auto_design",
};
