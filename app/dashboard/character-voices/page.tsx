"use client";

import { useEffect, useState } from "react";

interface ReferenceImage {
  url: string;
  angle: string;
  label: string;
}

interface CharacterVoice {
  id: string;
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
}

const GENDER_OPTIONS   = ["male", "female", "boy", "girl"];
const TONE_OPTIONS     = ["bass", "tenor", "soft", "commanding", "elder", "youthful", "raspy", "smooth"];
const ACCENT_OPTIONS   = ["american", "british", "african", "nigerian", "naija", "neutral", "west_african"];
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
  { value: "en",             label: "English" },
  { value: "nigerian_pidgin",label: "Nigerian Pidgin (Naija)" },
  { value: "pidgin",         label: "Pidgin (general)" },
  { value: "yo",             label: "Yoruba" },
  { value: "ig",             label: "Igbo" },
  { value: "ha",             label: "Hausa" },
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

type PackEntry = Omit<CharacterVoice, "id" | "referenceImages">;

// Nigerian Pidgin narrator pack — 5 age-group narrators
const NIGERIAN_PIDGIN_PACK: PackEntry[] = [
  {
    name: "NARRATOR_CHILD_PIDGIN", gender: "girl", toneClass: "youthful",
    accent: "naija", language: "nigerian_pidgin", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Child narrator, Nigerian Pidgin English. Ages 8–12. Light, curious tone. Paste your ElevenLabs cloned voice ID when ready.",
  },
  {
    name: "NARRATOR_TEEN_PIDGIN", gender: "male", toneClass: "youthful",
    accent: "naija", language: "nigerian_pidgin", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Teen narrator, Nigerian Pidgin. Ages 13–17. Street energy, casual Naija flow. Paste your ElevenLabs cloned voice ID when ready.",
  },
  {
    name: "NARRATOR_YOUTH_PIDGIN", gender: "male", toneClass: "tenor",
    accent: "naija", language: "nigerian_pidgin", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "normal",
    imageUrl: null, visualDescription: null,
    notes: "Young adult narrator, Nigerian Pidgin. Ages 18–28. Energetic, confident urban Naija voice.",
  },
  {
    name: "NARRATOR_ADULT_PIDGIN", gender: "male", toneClass: "commanding",
    accent: "naija", language: "nigerian_pidgin", voiceId: null, voiceName: null,
    isNarrator: true, role: "narrator", defaultSpeechStyle: "commanding",
    imageUrl: null, visualDescription: null,
    notes: "Adult narrator, Nigerian Pidgin. Ages 30–50. Grounded, authoritative Naija delivery.",
  },
  {
    name: "NARRATOR_ELDER_PIDGIN", gender: "male", toneClass: "elder",
    accent: "naija", language: "nigerian_pidgin", voiceId: null, voiceName: null,
    isNarrator: true, role: "elder", defaultSpeechStyle: "emotional",
    imageUrl: null, visualDescription: null,
    notes: "Elder narrator, Nigerian Pidgin. Ages 55+. Deep, wise elder voice. Steady pace.",
  },
];

