"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { generateCharacterId } from "@/lib/character-id";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

interface ReferenceImage {
  url: string;
  angle: string;
  label: string;
}

interface CharacterVoice {
  id: string;
  characterId: string | null;
  name: string;
  gender: string | null;
  toneClass: string | null;
  accent: string | null;
  language: string | null;
  voiceId: string | null;
  voiceName: string | null;
  isNarrator: boolean;
  notes: string | null;
  imageUrl: string | null;
  visualDescription: string | null;
  role: string | null;
  defaultSpeechStyle: string | null;
  referenceImages: ReferenceImage[] | null;
  age: string | null;
  country: string | null;
  personality: string | null;
  culture: string | null;
}

const GENDER_OPTIONS   = ["male", "female", "boy", "girl"];
const TONE_OPTIONS     = ["bass", "tenor", "soft", "commanding", "elder", "youthful", "raspy", "smooth"];
const ACCENT_OPTIONS   = ["neutral", "american", "british", "australian", "european", "african", "east_asian", "latin", "south_asian", "middle_eastern"];
const ROLE_OPTIONS     = [
  { value: "protagonist",  label: "Protagonist (Hero)" },
  { value: "antagonist",   label: "Antagonist (Villain)" },
  { value: "narrator",     label: "Narrator / Voiceover" },
  { value: "supporting",   label: "Supporting character" },
  { value: "elder",        label: "Elder / Mentor" },
  { value: "child",        label: "Child" },
  { value: "comic_relief", label: "Comic relief" },
];
const SPEECH_STYLE_OPTIONS = [
  { value: "normal",     label: "Normal — balanced delivery" },
  { value: "emotional",  label: "Emotional — expressive, heartfelt" },
  { value: "commanding", label: "Commanding — authoritative, bold" },
  { value: "whisper",    label: "Whisper — soft, intimate" },
  { value: "trembling",  label: "Trembling — fearful, shaky" },
];
const LANGUAGE_OPTIONS = [
  { value: "en",  label: "English" },
  { value: "es",  label: "Spanish" },
  { value: "fr",  label: "French" },
  { value: "pt",  label: "Portuguese" },
  { value: "de",  label: "German" },
  { value: "ja",  label: "Japanese" },
  { value: "zh",  label: "Chinese (Mandarin)" },
  { value: "ar",  label: "Arabic" },
  { value: "hi",  label: "Hindi" },
  { value: "ko",  label: "Korean" },
  { value: "it",  label: "Italian" },
  { value: "ru",  label: "Russian" },
  { value: "sw",  label: "Swahili" },
  { value: "tr",  label: "Turkish" },
  { value: "nl",  label: "Dutch" },
];

// ElevenLabs built-in voices on Starter plan
const DEFAULT_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah — Warm narrator (female)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam — Deep confident (male)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh — Energetic young (male)" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli — Soft gentle (female)" },
  { id: "jBpfuIE2acCO8z3wKNLl", name: "Matilda — Younger tone" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold — Aged gravelly (male)" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam — Raspy, intense (male)" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel — Deep British (male)" },
];

type PackEntry = Omit<CharacterVoice, "id" | "referenceImages" | "characterId" | "age" | "country" | "personality" | "culture">;

// Universal Narrator Pack — 5 age-group narrators, global neutral English
const UNIVERSAL_NARRATOR_PACK: PackEntry[] = [
  {
    name: "NARR_CHILD", gender: "girl", toneClass: "youthful",
    accent: "neutral", language: "en", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Child narrator. Ages 8–12. Light, curious, warm tone. Paste your ElevenLabs cloned voice ID when ready.",
  },
  {
    name: "NARR_TEEN", gender: "male", toneClass: "youthful",
    accent: "neutral", language: "en", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Teen narrator. Ages 13–17. Energetic, relatable, casual delivery. Paste your ElevenLabs voice ID when ready.",
  },
  {
    name: "NARR_YOUTH", gender: "male", toneClass: "tenor",
    accent: "neutral", language: "en", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Young adult narrator. Ages 18–28. Confident, dynamic, engaging universal voice.",
  },
  {
    name: "NARR_ADULT", gender: "male", toneClass: "commanding",
    accent: "neutral", language: "en", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "commanding",
    imageUrl: null, visualDescription: null,
    notes: "Adult narrator. Ages 30–50. Grounded, authoritative, professional delivery.",
  },
  {
    name: "NARR_ELDER", gender: "male", toneClass: "elder",
    accent: "neutral", language: "en", voiceId: null, voiceName: null,
    isNarrator: true, role: "elder", defaultSpeechStyle: "emotional",
    imageUrl: null, visualDescription: null,
    notes: "Elder narrator. Ages 55+. Deep, wise, measured pace. Carries gravitas and warmth.",
  },
];

// World Cinema Pack — universal drama characters for global storytelling
const WORLD_CINEMA_PACK: PackEntry[] = [
  {
    name: "HERO_WORLD", gender: "male", toneClass: "commanding",
    accent: "neutral", language: "en", voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam",
    isNarrator: false, role: "protagonist", defaultSpeechStyle: "commanding",
    imageUrl: null,
    visualDescription: "Strong, determined man in his 30s. Resilient build, confident presence. Adaptable — fits any culture or setting.",
    notes: "Lead male hero. Universal archetype. Confident, purposeful, emotionally grounded delivery.",
  },
  {
    name: "HEROINE_WORLD", gender: "female", toneClass: "commanding",
    accent: "neutral", language: "en", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah",
    isNarrator: false, role: "protagonist", defaultSpeechStyle: "emotional",
    imageUrl: null,
    visualDescription: "Confident, capable woman in her late 20s to 30s. Strong presence, expressive eyes. Works across any genre or culture.",
    notes: "Lead female hero. Wide emotional range — warm, fierce, determined depending on scene.",
  },
  {
    name: "ELDER_FIGURE", gender: "female", toneClass: "elder",
    accent: "neutral", language: "en", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah",
    isNarrator: false, role: "elder", defaultSpeechStyle: "emotional",
    imageUrl: null,
    visualDescription: "Older woman, 50s-60s. Warm, maternal energy. Wise eyes, calm presence. Universal elder archetype.",
    notes: "The mother/elder archetype. Gentle but firm. Carries wisdom and emotional weight.",
  },
  {
    name: "VILLAIN_WORLD", gender: "male", toneClass: "bass",
    accent: "neutral", language: "en", voiceId: "VR6AewLTigWG4xSOukaG", voiceName: "Arnold",
    isNarrator: false, role: "antagonist", defaultSpeechStyle: "commanding",
    imageUrl: null,
    visualDescription: "Imposing man, 40s-50s. Sharp, angular features. Expensive dark attire. Cold, calculating gaze.",
    notes: "The antagonist. Measured, menacing delivery. Speaks with authority and controlled threat.",
  },
  {
    name: "SIDEKICK_WORLD", gender: "male", toneClass: "youthful",
    accent: "neutral", language: "en", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh",
    isNarrator: false, role: "supporting", defaultSpeechStyle: "normal",
    imageUrl: null,
    visualDescription: "Young man, early 20s. Street-smart energy. Casual urban style, quick eyes, likeable face.",
    notes: "Sidekick / comic relief. Fast, casual delivery. Works in action, comedy, or drama.",
  },
];

// English Cinematic pack — universal drama characters
const ENGLISH_CINEMATIC_PACK: PackEntry[] = [
  {
    name: "HERO_EN", gender: "male", toneClass: "commanding",
    accent: "american", language: "en", voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam",
    isNarrator: false, role: "protagonist", defaultSpeechStyle: "commanding",
    imageUrl: null,
    visualDescription: "Strong, capable man in his 30s. Determined, battle-worn. Leader presence.",
    notes: "Classic cinematic male hero. Bold, purposeful delivery.",
  },
  {
    name: "HEROINE_EN", gender: "female", toneClass: "soft",
    accent: "american", language: "en", voiceId: "MF3mGyEYCl7XYWbV9V6O", voiceName: "Elli",
    isNarrator: false, role: "protagonist", defaultSpeechStyle: "emotional",
    imageUrl: null,
    visualDescription: "Capable woman in her late 20s. Resilient. Expressive face, strong posture.",
    notes: "Classic cinematic female hero. Wide emotional range.",
  },
  {
    name: "MENTOR_EN", gender: "male", toneClass: "elder",
    accent: "british", language: "en", voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel",
    isNarrator: false, role: "elder", defaultSpeechStyle: "normal",
    imageUrl: null,
    visualDescription: "Older man, 60s-70s. Grey-bearded, wise eyes. Well-spoken, calm presence.",
    notes: "The wise mentor archetype. Steady British delivery. Measured pace.",
  },
  {
    name: "ANTAGONIST_EN", gender: "male", toneClass: "bass",
    accent: "british", language: "en", voiceId: "yoZ06aMxZJJ28mfd3POQ", voiceName: "Sam",
    isNarrator: false, role: "antagonist", defaultSpeechStyle: "commanding",
    imageUrl: null,
    visualDescription: "Sharp-featured man in his 40s. Dark, controlled energy. Impeccable attire.",
    notes: "The cinematic villain. Raspy, intense delivery. Cold authority.",
  },
  {
    name: "NARRATOR_EN", gender: null, toneClass: "smooth",
    accent: "american", language: "en", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah",
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Neutral English cinematic narrator. Clear, warm delivery. Works for any genre.",
  },
];