// African Cinema character pack — archetypal characters for African drama
const AFRICAN_CINEMA_PACK: PackEntry[] = [
  {
    name: "HERO_AFRIKAN", gender: "male", toneClass: "commanding",
    accent: "african", language: "en", voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam",
    isNarrator: false, role: "protagonist", defaultSpeechStyle: "commanding",
    imageUrl: null,
    visualDescription: "Tall, strong Black African man in his 30s. Determined gaze. Traditional and modern clothing mix.",
    notes: "Lead male hero. Voices the hero's journey. Confident, purposeful delivery.",
  },
  {
    name: "HEROINE_AFRIKAN", gender: "female", toneClass: "commanding",
    accent: "african", language: "en", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah",
    isNarrator: false, role: "protagonist", defaultSpeechStyle: "emotional",
    imageUrl: null,
    visualDescription: "Confident Black African woman in her late 20s to 30s. Strong presence. Traditional attire with modern edge.",
    notes: "Lead female hero. Emotional range — warm and fierce depending on scene.",
  },
  {
    name: "MAMA_FIGURE", gender: "female", toneClass: "elder",
    accent: "african", language: "en", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah",
    isNarrator: false, role: "elder", defaultSpeechStyle: "emotional",
    imageUrl: null,
    visualDescription: "Older African woman, 50s-60s. Warm, maternal. Wrapper and head tie. Wise eyes.",
    notes: "The mother/elder archetype. Gentle but firm. Carries cultural weight in dialogue.",
  },
  {
    name: "VILLAIN_AFRIKAN", gender: "male", toneClass: "bass",
    accent: "african", language: "en", voiceId: "VR6AewLTigWG4xSOukaG", voiceName: "Arnold",
    isNarrator: false, role: "antagonist", defaultSpeechStyle: "commanding",
    imageUrl: null,
    visualDescription: "Imposing African man, 40s-50s. Sharp features, expensive dark suit. Cold, calculating gaze.",
    notes: "The antagonist. Measured, menacing delivery. Speaks with authority and threat.",
  },
  {
    name: "STREET_YOUTH_AFRIKAN", gender: "male", toneClass: "youthful",
    accent: "naija", language: "en", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh",
    isNarrator: false, role: "supporting", defaultSpeechStyle: "normal",
    imageUrl: null,
    visualDescription: "Young African man, early 20s. Street-smart energy. Casual urban clothing, quick eyes.",
    notes: "Street-level supporting character. Fast delivery, casual energy, comic potential.",
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
      style={{ background: "#1a1a2e", color: "#ccc", border: "1px solid #2a2a40", borderRadius: 6, padding: "6px 8px", fontSize: 13, width: "100%" }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
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
  const [form, setForm] = useState<Partial<CharacterVoice>>(initial);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const set = (k: keyof CharacterVoice, v: string | boolean | null) =>
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

  const inputStyle = { background: "#12121a", color: "#fff", border: "1px solid #2a2a40", borderRadius: 6, padding: "6px 10px", fontSize: 13, width: "100%" };
  const labelStyle = { fontSize: 11, color: "#7070a0", display: "block", marginBottom: 4 } as const;
  const selectStyle = { background: "#1a1a2e", color: "#ccc", border: "1px solid #2a2a40", borderRadius: 6, padding: "6px 8px", fontSize: 13, width: "100%" };

  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 10, padding: 20, marginBottom: 16 }}>

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
              src={form.imageUrl}
              alt="preview"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40", flexShrink: 0 }}
            />
          )}
        </div>
        {uploadError && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{uploadError}</p>}
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
          placeholder="e.g. Tall Nigerian man in his 30s, wearing agbada, confident gaze, strong build"
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
          placeholder="e.g. Nigerian elder, speaks slowly in Pidgin"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name}
          style={{ background: "#7c5cfc", color: "#fff", border: "none", borderRadius: 7, padding: "8px 20px", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save Character"}
        </button>
        <button
          onClick={onCancel}
          style={{ background: "#2a2a40", color: "#9090b0", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Character card ────────────────────────────────────────────
const ROLE_BADGE_COLOR: Record<string, string> = {
  protagonist:  "#7c5cfc",
  antagonist:   "#f87171",
  narrator:     "#60a5fa",
  supporting:   "#9090b0",
  elder:        "#facc15",
  child:        "#4ade80",
  comic_relief: "#fb923c",
};

function VoiceCard({ v, onEdit, onDelete, editingId, onUpdate, saving }: {
  v: CharacterVoice;
  onEdit: (id: string | null) => void;
  onDelete: (id: string, name: string) => void;
  editingId: string | null;
  onUpdate: (id: string, form: Partial<CharacterVoice>) => void;
  saving: boolean;
}) {
  const isPidgin = v.language === "nigerian_pidgin";
  const roleColor = v.role ? (ROLE_BADGE_COLOR[v.role] ?? "#9090b0") : null;

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
      background: isPidgin ? "#0d130d" : "#1a1a2e",
      border: `1px solid ${isPidgin ? "#1a3a1a" : "#2a2a40"}`,
      borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px" }}>

        {/* Portrait image or placeholder */}
        <div style={{ flexShrink: 0 }}>
          {v.imageUrl ? (
            <img
              src={v.imageUrl}
              alt={v.name}
              onError={e => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display = "none"; }}
              style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1px solid #2a2a40" }}
            />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 8, background: "#12121a", border: "1px solid #2a2a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#3a3a5a" }}>
              {v.isNarrator ? "🎙" : "👤"}
            </div>
          )}
        </div>

        {/* Identity column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            {isPidgin && <span>🇳🇬</span>}
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{v.name}</span>
            {v.isNarrator && (
              <span style={{ background: "#7c5cfc22", color: "#7c5cfc", fontSize: 10, borderRadius: 4, padding: "1px 6px", border: "1px solid #7c5cfc44" }}>
                NARRATOR
              </span>
            )}
            {v.role && roleColor && (
              <span style={{ background: `${roleColor}18`, color: roleColor, fontSize: 10, borderRadius: 4, padding: "1px 6px", border: `1px solid ${roleColor}33` }}>
                {v.role.replaceAll("_", " ")}
              </span>
            )}
            {v.defaultSpeechStyle && v.defaultSpeechStyle !== "normal" && (
              <span style={{ background: "#1a2a3a", color: "#60a5fa", fontSize: 10, borderRadius: 4, padding: "1px 6px", border: "1px solid #2a3a5a" }}>
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
            {[v.gender, v.toneClass, v.accent].filter(Boolean).map(tag => (
              <span key={tag} style={{ background: "#2a2a40", color: "#9090b0", fontSize: 11, borderRadius: 4, padding: "2px 7px" }}>
                {tag}
              </span>
            ))}
            {v.language && (
              <span style={{ background: isPidgin ? "#1a2a1a" : "#2a2a40", color: isPidgin ? "#4ade80" : "#9090b0", fontSize: 11, borderRadius: 4, padding: "2px 7px", border: isPidgin ? "1px solid #2a4a2a" : "none" }}>
                {LANGUAGE_OPTIONS.find(l => l.value === v.language)?.label ?? v.language}
              </span>
            )}
            {v.voiceName && (
              <span style={{ background: "#1a2a1a", color: "#4ade80", fontSize: 11, borderRadius: 4, padding: "2px 7px", border: "1px solid #2a4a2a" }}>
                {v.voiceName}
              </span>
            )}
            {!v.voiceId && (
              <span style={{ background: "#2a2a1a", color: "#facc15", fontSize: 11, borderRadius: 4, padding: "2px 7px" }}>
                no voice ID
              </span>
            )}
          </div>

          {v.notes && (
            <p style={{ fontSize: 11, color: "#4a4a6a", marginTop: 4 }}>{v.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <a
            href={`/dashboard/character-voices/${v.id}`}
            style={{ background: "#1a1a2e", color: "#7c5cfc", border: "1px solid #2a2a50", borderRadius: 6, padding: "5px 12px", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            title="Manage reference photos for this character"
          >
            📷 Images
          </a>
          <button
            onClick={() => onEdit(v.id)}
            style={{ background: "#2a2a40", color: "#9090b0", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(v.id, v.name)}
            style={{ background: "#2a1a1a", color: "#f87171", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Remove
          </button>
        </div>
      </div>

      {/* Reference image thumbnail strip */}
      {Array.isArray(v.referenceImages) && v.referenceImages.length > 0 && (
        <div style={{ display: "flex", gap: 4, padding: "0 18px 12px", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#3a3a5a", marginRight: 2 }}>Ref photos:</span>
          {(v.referenceImages as ReferenceImage[]).map(r => (
            <img
              key={r.angle}
              src={r.url}
              alt={r.label}
              title={r.label}
              style={{ width: 28, height: 28, borderRadius: 5, objectFit: "cover", border: "1px solid #1e1e38" }}
            />
          ))}
          <a
            href={`/dashboard/character-voices/${v.id}`}
            style={{ fontSize: 10, color: "#5a5a7a", marginLeft: 4, textDecoration: "none" }}
          >
            {(v.referenceImages as ReferenceImage[]).length}/5 →
          </a>
        </div>
      )}
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
  const bg = loaded ? `${color}0a` : "#0f0f1a";
  const border = loaded ? `${color}44` : "#1e1e38";
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 18 }}>
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
          <p style={{ color: "#4a4a6a", fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{description}</p>
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
                  {isIn ? "✓" : "○"} {e.name.replace("_EN", "").replace("_AFRIKAN", "").replace("_PIDGIN", "").replace("NARRATOR_", "NARR ").replace(/_/g, " ")}
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

// ── Main page ────────────────────────────────────────────────
export default function CharacterVoicesPage() {
  const [voices, setVoices] = useState<CharacterVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pack seeding state
  const [seedingPack, setSeedingPack] = useState<string | null>(null);
  const [seedMsgs, setSeedMsgs] = useState<Record<string, string>>({});

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
    const res = await fetch("/api/character-voices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="text-white font-bold" style={{ fontSize: 22 }}>Character Voice Registry</h1>
          <p style={{ fontSize: 13, color: "#7070a0", marginTop: 4 }}>
            Full character profiles — voice, appearance, role, and speech style — for consistent multi-voice casting.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ background: "#7c5cfc", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}
          >
            + Add Character
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#2a1a1a", border: "1px solid #f87171", borderRadius: 8, padding: 12, marginBottom: 16, color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Character Packs ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        <p style={{ color: "#5a5a7a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Character Packs</p>

        <PackWidget
          label="Nigerian Pidgin English — Narrator Pack"
          emoji="🇳🇬"
          description="5 age-group narrators: Child · Teen · Young Adult · Adult · Elder. Naija accent + Nigerian Pidgin. Voice IDs blank by default — paste your ElevenLabs cloned voice IDs after seeding."
          entries={NIGERIAN_PIDGIN_PACK}
          voices={voices}
          seeding={seedingPack === "pidgin"}
          seedMsg={seedMsgs["pidgin"] ?? ""}
          color="#4ade80"
          onSeed={() => seedPack("pidgin", NIGERIAN_PIDGIN_PACK)}
        />

        <PackWidget
          label="African Cinema — Character Pack"
          emoji="🎬"
          description="5 archetypal African drama characters: Hero · Heroine · Mama Figure · Villain · Street Youth. Pre-configured with African accent, visual descriptions, and default ElevenLabs voices."
          entries={AFRICAN_CINEMA_PACK}
          voices={voices}
          seeding={seedingPack === "african"}
          seedMsg={seedMsgs["african"] ?? ""}
          color="#f472b6"
          onSeed={() => seedPack("african", AFRICAN_CINEMA_PACK)}
        />

        <PackWidget
          label="English Cinematic — Character Pack"
          emoji="🎭"
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
        <p style={{ color: "#5a5a7a", fontSize: 13 }}>Loading…</p>
      ) : voices.length === 0 ? (
        <div style={{ background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 10, padding: 32, textAlign: "center" }}>
          <p style={{ color: "#5a5a7a", fontSize: 13 }}>No characters registered yet.</p>
          <p style={{ color: "#3a3a5a", fontSize: 12, marginTop: 6 }}>Load a pack above or add characters manually.</p>
        </div>
      ) : (
        <>
          {narrators.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: "#7070a0", fontSize: 11, fontWeight: 600, marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                ◉ Narrators <span style={{ color: "#3a3a5a", fontWeight: 400 }}>({narrators.length})</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {narrators.map(v => (
                  <VoiceCard key={v.id} v={v} onEdit={setEditingId} onDelete={handleDelete} editingId={editingId} onUpdate={handleUpdate} saving={saving} />
                ))}
              </div>
            </div>
          )}
          {characters.length > 0 && (
            <div>
              <p style={{ color: "#7070a0", fontSize: 11, fontWeight: 600, marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Characters <span style={{ color: "#3a3a5a", fontWeight: 400 }}>({characters.length})</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {characters.map(v => (
                  <VoiceCard key={v.id} v={v} onEdit={setEditingId} onDelete={handleDelete} editingId={editingId} onUpdate={handleUpdate} saving={saving} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Multi-voice script format guide ── */}
      <div style={{ background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 10, padding: 20, marginTop: 28 }}>
        <h3 style={{ color: "#9090b0", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Multi-Voice Script Format</h3>
        <pre style={{ background: "#12121a", borderRadius: 6, padding: 14, fontSize: 12, color: "#a0a0c0", overflow: "auto" }}>
{`NARRATOR_ADULT_PIDGIN: "The market dey full with noise that morning."
[AMBIENCE: market_noise]
MAMA_FIGURE: "Chukwuemeka, come help me carry dis bag!"
HERO_AFRIKAN: "Yes Mama, I dey come."
NARRATOR_ADULT_PIDGIN [emotional]: "E run through the crowd, dodging traders and pickin."
[SFX: crowd_murmur]
VILLAIN_AFRIKAN [commanding]: "Nobody leaves this market today."`}
        </pre>
        <p style={{ fontSize: 11, color: "#3a3a5a", marginTop: 8 }}>
          Characters not in the registry get auto-assigned default voices. Use <code style={{ color: "#7c5cfc" }}>CHARACTER [style]:</code> for per-line speech direction.
        </p>
      </div>

      {/* ── Nigerian Pidgin Voice ID Guide ── */}
      <div style={{ background: "#0d130d", border: "1px solid #1a3a1a", borderRadius: 10, padding: 20, marginTop: 14 }}>
        <p style={{ color: "#4ade80", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🇳🇬 How to get Nigerian Pidgin voice IDs</p>
        <ol style={{ color: "#4a6a4a", fontSize: 12, lineHeight: 2, margin: 0, paddingLeft: 18 }}>
          <li>Go to <span style={{ color: "#60a5fa" }}>elevenlabs.io</span> → Voice Lab → Create New Voice</li>
          <li>Record or upload audio samples of the voice you want (child, teen, adult etc.)</li>
          <li>Name the cloned voice matching the age group</li>
          <li>Copy the Voice ID from the voice settings page</li>
          <li>Come back here → Edit the narrator profile → Paste the voice ID → Preview to confirm</li>
        </ol>
        <p style={{ color: "#2a4a2a", fontSize: 11, marginTop: 10 }}>
          ElevenLabs does not have a built-in Nigerian Pidgin model — cloned voices give the most authentic result.
        </p>
      </div>
    </div>
  );
}