const BLANK: Partial<CharacterVoice> = {
  name: "", gender: null, toneClass: null, accent: null, language: null,
  voiceId: null, voiceName: null, isNarrator: false, notes: null,
  imageUrl: null, visualDescription: null, role: null, defaultSpeechStyle: null,
  referenceImages: null,
};

// ── Shared select ────────────────────────────────────────────
function Select({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ background: ds.color.card, color: ds.color.ink2, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, padding: "6px 8px", fontSize: 13, width: "100%", fontFamily: ds.font.sans }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── URL normalizer: converts storage paths to /api/media URLs ──
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/api/") || url.startsWith("blob:")) return url;
  const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

// ── Voice + character profile form ────────────────────────────
function VoiceForm({
  initial, onSave, onCancel, saving,
}: {
  initial: Partial<CharacterVoice>;
  onSave: (data: Partial<CharacterVoice>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<CharacterVoice> & { skinTone?: string; attribute?: string }>(initial);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [refUploading, setRefUploading] = useState(false);
  const [refUploadError, setRefUploadError] = useState("");
  const set = (k: string, v: string | boolean | null) =>
    setForm(f => ({ ...f, [k]: v === "" ? null : v }));

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/character-voices/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setForm(f => ({ ...f, imageUrl: data.url }));
    } catch {
      setUploadError("Upload failed. Check connection.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRefImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const existing = (form.referenceImages as ReferenceImage[] | null) ?? [];
    if (existing.length >= 4) {
      setRefUploadError("Maximum 4 reference images allowed.");
      return;
    }
    setRefUploading(true);
    setRefUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/character-voices/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setRefUploadError(data.error ?? "Upload failed"); return; }
      const newImg: ReferenceImage = { url: data.url, angle: "", label: "" };
      setForm(f => ({
        ...f,
        referenceImages: [...(((f.referenceImages as ReferenceImage[]) ?? [])), newImg],
      }));
    } catch {
      setRefUploadError("Upload failed. Check connection.");
    } finally {
      setRefUploading(false);
      e.target.value = "";
    }
  }

  function removeRefImage(idx: number) {
    setForm(f => ({
      ...f,
      referenceImages: ((f.referenceImages as ReferenceImage[]) ?? []).filter((_, i) => i !== idx),
    }));
  }

  function updateRefImage(idx: number, key: keyof ReferenceImage, value: string) {
    setForm(f => {
      const imgs = [...(((f.referenceImages as ReferenceImage[]) ?? []))];
      imgs[idx] = { ...imgs[idx], [key]: value };
      return { ...f, referenceImages: imgs };
    });
  }

  async function handlePreview() {
    if (!form.voiceId) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: form.voiceId, language: form.language ?? undefined }),
      });
      if (!res.ok) { setPreviewing(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPreviewing(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPreviewing(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch { setPreviewing(false); }
  }

  const inputStyle = { background: ds.color.paper, color: ds.color.ink, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, padding: "6px 10px", fontSize: 13, width: "100%", fontFamily: ds.font.sans };
  const labelStyle = { fontSize: 11, color: ds.color.mute, display: "block", marginBottom: 4, fontFamily: ds.font.mono, textTransform: "uppercase" as const, letterSpacing: "0.08em" };
  const selectStyle = { background: ds.color.card, color: ds.color.ink2, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, padding: "6px 8px", fontSize: 13, width: "100%", fontFamily: ds.font.sans };

  return (
    <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.md, padding: 20, marginBottom: 16 }}>

      {/* ── Row 1: Name + Narrator ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Character Name *</label>
          <input
            value={form.name ?? ""}
            onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
            placeholder="e.g. NARRATOR, JOHN, MAMA"
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ fontSize: 13, color: "#9090b0", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.isNarrator ?? false}
              onChange={e => setForm(f => ({ ...f, isNarrator: e.target.checked }))}
            />
            Mark as Narrator
          </label>
        </div>
      </div>

      {/* ── Row 2: Role + Default speech style ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Story role</label>
          <select
            value={form.role ?? ""}
            onChange={e => set("role", e.target.value)}
            style={selectStyle}
          >
            <option value="">— Not set —</option>
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} title="Default voice performance direction for this character's lines">Default speech style</label>
          <select
            value={form.defaultSpeechStyle ?? ""}
            onChange={e => set("defaultSpeechStyle", e.target.value)}
            style={selectStyle}
          >
            <option value="">— Auto (normal) —</option>
            {SPEECH_STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Row 2b: Character ID fields (Country + Age + Skin/Attribute) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Country</label>
          <select value={form.country ?? ""} onChange={e => set("country", e.target.value)} style={selectStyle}>
            <option value="">— Select —</option>
            {["United States", "United Kingdom", "Canada", "Australia", "France", "Germany", "Spain", "Italy", "Brazil", "Mexico", "Japan", "China", "South Korea", "India", "Russia", "Turkey", "South Africa", "Egypt", "Nigeria", "Ghana", "Kenya", "Ethiopia", "Morocco", "Argentina", "Colombia", "Saudi Arabia", "Indonesia", "Philippines", "Pakistan"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Age</label>
          <select value={form.age ?? ""} onChange={e => set("age", e.target.value)} style={selectStyle}>
            <option value="">— Select —</option>
            <option value="child">Child (8)</option>
            <option value="teen">Teen (15)</option>
            <option value="young_adult">Young Adult (25)</option>
            <option value="adult">Adult (35)</option>
            <option value="elder">Elder (65)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Skin Tone</label>
          <input value={form.skinTone ?? ""} onChange={e => setForm(f => ({ ...f, skinTone: e.target.value || undefined }))} placeholder="e.g. DARK, FAIR, LIGHT" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Attribute</label>
          <input value={form.attribute ?? ""} onChange={e => setForm(f => ({ ...f, attribute: e.target.value || undefined }))} placeholder="e.g. NINJA, TALL" style={inputStyle} />
        </div>
      </div>

      {/* Auto-generated Character ID */}
      {form.name && (
        <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <span style={{ fontSize: 10, color: "#7070a0" }}>Character ID: </span>
          <span style={{ fontSize: 13, fontFamily: "monospace", color: "#a855f7", fontWeight: 700 }}>
            {generateCharacterId({ country: form.country ?? "", name: form.name ?? "", age: form.age ?? "", skinTone: form.skinTone ?? "", attribute: form.attribute ?? "" })}
          </span>
        </div>
      )}

      {/* ── Row 3: Gender + Tone + Accent + Language ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>Gender</label>
          <Select value={form.gender ?? ""} onChange={v => set("gender", v)} options={GENDER_OPTIONS} placeholder="Any" />
        </div>
        <div>
          <label style={labelStyle}>Tone</label>
          <Select value={form.toneClass ?? ""} onChange={v => set("toneClass", v)} options={TONE_OPTIONS} placeholder="Any" />
        </div>
        <div>
          <label style={labelStyle}>Accent</label>
          <Select value={form.accent ?? ""} onChange={v => set("accent", v)} options={ACCENT_OPTIONS} placeholder="Neutral" />
        </div>
        <div>
          <label style={labelStyle}>Language</label>
          <select value={form.language ?? ""} onChange={e => set("language", e.target.value)} style={selectStyle}>
            <option value="">English (default)</option>
            {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Row 4: ElevenLabs voice picker ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>ElevenLabs Voice</label>
        <select
          value={DEFAULT_VOICES.find(v => v.id === form.voiceId) ? form.voiceId! : (form.voiceId ? "__custom__" : "")}
          onChange={e => {
            if (e.target.value === "__custom__") {
              setForm(f => ({ ...f, voiceId: "", voiceName: null }));
            } else {
              const voice = DEFAULT_VOICES.find(v => v.id === e.target.value);
              setForm(f => ({ ...f, voiceId: e.target.value || null, voiceName: voice?.name.split(" — ")[0] ?? null }));
            }
          }}
          style={selectStyle}
        >
          <option value="">Auto-assigned by system</option>
          {DEFAULT_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          <option value="__custom__">Paste custom voice ID…</option>
        </select>
        {(form.voiceId === "" || (form.voiceId && !DEFAULT_VOICES.find(v => v.id === form.voiceId))) && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={form.voiceId ?? ""}
              onChange={e => setForm(f => ({ ...f, voiceId: e.target.value || null }))}
              placeholder="Paste ElevenLabs custom voice ID here"
              style={{ flex: 1, ...inputStyle, fontSize: 12 }}
            />
            {form.voiceId && (
              <button
                onClick={handlePreview}
                disabled={previewing}
                style={{ background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 6, padding: "6px 14px", fontSize: 12, color: "#4ade80", cursor: "pointer", opacity: previewing ? 0.6 : 1, flexShrink: 0 }}
              >
                {previewing ? "Playing…" : "▶ Preview"}
              </button>
            )}
          </div>
        )}
        {DEFAULT_VOICES.find(v => v.id === form.voiceId) && (
          <button
            onClick={handlePreview}
            disabled={previewing}
            style={{ marginTop: 6, background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 6, padding: "5px 14px", fontSize: 11, color: "#4ade80", cursor: "pointer" }}
          >
            {previewing ? "Playing…" : "▶ Preview voice"}
          </button>
        )}
      </div>

      {/* ── Row 5: Character portrait — upload or URL ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Character portrait <span style={{ color: "#3a3a5a", fontWeight: "normal" }}>(optional)</span></label>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            type="url"
            value={form.imageUrl ?? ""}
            onChange={e => set("imageUrl", e.target.value)}
            placeholder="Paste image URL, or click Upload →"
            style={{ flex: 1, minWidth: 180, ...inputStyle }}
          />
          {/* File upload button */}
          <label style={{
            background: "#1a1a2e", border: "1px solid #3a3a5a", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, color: uploading ? "#5a5a7a" : "#9090b0",
            cursor: uploading ? "wait" : "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {uploading ? "Uploading…" : "⬆ Upload Photo"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </label>
          {form.imageUrl && (
            <img
              src={normalizeImageUrl(form.imageUrl)}
              alt="preview"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40", flexShrink: 0 }}
            />
          )}
        </div>
        {uploadError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{uploadError}</p>}
      </div>

      {/* ── Row 5b: Multi-angle reference images (up to 4) ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>
          Reference images
          <span style={{ color: "#3a3a5a", fontWeight: "normal" }}> — up to 4 angles for character consistency</span>
        </label>
        {/* Existing reference images */}
        {Array.isArray(form.referenceImages) && (form.referenceImages as ReferenceImage[]).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {(form.referenceImages as ReferenceImage[]).map((img, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ position: "relative" }}>
                  <img
                    src={normalizeImageUrl(img.url)}
                    alt={img.label || `ref ${idx + 1}`}
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40" }}
                  />
                  <button
                    onClick={() => removeRefImage(idx)}
                    title="Remove"
                    style={{
                      position: "absolute", top: -6, right: -6, width: 16, height: 16,
                      background: "#f87171", color: "#fff", border: "none", borderRadius: "50%",
                      fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >x</button>
                </div>
                <input
                  value={img.angle || ""}
                  onChange={e => updateRefImage(idx, "angle", e.target.value)}
                  placeholder="angle"
                  style={{ width: 56, fontSize: 9, background: ds.color.paper, color: ds.color.ink2, border: `1px solid ${ds.color.line2}`, borderRadius: 4, padding: "2px 4px", textAlign: "center" }}
                />
              </div>
            ))}
          </div>
        )}
        {/* Add image button — shows up to 4 total */}
        {(((form.referenceImages as ReferenceImage[]) ?? []).length < 4) && (
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#1a1a2e", border: "1px solid #3a3a5a", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, color: refUploading ? "#5a5a7a" : "#9090b0",
            cursor: refUploading ? "wait" : "pointer",
          }}>
            {refUploading ? "Uploading…" : `+ Add Reference Image (${((form.referenceImages as ReferenceImage[]) ?? []).length}/4)`}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleRefImageUpload}
              disabled={refUploading}
            />
          </label>
        )}
        {refUploadError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{refUploadError}</p>}
      </div>

      {/* ── Row 6: Visual description ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>
          Visual description
          <span style={{ color: "#3a3a5a", fontWeight: "normal" }}> — injected into video prompts when this character is cast</span>
        </label>
        <textarea
          value={form.visualDescription ?? ""}
          onChange={e => set("visualDescription", e.target.value)}
          placeholder="e.g. Tall man in his 30s, athletic build, determined gaze, casual modern clothing"
          rows={2}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      {/* ── Row 7: Notes ── */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Notes</label>
        <input
          value={form.notes ?? ""}
          onChange={e => set("notes", e.target.value)}
          placeholder="e.g. Wise elder archetype, speaks slowly and thoughtfully"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name}
          style={{ background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`, backgroundSize: "300% 100%", color: "#fff", border: "none", borderRadius: ds.radius.sm, padding: "8px 20px", fontSize: 13, cursor: "pointer", opacity: saving || !form.name ? 0.5 : 1, fontFamily: ds.font.sans }}
        >
          {saving ? "Saving…" : "Save Character"}
        </button>
        <button
          onClick={onCancel}
          style={{ background: ds.color.alert, color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: ds.font.sans }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Character card ────────────────────────────────────────────
const ROLE_BADGE_COLOR: Record<string, string> = {
  protagonist:  ds.color.lilac,
  antagonist:   "#f87171",
  narrator:     ds.color.sky,
  supporting:   ds.color.mute,
  elder:        ds.color.gold,
  child:        ds.color.mint,
  comic_relief: ds.color.coral,
};

function VoiceCard({ v, onEdit, onDelete, editingId, onUpdate, saving, onPreview }: {
  v: CharacterVoice;
  onEdit: (id: string | null) => void;
  onDelete: (id: string, name: string) => void;
  editingId: string | null;
  onUpdate: (id: string, form: Partial<CharacterVoice>) => void;
  saving: boolean;
  onPreview?: (v: CharacterVoice) => void;
}) {
  const roleColor = v.role ? (ROLE_BADGE_COLOR[v.role] ?? "#9090b0") : null;
  const [genPortrait, setGenPortrait] = useState(false);
  const [charStyle, setCharStyle] = useState("3d-cinematic");
  const [prevImage, setPrevImage] = useState<string | null>(null);
  const [portraitPreviewOpen, setPortraitPreviewOpen] = useState(false);

  if (editingId === v.id) {
    return (
      <VoiceForm
        initial={v}
        onSave={form => onUpdate(v.id, form)}
        onCancel={() => onEdit(null)}
        saving={saving}
      />
    );
  }

  return (
    <div style={{
      background: ds.color.card,
      border: `1px solid ${ds.color.line2}`,
      borderRadius: ds.radius.md,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px" }}>

        {/* Portrait image or placeholder */}
        <div style={{ flexShrink: 0 }}>
          {v.imageUrl ? (
            <img
              src={normalizeImageUrl(v.imageUrl)}
              alt={v.name}
              onError={e => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display = "none"; }}
              style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40" }}
            />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: ds.radius.sm, background: ds.color.paper, border: `1px solid ${ds.color.line2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: ds.color.mute2, fontFamily: ds.font.mono, fontWeight: 700 }}>
              {v.isNarrator ? "N" : "C"}
            </div>
          )}
        </div>

        {/* Identity column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ color: ds.color.ink, fontWeight: 700, fontSize: 14 }}>{v.name}</span>
            {v.characterId && (
              <span style={{ fontFamily: ds.font.mono, fontSize: 9, color: ds.color.magenta, background: `${ds.color.magenta}12`, padding: "1px 6px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.magenta}30` }}>
                {v.characterId}
              </span>
            )}
            {v.isNarrator && (
              <span style={{ background: `${ds.color.lilac}18`, color: ds.color.lilac, fontSize: 10, borderRadius: ds.radius.xs, padding: "1px 6px", border: `1px solid ${ds.color.lilac}44`, fontFamily: ds.font.mono }}>
                NARRATOR
              </span>
            )}
            {v.role && roleColor && (
              <span style={{ background: `${roleColor}18`, color: roleColor, fontSize: 10, borderRadius: 4, padding: "1px 6px", border: `1px solid ${roleColor}33` }}>
                {v.role.replaceAll("_", " ")}
              </span>
            )}
            {v.defaultSpeechStyle && v.defaultSpeechStyle !== "normal" && (
              <span style={{ background: "#1a2a3a", color: "#e0e8f0", fontSize: 10, borderRadius: 4, padding: "1px 6px", border: "1px solid #2a3a5a" }}>
                {v.defaultSpeechStyle}
              </span>
            )}
          </div>

          {/* Visual description */}
          {v.visualDescription && (
            <p style={{ fontSize: 11, color: "#6070a0", marginBottom: 4, fontStyle: "italic", lineHeight: 1.4 }}>
              {v.visualDescription.length > 120 ? v.visualDescription.slice(0, 120) + "…" : v.visualDescription}
            </p>
          )}

          {/* Tags + voice */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[v.gender, v.toneClass, v.accent].filter(Boolean).map((tag, i) => (
              <span key={`${tag}-${i}`} style={{ background: ds.color.alert, color: ds.color.mute, fontSize: 11, borderRadius: ds.radius.xs, padding: "2px 7px", fontFamily: ds.font.mono }}>
                {tag}
              </span>
            ))}
            {v.language && (
              <span style={{ background: ds.color.alert, color: ds.color.mute, fontSize: 11, borderRadius: ds.radius.xs, padding: "2px 7px", fontFamily: ds.font.mono }}>
                {LANGUAGE_OPTIONS.find(l => l.value === v.language)?.label ?? v.language}
              </span>
            )}
            {v.voiceName && (
              <span style={{ background: `${ds.color.mint}10`, color: ds.color.mint, fontSize: 11, borderRadius: ds.radius.xs, padding: "2px 7px", border: `1px solid ${ds.color.mint}30`, fontFamily: ds.font.mono }}>
                {v.voiceName}
              </span>
            )}
            {!v.voiceId && (
              <span style={{ background: `${ds.color.gold}10`, color: ds.color.gold, fontSize: 11, borderRadius: ds.radius.xs, padding: "2px 7px", fontFamily: ds.font.mono }}>
                no voice ID
              </span>
            )}
          </div>

          {v.notes && (
            <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>{v.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          {/* Portrait image lightbox */}
          {portraitPreviewOpen && v.imageUrl && (
            <div
              onClick={() => setPortraitPreviewOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <img src={normalizeImageUrl(v.imageUrl)} alt={v.name} style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 12, objectFit: "contain", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }} />
              <p style={{ position: "absolute", bottom: 20, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Click to close</p>
            </div>
          )}
          {/* Per-character style picker */}
          {v.visualDescription && (
            <select
              value={charStyle}
              onChange={e => setCharStyle(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: `1px solid ${ds.color.line2}`, background: ds.color.card, color: ds.color.lilac, cursor: "pointer", fontFamily: ds.font.sans }}
            >
              <option value="3d-cinematic">3D Cinematic</option>
              <option value="realistic">Realistic</option>
              <option value="nollywood">Nollywood</option>
              <option value="2d-cartoon">2D Cartoon</option>
              <option value="anime">Anime</option>
              <option value="storybook">Storybook</option>
              <option value="comic">Comic</option>
            </select>
          )}
          {/* Generate / Regenerate Portrait */}
          {v.visualDescription && (
            <button
              disabled={genPortrait}
              onClick={async () => {
                setGenPortrait(true);
                try {
                  const res = await fetch(`/api/character-voices/${v.id}/generate-portrait`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ style: charStyle }),
                  });
                  const d = await res.json() as { imageUrl?: string; referenceImages?: ReferenceImage[]; shotsGenerated?: number; error?: string };
                  if (d.imageUrl) {
                    if (v.imageUrl) setPrevImage(v.imageUrl);
                    // Save main portrait + all 3 generated shots
                    onUpdate(v.id, {
                      imageUrl: d.imageUrl,
                      ...(d.referenceImages ? { referenceImages: d.referenceImages as unknown as null } : {}),
                    });
                  }
                } catch { /* ignore */ } finally { setGenPortrait(false); }
              }}
              style={{ background: `${ds.color.lilac}18`, color: ds.color.lilac, border: `1px solid ${ds.color.lilac}44`, borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: genPortrait ? "wait" : "pointer", fontFamily: ds.font.sans, opacity: genPortrait ? 0.6 : 1 }}
            >
              {genPortrait ? "Generating 3 shots…" : v.imageUrl ? "Regenerate (3 shots)" : "Generate Portrait (3 shots)"}
            </button>
          )}
          {/* Preview Portrait */}
          {v.imageUrl && (
            <button
              onClick={() => setPortraitPreviewOpen(true)}
              style={{ background: `${ds.color.lilac}08`, color: ds.color.lilac, border: `1px solid ${ds.color.lilac}33`, borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: ds.font.sans }}
            >
              Preview
            </button>
          )}
          {/* Undo Image */}
          {prevImage && (
            <button
              onClick={() => { onUpdate(v.id, { imageUrl: prevImage }); setPrevImage(null); }}
              style={{ background: "#f59e0b08", color: "#f59e0b", border: "1px solid #f59e0b40", borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: ds.font.sans }}
            >
              Undo Image
            </button>
          )}
          {/* Remove Image */}
          {v.imageUrl && (
            <button
              onClick={() => { setPrevImage(v.imageUrl!); onUpdate(v.id, { imageUrl: null }); }}
              style={{ background: "#ef444408", color: "#ef4444", border: "1px solid #ef444440", borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: ds.font.sans }}
            >
              Remove Image
            </button>
          )}
          {v.imageUrl && (
            <a
              href={`/dashboard/collaborative-editor?mode=image_to_video&characterId=${v.id}`}
              style={{ background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`, backgroundSize: "300% 100%", color: "white", border: "none", borderRadius: ds.radius.xs, padding: "5px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontFamily: ds.font.sans }}
            >
              Use in Studio
            </a>
          )}
          <a
            href={`/dashboard/character-voices/${v.id}`}
            style={{ background: ds.color.paper, color: ds.color.lilac, border: `1px solid ${ds.color.lilac}33`, borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontFamily: ds.font.sans }}
            title="Manage reference photos for this character"
          >
            Images
          </a>
          {[
            { href: `/dashboard/movie-planner?characterId=${v.id}`, label: "Movie" },
            { href: `/dashboard/hybrid-planner?characterId=${v.id}`, label: "Hybrid" },
            { href: `/dashboard/collaborative-editor?characterId=${v.id}`, label: "Editor" },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{ background: `${ds.color.mint}10`, color: ds.color.mint, border: `1px solid ${ds.color.mint}30`, borderRadius: ds.radius.xs, padding: "5px 10px", fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", fontFamily: ds.font.sans }}>
              {label}
            </a>
          ))}
          {onPreview && (
            <button
              onClick={() => onPreview(v)}
              style={{ background: ds.color.paper, color: ds.color.magenta, border: `1px solid ${ds.color.magenta}33`, borderRadius: ds.radius.xs, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: ds.font.sans }}
            >
              Preview + Send
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/character/export?id=${v.id}`);
                if (!res.ok) { alert("Export failed"); return; }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${(v.name || "character").replace(/[^a-zA-Z0-9_-]/g, "_")}_export.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch { alert("Download failed"); }
            }}
            style={{ background: ds.color.paper, color: ds.color.ink2, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: ds.font.sans }}
          >
            Download ZIP
          </button>
          <button
            onClick={() => onEdit(v.id)}
            style={{ background: ds.color.alert, color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: ds.font.sans }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(v.id, v.name)}
            style={{ background: "#2a1a1a", color: "#f87171", border: "1px solid #4a1a1a", borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: ds.font.sans }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Generated portrait shots gallery — shown after Generate Portrait runs */}
      {Array.isArray(v.referenceImages) && v.referenceImages.length > 0 && (() => {
        const refs = v.referenceImages as ReferenceImage[];
        const generated = refs.filter(r => r.label === "main" || r.label?.startsWith("variation_"));
        const photoImports = refs.filter(r => r.label === "photo-import");
        if (generated.length === 0 && photoImports.length === 0) return null;
        const ANGLE_LABEL: Record<string, string> = { front: "Front", "three-quarter": "3/4 View", closeup: "Close-up" };
        return (
          <div style={{ padding: "0 18px 14px" }}>
            {generated.length > 0 && (
              <>
                <p style={{ fontSize: 10, color: ds.color.mute2, fontFamily: ds.font.mono, marginBottom: 6 }}>
                  Generated shots ({generated.length}) — click any to set as main portrait
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {generated.map((r, i) => {
                    const isMain = r.url === v.imageUrl;
                    return (
                      <div key={i} style={{ position: "relative", cursor: "pointer" }}
                        onClick={() => onUpdate(v.id, { imageUrl: r.url })}
                        title={`Set as main portrait — ${ANGLE_LABEL[r.angle ?? ""] || r.angle || r.label}`}>
                        <img
                          src={normalizeImageUrl(r.url)}
                          alt={r.label}
                          style={{
                            width: 72, height: 96, objectFit: "cover", borderRadius: ds.radius.sm,
                            border: `2px solid ${isMain ? ds.color.lilac : ds.color.line2}`,
                            display: "block",
                          }}
                        />
                        <span style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          background: "rgba(0,0,0,0.65)", color: "#fff",
                          fontSize: 8, textAlign: "center", padding: "2px 0",
                          fontFamily: ds.font.mono,
                          borderBottomLeftRadius: ds.radius.sm, borderBottomRightRadius: ds.radius.sm,
                        }}>
                          {isMain ? "✓ MAIN" : (ANGLE_LABEL[r.angle ?? ""] || r.label)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {photoImports.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: ds.color.mute2, fontFamily: ds.font.mono }}>Photo ref:</span>
                {photoImports.map((r, i) => (
                  <img key={i} src={normalizeImageUrl(r.url)} alt="photo-import"
                    style={{ width: 28, height: 28, borderRadius: ds.radius.xs, objectFit: "cover", border: `1px solid ${ds.color.line2}` }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Pack seed widget ──────────────────────────────────────────
function PackWidget({
  label, emoji, description, entries, voices, seeding, seedMsg, color, onSeed,
}: {
  label: string; emoji: string; description: string; entries: PackEntry[];
  voices: CharacterVoice[]; seeding: boolean; seedMsg: string;
  color: string; onSeed: () => void;
}) {
  const voiceNames = new Set(voices.map(v => v.name));
  const loaded = entries.some(e => voiceNames.has(e.name));
  const allLoaded = entries.every(e => voiceNames.has(e.name));
  const bg = loaded ? `${color}0a` : ds.color.card;
  const borderColor = loaded ? `${color}44` : ds.color.line2;
  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: ds.radius.md, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{emoji}</span>
            <p style={{ color: loaded ? color : "#c0c0e0", fontSize: 14, fontWeight: 700 }}>{label}</p>
            {allLoaded && (
              <span style={{ background: `${color}22`, color, fontSize: 10, borderRadius: 4, padding: "1px 7px", border: `1px solid ${color}44` }}>
                Loaded
              </span>
            )}
          </div>
          <p style={{ color: ds.color.mute2, fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{description}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {entries.map(e => {
              const isIn = voiceNames.has(e.name);
              return (
                <span key={e.name} style={{
                  background: isIn ? `${color}18` : "#141420",
                  border: `1px solid ${isIn ? color + "44" : "#1e1e38"}`,
                  color: isIn ? color : "#3a3a5a",
                  borderRadius: 5, padding: "3px 9px", fontSize: 11,
                }}>
                  {isIn ? "✓" : "○"} {e.name.replace("_EN", "").replace("_WORLD", "").replace("NARRATOR_", "NARR ").replace(/_/g, " ")}
                </span>
              );
            })}
          </div>
          {seedMsg && <p style={{ color, fontSize: 12, marginTop: 8 }}>{seedMsg}</p>}
        </div>
        <button
          onClick={onSeed}
          disabled={seeding || allLoaded}
          style={{
            background: allLoaded ? `${color}18` : "#1a1020",
            border: `1px solid ${color}44`,
            borderRadius: 8, padding: "10px 18px", fontSize: 13,
            color: color,
            cursor: allLoaded ? "default" : "pointer",
            flexShrink: 0, opacity: seeding ? 0.6 : 1,
          }}
        >
          {seeding ? "Loading…" : allLoaded ? "✓ Active" : loaded ? "Load remaining" : "Load Pack"}
        </button>
      </div>
    </div>
  );
}

// ── AI Smart Builder types ───────────────────────────────────
interface SmartBuilderResult {
  voice: CharacterVoice;
  parsed: Record<string, unknown>;
  images: Array<{ angle: string; url: string; label: string }>;
  provider: string;
}

// Character type configs for guided mode
const CHAR_TYPE_OPTIONS = ["Human", "Animal", "Robot", "Fantasy", "Child", "Elder", "Custom"] as const;

const HUMAN_FIELDS = [
  { key: "gender", label: "Gender", options: ["male", "female", "boy", "girl"] },
  { key: "age", label: "Age", options: ["child", "teen", "young adult", "adult", "middle-aged", "elder"] },
  { key: "ethnicity", label: "Ethnicity / Nationality", options: ["American", "European", "British", "Latin American", "East Asian", "South Asian", "African", "Middle Eastern", "Caribbean", "Southeast Asian", "Pacific Islander", "Indigenous", "Mixed / Multiracial"] },
  { key: "skinTone", label: "Skin Tone", options: ["very dark", "dark brown", "medium brown", "light brown", "olive", "fair", "pale"] },
  { key: "height", label: "Height", options: ["short", "below average", "average", "above average", "tall", "very tall"] },
  { key: "build", label: "Build", options: ["slim", "lean", "athletic", "average", "stocky", "muscular", "heavyset"] },
  { key: "hair", label: "Hair", options: ["bald", "short cropped", "afro", "dreadlocks", "braids", "long straight", "curly", "wavy", "mohawk", "buzz cut", "grey/white"] },
  { key: "face", label: "Face", options: ["round", "oval", "angular", "square jaw", "kind eyes", "stern", "bearded", "clean-shaven", "scarred", "glasses"] },
  { key: "clothing", label: "Clothing", options: ["casual", "formal suit", "business casual", "streetwear", "military uniform", "traditional / cultural attire", "robes", "lab coat", "sports jersey", "fantasy / period costume"] },
  { key: "accessories", label: "Accessories", options: ["none", "watch", "necklace", "hat/cap", "earrings", "sunglasses", "staff/cane", "headwrap", "crown/headpiece", "weapon"] },
];

const ANIMAL_FIELDS = [
  { key: "species", label: "Species", options: ["dog", "cat", "rabbit", "lion", "eagle", "elephant", "monkey", "fox", "wolf", "bear", "horse", "snake", "owl"] },
  { key: "colorPattern", label: "Color / Pattern", options: ["white", "black", "brown", "golden", "grey", "spotted", "striped", "multi-colored", "albino", "calico"] },
  { key: "size", label: "Size", options: ["tiny", "small", "medium", "large", "huge"] },
  { key: "specialFeatures", label: "Special Features", options: ["wings", "horns", "long tail", "short tail", "big ears", "scars", "glowing eyes", "unusual markings", "crown/jewelry"] },
  { key: "personality", label: "Personality", options: ["brave", "mischievous", "wise", "gentle", "fierce", "playful", "loyal", "cunning", "shy", "noble"] },
];

const FANTASY_ROBOT_FIELDS = [
  { key: "style", label: "Style", options: ["futuristic", "steampunk", "medieval", "cyberpunk", "mythological", "cosmic", "tribal", "ancient", "post-apocalyptic"] },
  { key: "material", label: "Material", options: ["metal", "organic", "crystal", "stone", "energy/light", "wood", "bone", "holographic", "mixed"] },
  { key: "era", label: "Era", options: ["ancient", "medieval", "victorian", "modern", "near-future", "far-future", "timeless"] },
  { key: "specialFeatures", label: "Special Features", options: ["glowing eyes", "wings", "tail", "horns", "multiple arms", "floating parts", "aura/glow", "weapon integrated", "shape-shifting"] },
];

function getFieldsForType(type: string) {
  switch (type) {
    case "Human": case "Child": case "Elder": return HUMAN_FIELDS;
    case "Animal": return ANIMAL_FIELDS;
    case "Robot": case "Fantasy": return FANTASY_ROBOT_FIELDS;
    case "Custom": return HUMAN_FIELDS;
    default: return [];
  }
}

// ── Smart Builder Modal ──────────────────────────────────────
function SmartBuilderModal({ onClose, onCreated, returnUrl }: { onClose: () => void; onCreated: () => void; returnUrl?: string | null }) {
  const [mode, setMode] = useState<"free" | "guided">("free");
  const [freePrompt, setFreePrompt] = useState("");
  const [charType, setCharType] = useState("");
  const [guidedFields, setGuidedFields] = useState<Record<string, string>>({});
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [result, setResult] = useState<SmartBuilderResult | null>(null);
  const [imageModelId, setImageModelId] = useState("fal_flux_schnell");

  const setField = (key: string, val: string) => setGuidedFields(f => ({ ...f, [key]: val }));

  async function handleBuild() {
    setBuilding(true);
    setBuildError("");
    setResult(null);

    const payload = mode === "free"
      ? { prompt: freePrompt }
      : { type: charType, ...guidedFields };

    try {
      const res = await fetch("/api/character/smart-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, imageModelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBuildError(data.error || "Build failed");
        setBuilding(false);
        return;
      }
      setResult(data);
      onCreated();   // refresh parent list immediately — character already in DB
    } catch {
      setBuildError("Network error. Check connection.");
    } finally {
      setBuilding(false);
    }
  }

  const canBuild = mode === "free" ? freePrompt.trim().length > 10 : !!charType;
  const fields = charType ? getFieldsForType(charType) : [];

  const sbInputStyle = { background: ds.color.paper, color: ds.color.ink, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, padding: "6px 10px", fontSize: 13, width: "100%", fontFamily: ds.font.sans };
  const sbSelectStyle = { background: ds.color.card, color: ds.color.ink2, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, padding: "6px 8px", fontSize: 13, width: "100%", fontFamily: ds.font.sans };
  const sbLabelStyle = { fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4, fontFamily: ds.font.mono, textTransform: "uppercase" as const, letterSpacing: "0.08em" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: ds.color.card, border: `1px solid ${ds.color.lilac}33`, borderRadius: ds.radius.lg,
        maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto", padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ color: "#e0d0ff", fontSize: 18, fontWeight: 700, margin: 0 }}>
              AI Smart Builder
            </h2>
            <p style={{ color: "#6a5a8a", fontSize: 12, marginTop: 4 }}>
              Describe your character and AI will build a full profile with reference images
            </p>
          </div>
          <button
            onClick={() => { if (result) onCreated(); onClose(); }}
            style={{ background: "none", border: "none", color: "#6a5a8a", fontSize: 22, cursor: "pointer", padding: "4px 8px" }}
          >
            x
          </button>
        </div>

        {/* Result view */}
        {result ? (
          <div>
            <div style={{ background: ds.color.paper, border: `1px solid ${ds.color.lilac}33`, borderRadius: ds.radius.md, padding: 20, marginBottom: 16 }}>
              {/* Character header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ color: ds.color.ink, fontWeight: 700, fontSize: 16 }}>
                  {(result.parsed.displayName as string) || result.voice.name}
                </span>
                <span style={{
                  fontFamily: ds.font.mono, fontSize: 10, color: ds.color.magenta,
                  background: `${ds.color.magenta}12`, padding: "2px 8px", borderRadius: ds.radius.xs,
                  border: `1px solid ${ds.color.magenta}30`,
                }}>
                  {result.voice.characterId}
                </span>
                {result.voice.role && (
                  <span style={{
                    background: `${ds.color.lilac}12`, color: ds.color.lilac, fontSize: 10,
                    borderRadius: ds.radius.xs, padding: "2px 8px", border: `1px solid ${ds.color.lilac}30`,
                  }}>
                    {result.voice.role}
                  </span>
                )}
              </div>

              {/* Generated images */}
              {result.images.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  {result.images.map((img) => (
                    <div key={img.angle} style={{ textAlign: "center" }}>
                      <img
                        src={normalizeImageUrl(img.url)}
                        alt={img.label}
                        style={{
                          width: 180, height: 180, borderRadius: 10, objectFit: "cover",
                          border: "2px solid #3a2a5a",
                        }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <p style={{ fontSize: 10, color: "#6a5a8a", marginTop: 4 }}>{img.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.images.length === 0 && (
                <p style={{ fontSize: 12, color: "#4a4a6a", marginBottom: 12, fontStyle: "italic" }}>
                  No images generated (image provider may be offline). You can add reference images later.
                </p>
              )}

              {/* Visual description */}
              {result.voice.visualDescription && (
                <p style={{ fontSize: 13, color: "#a0a0c0", lineHeight: 1.6, marginBottom: 12 }}>
                  {result.voice.visualDescription}
                </p>
              )}

              {/* Character details grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Gender", val: result.voice.gender },
                  { label: "Age", val: result.voice.age },
                  { label: "Country", val: result.voice.country },
                  { label: "Tone", val: result.voice.toneClass },
                  { label: "Accent", val: result.voice.accent },
                  { label: "Role", val: result.voice.role },
                  { label: "Personality", val: result.voice.personality },
                  { label: "Wardrobe", val: (result.parsed.wardrobeStyle as string) },
                  { label: "Species", val: (result.parsed.species as string) },
                ].filter(x => x.val).map(x => (
                  <div key={x.label} style={{ background: "#12121a", borderRadius: 6, padding: "6px 10px" }}>
                    <span style={{ fontSize: 9, color: "#5a5a7a", display: "block" }}>{x.label}</span>
                    <span style={{ fontSize: 12, color: "#c0c0e0" }}>{x.val}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 10, color: "#3a3a5a" }}>
                LLM: {result.provider}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { onCreated(); onClose(); }}
                style={{
                  background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
                  backgroundSize: "300% 100%",
                  color: "#fff", border: "none", borderRadius: ds.radius.sm,
                  padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: ds.font.sans,
                }}
              >
                Done — Character Saved
              </button>
              <button
                onClick={() => { setResult(null); setBuildError(""); }}
                style={{
                  background: ds.color.alert, color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm,
                  padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: ds.font.sans,
                }}
              >
                Build Another
              </button>
              {/* Return to planner button (shown when navigated from a planner via ?returnTo=) */}
              {returnUrl && (
                <a href={returnUrl} style={{ textDecoration: "none" }}>
                  <button style={{
                    background: "#0ea5e920", color: "#0ea5e9", border: "1px solid #0ea5e940",
                    borderRadius: ds.radius.sm, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600,
                  }}>
                    ← Return to Planner
                  </button>
                </a>
              )}
              {/* Export dropdown */}
              <select
                defaultValue=""
                onChange={e => { if (e.target.value) window.location.href = e.target.value; }}
                style={{
                  background: "#1a2a1a", color: "#22c55e", border: "1px solid #2a4a2a",
                  borderRadius: 8, padding: "10px 12px", fontSize: 12, cursor: "pointer",
                }}
              >
                <option value="" disabled>Export to...</option>
                <option value={`/dashboard/collaborative-editor?characterId=${result.voice.id}`}>Collaborative Editor</option>
                <option value={`/dashboard/movie-planner?characterId=${result.voice.id}`}>Movie Planner</option>
                <option value={`/dashboard/music-video-planner?characterId=${result.voice.id}`}>Music Video Planner</option>
                <option value={`/dashboard/hybrid-planner?characterId=${result.voice.id}`}>Hybrid Planner</option>
                <option value={`/dashboard/short-video?characterId=${result.voice.id}`}>Short Video</option>
                <option value={`/dashboard/commercial?characterId=${result.voice.id}`}>Commercial</option>
                <option value={`/dashboard/children-video?characterId=${result.voice.id}`}>Children Video</option>
              </select>
            </div>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid #3a2a5a" }}>
              <button
                onClick={() => setMode("free")}
                style={{
                  flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: mode === "free" ? "#a855f7" : "#1a1a2e",
                  color: mode === "free" ? "#fff" : "#7070a0",
                  border: "none",
                }}
              >
                Option A: Free Prompt
              </button>
              <button
                onClick={() => setMode("guided")}
                style={{
                  flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: mode === "guided" ? "#a855f7" : "#1a1a2e",
                  color: mode === "guided" ? "#fff" : "#7070a0",
                  border: "none",
                }}
              >
                Option B: Guided Selection
              </button>
            </div>

            {/* Free prompt mode */}
            {mode === "free" && (
              <div>
                <label style={sbLabelStyle}>Describe your character in any way...</label>
                <textarea
                  value={freePrompt}
                  onChange={e => setFreePrompt(e.target.value)}
                  placeholder={"Examples:\n- smart fluffy rabbit with long teeth, off-colour tail, wears a tiny red vest, mischievous personality\n- male india fair 45 medium height beard calm face formal shirt\n- fierce African warrior queen, tall, dark skin, golden crown, leopard-print robe, commanding presence"}
                  rows={6}
                  style={{ ...sbInputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
                <p style={{ fontSize: 11, color: "#4a4a6a", marginTop: 6 }}>
                  Be as specific as you like. Include species, appearance, clothing, personality, backstory — the AI will parse it all.
                </p>
              </div>
            )}

            {/* Guided mode */}
            {mode === "guided" && (
              <div>
                <label style={sbLabelStyle}>Character Type</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {CHAR_TYPE_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => { setCharType(t); setGuidedFields({}); }}
                      style={{
                        background: charType === t ? "#a855f7" : "#1a1a2e",
                        color: charType === t ? "#fff" : "#9090b0",
                        border: `1px solid ${charType === t ? "#a855f7" : "#3a2a5a"}`,
                        borderRadius: 8, padding: "8px 16px", fontSize: 13,
                        cursor: "pointer", fontWeight: charType === t ? 700 : 400,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {charType && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {fields.map(f => (
                      <div key={f.key}>
                        <label style={sbLabelStyle}>{f.label}</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select
                            value={f.options.includes(guidedFields[f.key] || "") ? guidedFields[f.key] : ""}
                            onChange={e => setField(f.key, e.target.value)}
                            style={{ ...sbSelectStyle, flex: 1 }}
                          >
                            <option value="">-- Select --</option>
                            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <input
                            value={!f.options.includes(guidedFields[f.key] || "") ? (guidedFields[f.key] || "") : ""}
                            onChange={e => setField(f.key, e.target.value)}
                            placeholder="or type..."
                            style={{ ...sbInputStyle, flex: 1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {buildError && (
              <div style={{ background: "#2a1a1a", border: "1px solid #f87171", borderRadius: 8, padding: 12, marginTop: 16, color: "#f87171", fontSize: 13 }}>
                {buildError}
              </div>
            )}

            {/* Image model selector */}
            <div style={{ marginTop: 16, marginBottom: 4 }}>
              <label style={{ ...sbLabelStyle, marginBottom: 6 }}>Image Model (for portrait generation)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { id: "fal_flux_schnell", label: "Flux Schnell", price: "$0.003", color: "#22c55e" },
                  { id: "segmind_pruna", label: "Pruna P Image", price: "$0.005", color: "#7dd3fc" },
                  { id: "fal_flux_dev", label: "Flux Dev", price: "$0.025", color: "#f59e0b" },
                  { id: "fal_flux_pro", label: "Flux Pro", price: "$0.05", color: "#a855f7" },
                ].map(m => (
                  <button key={m.id} onClick={() => setImageModelId(m.id)} style={{ background: imageModelId === m.id ? "#1e1e38" : "transparent", border: `1px solid ${imageModelId === m.id ? m.color : "#2a2a40"}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: imageModelId === m.id ? m.color : "#6a6a8a", cursor: "pointer" }}>
                    {m.label} <span style={{ color: "#22c55e", fontSize: 10 }}>{m.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Build button */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={handleBuild}
                disabled={building || !canBuild}
                style={{
                  background: building ? "#6a3aaa" : "#a855f7",
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 24px", fontSize: 14, fontWeight: 600,
                  cursor: building || !canBuild ? "not-allowed" : "pointer",
                  opacity: !canBuild ? 0.5 : 1,
                }}
              >
                {building ? "Building character..." : "Build Character"}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "#2a2a40", color: "#9090b0", border: "none", borderRadius: 8,
                  padding: "10px 20px", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>

            {/* Building progress */}
            {building && (
              <div style={{ marginTop: 16, padding: 16, background: "#1a1020", border: "1px solid #3a2a5a", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 16, height: 16, border: "2px solid #a855f7", borderTop: "2px solid transparent",
                    borderRadius: "50%", animation: "spin 1s linear infinite",
                  }} />
                  <span style={{ color: "#a855f7", fontSize: 13 }}>
                    AI is analyzing your description, building character profile, and generating reference images...
                  </span>
                </div>
                <p style={{ color: "#4a3a6a", fontSize: 11, marginTop: 8 }}>
                  This may take 15-60 seconds depending on image generation.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
// ── Character Preview Modal ──────────────────────────────────
function CharacterPreviewModal({ character, onClose }: { character: CharacterVoice; onClose: () => void }) {
  const DESTINATIONS = [
    { label: "Movie Planner", path: "/dashboard/movie-planner" },
    { label: "Hybrid Planner", path: "/dashboard/hybrid-planner" },
    { label: "Children Planner", path: "/dashboard/children-planner" },
    { label: "Commercial", path: "/dashboard/commercial" },
    { label: "Collab Editor", path: "/dashboard/collaborative-editor" },
    { label: "Music Video", path: "/dashboard/music-video-planner" },
    { label: "Short Video", path: "/dashboard/short-video" },
    { label: "Viral Video", path: "/dashboard/viral-video" },
    { label: "Video Finishing", path: "/dashboard/video-finishing" },
  ];
  const roleColor = character.role ? (ROLE_BADGE_COLOR[character.role] ?? "#9090b0") : null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.lg, padding: 28, maxWidth: 540, width: "90%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 }}>{character.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6a6a8a", fontSize: 20, cursor: "pointer", padding: 4 }}>x</button>
        </div>

        {/* Character image + details */}
        <div style={{ display: "flex", gap: 18, marginBottom: 20 }}>
          <div style={{ width: 140, height: 140, borderRadius: 14, background: "#1a1a2e", border: "1px solid #2a2a50", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {character.imageUrl ? (
              <img src={normalizeImageUrl(character.imageUrl)} alt={character.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 32, opacity: 0.25, color: ds.color.mute, fontFamily: ds.font.mono }}>C</span>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {character.characterId && (
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#a855f7", background: "rgba(168,85,247,0.1)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(168,85,247,0.2)", alignSelf: "flex-start" }}>
                {character.characterId}
              </span>
            )}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {character.role && roleColor && (
                <span style={{ background: `${roleColor}18`, color: roleColor, fontSize: 11, borderRadius: 4, padding: "2px 8px", border: `1px solid ${roleColor}33` }}>
                  {character.role.replaceAll("_", " ")}
                </span>
              )}
              {[character.gender, character.toneClass, character.accent].filter(Boolean).map(tag => (
                <span key={tag} style={{ background: "#2a2a40", color: "#9090b0", fontSize: 11, borderRadius: 4, padding: "2px 8px" }}>
                  {tag}
                </span>
              ))}
            </div>
            {character.voiceName && (
              <span style={{ fontSize: 11, color: "#4ade80" }}>Voice: {character.voiceName}</span>
            )}
            {character.language && (
              <span style={{ fontSize: 11, color: "#60a5fa" }}>
                {LANGUAGE_OPTIONS.find(l => l.value === character.language)?.label ?? character.language}
              </span>
            )}
            {character.age && <span style={{ fontSize: 11, color: "#9090b0" }}>Age: {character.age}</span>}
            {character.personality && <span style={{ fontSize: 11, color: "#9090b0" }}>Personality: {character.personality}</span>}
          </div>
        </div>

        {/* Visual description */}
        {character.visualDescription && (
          <div style={{ background: "#0d0d18", border: "1px solid #1e1e38", borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: "#5a5a7a", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Visual Description</p>
            <p style={{ fontSize: 12, color: "#a0a0c0", lineHeight: 1.6, margin: 0 }}>{character.visualDescription}</p>
          </div>
        )}

        {/* Reference images */}
        {Array.isArray(character.referenceImages) && character.referenceImages.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: "#5a5a7a", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Reference Images</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(character.referenceImages as ReferenceImage[]).map(r => (
                <img key={r.angle} src={normalizeImageUrl(r.url)} alt={r.label} title={r.label} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40" }} />
              ))}
            </div>
          </div>
        )}

        {character.notes && (
          <p style={{ fontSize: 11, color: "#4a4a6a", marginBottom: 18 }}>{character.notes}</p>
        )}

        {/* Send to Planner buttons */}
        <div style={{ borderTop: "1px solid #1e1e38", paddingTop: 16 }}>
          <p style={{ fontSize: 10, color: "#5a5a7a", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Send to Planner</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DESTINATIONS.map(d => (
              <a
                key={d.path}
                href={`${d.path}?characterId=${character.id}`}
                style={{
                  background: `${ds.color.mint}10`, color: ds.color.mint, border: `1px solid ${ds.color.mint}30`,
                  borderRadius: ds.radius.sm, padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: ds.font.sans,
                }}
              >
                {d.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CharacterVoicesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#5a7080" }}>Loading Characters...</div>}>
      <CharacterVoicesInner />
    </Suspense>
  );
}

function CharacterVoicesInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const returnUrl = returnTo ? `/dashboard/${returnTo}` : null;

  const [voices, setVoices] = useState<CharacterVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSmartBuilder, setShowSmartBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewCharacter, setPreviewCharacter] = useState<CharacterVoice | null>(null);

  // Pack seeding state
  const [seedingPack, setSeedingPack] = useState<string | null>(null);
  const [seedMsgs, setSeedMsgs] = useState<Record<string, string>>({});
  const [fixingPortraits, setFixingPortraits] = useState(false);
  const [fixPortraitMsg, setFixPortraitMsg] = useState("");

  async function autoFixAllPortraits() {
    setFixingPortraits(true); setFixPortraitMsg("");
    try {
      const res = await fetch("/api/character-voices/auto-portraits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 20 }) });
      const d = await res.json() as { generated?: number; failed?: number; queued?: number; error?: string };
      if (d.error) { setFixPortraitMsg(`Error: ${d.error}`); }
      else { setFixPortraitMsg(`Generated ${d.generated ?? 0} portraits, ${d.failed ?? 0} failed`); load(); }
    } catch { setFixPortraitMsg("Failed to reach auto-portraits API"); }
    setFixingPortraits(false);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/character-voices");
      const data = await res.json();
      setVoices(data.voices ?? []);
    } catch {
      setError("Failed to load characters.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(form: Partial<CharacterVoice>) {
    setSaving(true); setError("");
    // Auto-generate characterId from country/name/age/skin/attribute
    const formExt = form as Partial<CharacterVoice> & { skinTone?: string; attribute?: string };
    const charId = form.name ? generateCharacterId({
      country: form.country ?? "",
      name: form.name,
      age: form.age ?? "",
      skinTone: formExt.skinTone ?? "",
      attribute: formExt.attribute ?? "",
    }) : undefined;
    const payload = { ...form, characterId: charId };
    const res = await fetch("/api/character-voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed"); setSaving(false); return; }
    setSaving(false); setShowForm(false); load();
  }

  async function handleUpdate(id: string, form: Partial<CharacterVoice>) {
    setSaving(true); setError("");
    const res = await fetch(`/api/character-voices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed"); setSaving(false); return; }
    setSaving(false); setEditingId(null); load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the character voice registry?`)) return;
    await fetch(`/api/character-voices/${id}`, { method: "DELETE" });
    load();
  }

  async function seedPack(packId: string, pack: PackEntry[]) {
    setSeedingPack(packId);
    setSeedMsgs(m => ({ ...m, [packId]: "" }));
    const existing = new Set(voices.map(v => v.name));
    const toCreate = pack.filter(p => !existing.has(p.name));
    if (toCreate.length === 0) {
      setSeedMsgs(m => ({ ...m, [packId]: "Pack already loaded." }));
      setSeedingPack(null);
      return;
    }
    const results = await Promise.all(
      toCreate.map(profile =>
        fetch("/api/character-voices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        })
      )
    );
    const created = results.filter(r => r.ok).length;
    setSeedMsgs(m => ({ ...m, [packId]: `Added ${created} character(s) to registry.` }));
    setSeedingPack(null);
    load();
  }

  const narrators  = voices.filter(v => v.isNarrator);
  const characters = voices.filter(v => !v.isNarrator);

  return (
    <div style={{ maxWidth: 900, fontFamily: ds.font.sans }}>
      {/* Return-to-planner banner — shown when user arrived via ?returnTo= link */}
      {returnUrl && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "#0ea5e910", border: "1px solid #0ea5e930" }}>
          <span style={{ fontSize: 12, color: "#0ea5e9" }}>Creating a character for your planner. After saving, click "Return to Planner".</span>
          <a href={returnUrl} style={{ textDecoration: "none" }}>
            <button style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #0ea5e940", background: "#0ea5e920", color: "#0ea5e9", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              ← Return to Planner
            </button>
          </a>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <HeroTitle kicker="Character Studio" title="Characters" italic="& Voices" sub="Manage actors, voices, and character profiles for consistent casting" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                style={{ background: ds.color.card, color: ds.color.lilac, border: `1px solid ${ds.color.lilac}44`, borderRadius: ds.radius.sm, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontFamily: ds.font.sans }}
              >
                + Add Character
              </button>
            )}
            <button
              onClick={autoFixAllPortraits}
              disabled={fixingPortraits}
              style={{ background: `${ds.color.lilac}18`, color: ds.color.lilac, border: `1px solid ${ds.color.lilac}44`, borderRadius: ds.radius.sm, padding: "8px 18px", fontSize: 13, cursor: fixingPortraits ? "wait" : "pointer", fontFamily: ds.font.sans, opacity: fixingPortraits ? 0.6 : 1 }}
            >
              {fixingPortraits ? "Generating…" : "Auto-Fix All Portraits"}
            </button>
            <button
              onClick={() => setShowSmartBuilder(true)}
              style={{
                background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
                backgroundSize: "300% 100%",
                color: "#fff", border: "none", borderRadius: ds.radius.sm,
                padding: "8px 18px", fontSize: 13, cursor: "pointer",
                fontWeight: 700, fontFamily: ds.font.sans,
              }}
            >
              AI Smart Builder
            </button>
          </div>
          {fixPortraitMsg && <p style={{ color: ds.color.mint, fontSize: 12, margin: 0 }}>{fixPortraitMsg}</p>}
        </div>
      </div>

      {error && (
        <div style={{ background: "#2a1a1a", border: "1px solid #f87171", borderRadius: 8, padding: 12, marginBottom: 16, color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Character Packs ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        <p style={{ color: ds.color.mute, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: ds.font.mono }}>Character Packs</p>

        <PackWidget
          label="Universal Narrator Pack"
          emoji=""
          description="5 age-group narrators: Child · Teen · Young Adult · Adult · Elder. Neutral global English. Voice IDs blank by default — paste your ElevenLabs cloned voice IDs after seeding."
          entries={UNIVERSAL_NARRATOR_PACK}
          voices={voices}
          seeding={seedingPack === "universal"}
          seedMsg={seedMsgs["universal"] ?? ""}
          color="#4ade80"
          onSeed={() => seedPack("universal", UNIVERSAL_NARRATOR_PACK)}
        />

        <PackWidget
          label="World Cinema — Character Pack"
          emoji=""
          description="5 universal drama characters: Hero · Heroine · Elder Figure · Villain · Sidekick. Global archetypes with visual descriptions and default ElevenLabs voices pre-assigned."
          entries={WORLD_CINEMA_PACK}
          voices={voices}
          seeding={seedingPack === "world"}
          seedMsg={seedMsgs["world"] ?? ""}
          color="#f472b6"
          onSeed={() => seedPack("world", WORLD_CINEMA_PACK)}
        />

        <PackWidget
          label="English Cinematic — Character Pack"
          emoji=""
          description="5 universal cinematic characters: Hero · Heroine · Mentor · Antagonist · English Narrator. Standard drama archetypes with ElevenLabs voices pre-assigned."
          entries={ENGLISH_CINEMATIC_PACK}
          voices={voices}
          seeding={seedingPack === "english"}
          seedMsg={seedMsgs["english"] ?? ""}
          color="#60a5fa"
          onSeed={() => seedPack("english", ENGLISH_CINEMATIC_PACK)}
        />
      </div>

      {/* ── Add character form ── */}
      {showForm && (
        <VoiceForm
          initial={{ ...BLANK }}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* ── Character list ── */}
      {loading ? (
        <p style={{ color: ds.color.mute, fontSize: 12, fontFamily: ds.font.mono }}>Loading…</p>
      ) : voices.length === 0 ? (
        <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.md, padding: 32, textAlign: "center" }}>
          <p style={{ color: ds.color.mute, fontSize: 13 }}>No characters registered yet.</p>
          <p style={{ color: ds.color.mute2, fontSize: 12, marginTop: 6 }}>Load a pack above or add characters manually.</p>
        </div>
      ) : (
        <>
          {narrators.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: ds.color.mute, fontSize: 10, fontWeight: 700, marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: ds.font.mono }}>
                Narrators <span style={{ color: ds.color.mute2, fontWeight: 400 }}>({narrators.length})</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {narrators.map(v => (
                  <VoiceCard key={v.id} v={v} onEdit={setEditingId} onDelete={handleDelete} editingId={editingId} onUpdate={handleUpdate} saving={saving} onPreview={setPreviewCharacter} />
                ))}
              </div>
            </div>
          )}
          {characters.length > 0 && (
            <div>
              <p style={{ color: ds.color.mute, fontSize: 10, fontWeight: 700, marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: ds.font.mono }}>
                Characters <span style={{ color: ds.color.mute2, fontWeight: 400 }}>({characters.length})</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {characters.map(v => (
                  <VoiceCard key={v.id} v={v} onEdit={setEditingId} onDelete={handleDelete} editingId={editingId} onUpdate={handleUpdate} saving={saving} onPreview={setPreviewCharacter} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Multi-voice script format guide ── */}
      <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.md, padding: 20, marginTop: 28 }}>
        <h3 style={{ color: ds.color.mute, fontSize: 11, fontWeight: 700, marginBottom: 12, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Multi-Voice Script Format</h3>
        <pre style={{ background: ds.color.paper, borderRadius: ds.radius.sm, padding: 14, fontSize: 12, color: ds.color.mute, overflow: "auto", fontFamily: ds.font.mono }}>
{`NARR_ADULT: "The city streets hummed with life that morning."
[AMBIENCE: city_ambient]
ELDER_FIGURE: "Stay close — this place holds secrets."
HERO_WORLD: "I understand. I won't let you down."
NARR_ADULT [emotional]: "He moved through the crowd, searching for answers."
[SFX: crowd_murmur]
VILLAIN_WORLD [commanding]: "Nobody leaves this city today."`}
        </pre>
        <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 8 }}>
          Characters not in the registry get auto-assigned default voices. Use <code style={{ color: ds.color.lilac, fontFamily: ds.font.mono }}>CHARACTER [style]:</code> for per-line speech direction.
        </p>
      </div>

      {/* ── Voice ID Guide ── */}
      <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.md, padding: 20, marginTop: 14 }}>
        <p style={{ color: ds.color.sky, fontSize: 11, fontWeight: 700, marginBottom: 10, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>How to get custom voice IDs</p>
        <ol style={{ color: ds.color.mute, fontSize: 12, lineHeight: 2, margin: 0, paddingLeft: 18 }}>
          <li>Go to <span style={{ color: ds.color.sky }}>elevenlabs.io</span> → Voice Lab → Create New Voice</li>
          <li>Record or upload audio samples of the voice you want (any language or accent)</li>
          <li>Name the cloned voice to match your character</li>
          <li>Copy the Voice ID from the voice settings page</li>
          <li>Come back here → Edit the character → Paste the voice ID → Preview to confirm</li>
        </ol>
        <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 10 }}>
          ElevenLabs supports 30+ languages. Clone any voice or pick from their built-in voice library.
        </p>
      </div>

      {/* ── AI Smart Builder Modal ── */}
      {showSmartBuilder && (
        <SmartBuilderModal
          onClose={() => setShowSmartBuilder(false)}
          onCreated={() => load()}
          returnUrl={returnUrl}
        />
      )}

      {/* ── Character Preview Modal ── */}
      {previewCharacter && (
        <CharacterPreviewModal character={previewCharacter} onClose={() => setPreviewCharacter(null)} />
      )}
    </div>
  );
}
