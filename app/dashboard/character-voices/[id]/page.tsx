"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

interface ReferenceImage {
  url: string;
  angle: string;
  label: string;
}

interface CharacterVoice {
  id: string;
  name: string;
  role: string | null;
  gender: string | null;
  toneClass: string | null;
  accent: string | null;
  language: string | null;
  voiceId: string | null;
  voiceName: string | null;
  isNarrator: boolean;
  imageUrl: string | null;
  visualDescription: string | null;
  defaultSpeechStyle: string | null;
  notes: string | null;
  referenceImages: ReferenceImage[] | null;
}

const ANGLE_SLOTS: { angle: string; label: string; hint: string }[] = [
  { angle: "front",               label: "Front face",   hint: "Straight-on, both eyes visible. Primary reference." },
  { angle: "three_quarter_left",  label: "3/4 Left",     hint: "Face turned ~45° left." },
  { angle: "three_quarter_right", label: "3/4 Right",    hint: "Face turned ~45° right." },
  { angle: "profile",             label: "Side profile", hint: "Full side view, one eye visible." },
  { angle: "full_body_front",     label: "Full body",    hint: "Head-to-toe, facing camera." },
];

const ROLE_BADGE_COLOR: Record<string, string> = {
  protagonist:  "#7c5cfc",
  antagonist:   "#f87171",
  narrator:     "#60a5fa",
  supporting:   "#9090b0",
  elder:        "#facc15",
  child:        "#4ade80",
  comic_relief: "#fb923c",
};

export default function CharacterImagesPage() {
  const params = useParams();
  const id = params.id as string;

  const [character, setCharacter] = useState<CharacterVoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upload state
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState<string | null>(null); // angle being generated
  const [genError, setGenError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/character-voices/${id}`);
      if (!res.ok) { setError("Character not found."); return; }
      const data = await res.json();
      setCharacter(data.voice);
      // Only seed aiPrompt on first load — don't overwrite if user has already typed something
      if (data.voice.visualDescription && !aiPrompt) {
        setAiPrompt(data.voice.visualDescription);
      }
    } catch {
      setError("Failed to load character.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadImage(angle: string, file: File) {
    setUploading(angle);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("angle", angle);
    try {
      const res = await fetch(`/api/character-voices/${id}/upload-reference`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Upload failed.");
        return;
      }
      const data = await res.json();
      setCharacter(data.voice);
      setError("");
    } catch {
      setError("Upload failed. Check connection.");
    } finally {
      setUploading(null);
    }
  }

  async function deleteImage(angle: string) {
    setDeleting(angle);
    try {
      await fetch(`/api/character-voices/${id}/upload-reference`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ angle }),
      });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  async function generateImage(angle: string) {
    if (!aiPrompt.trim()) {
      setGenError("Enter a visual description before generating.");
      return;
    }
    setGenerating(angle);
    setGenError("");
    try {
      const res = await fetch(`/api/character-voices/${id}/generate-images`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ angle, prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Generation failed.");
        return;
      }
      setCharacter(data.voice);
    } catch {
      setGenError("Generation failed. Is ComfyUI running at port 8188?");
    } finally {
      setGenerating(null);
    }
  }

  function handleFiles(angle: string, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    uploadImage(angle, file);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 820, paddingTop: 16 }}>
        <p style={{ color: "#5a5a7a", fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (!character) {
    return (
      <div style={{ maxWidth: 820, paddingTop: 16 }}>
        <p style={{ color: "#f87171", fontSize: 13 }}>{error || "Character not found."}</p>
        <a href="/dashboard/character-voices" style={{ color: "#7c5cfc", fontSize: 13 }}>← Back to Characters</a>
      </div>
    );
  }

  const refImages: ReferenceImage[] = Array.isArray(character.referenceImages) ? character.referenceImages : [];
  const roleColor = character.role ? (ROLE_BADGE_COLOR[character.role] ?? "#9090b0") : null;
  const loadedCount = refImages.length;
  const isGeneratingAny = generating !== null;

  return (
    <div style={{ maxWidth: 820 }}>

      {/* Back link */}
      <a
        href="/dashboard/character-voices"
        style={{ fontSize: 12, color: "#5a5a7a", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}
      >
        ← All Characters
      </a>

      {/* Character header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{ flexShrink: 0 }}>
          {character.imageUrl ? (
            <img
              src={character.imageUrl}
              alt={character.name}
              style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid #2a2a40" }}
            />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 12, background: "#1a1a2e", border: "1px solid #2a2a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
              {character.isNarrator ? "🎙" : "👤"}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
            <h1 style={{ color: "#fff", fontWeight: 700, fontSize: 22, margin: 0 }}>{character.name}</h1>
            {character.isNarrator && (
              <span style={{ background: "#7c5cfc22", color: "#7c5cfc", fontSize: 10, borderRadius: 4, padding: "2px 7px", border: "1px solid #7c5cfc44" }}>NARRATOR</span>
            )}
            {character.role && roleColor && (
              <span style={{ background: `${roleColor}18`, color: roleColor, fontSize: 11, borderRadius: 4, padding: "2px 8px", border: `1px solid ${roleColor}33` }}>
                {character.role.replaceAll("_", " ")}
              </span>
            )}
            {character.defaultSpeechStyle && (
              <span style={{ background: "#1a2a3a", color: "#60a5fa", fontSize: 11, borderRadius: 4, padding: "2px 8px", border: "1px solid #2a3a5a" }}>
                {character.defaultSpeechStyle}
              </span>
            )}
          </div>
          {character.visualDescription && (
            <p style={{ fontSize: 12, color: "#6070a0", fontStyle: "italic", marginBottom: 4 }}>{character.visualDescription}</p>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[character.gender, character.toneClass, character.accent, character.voiceName].filter(Boolean).map(tag => (
              <span key={tag} style={{ background: "#2a2a40", color: "#9090b0", fontSize: 11, borderRadius: 4, padding: "2px 7px" }}>{tag}</span>
            ))}
          </div>
        </div>

        <a
          href="/dashboard/character-voices"
          style={{ background: "#2a2a40", color: "#9090b0", fontSize: 12, borderRadius: 7, padding: "6px 14px", textDecoration: "none", flexShrink: 0 }}
        >
          Edit profile
        </a>
      </div>

      {/* Errors */}
      {error && (
        <div style={{ background: "#2a1a1a", border: "1px solid #f87171", borderRadius: 8, padding: 10, marginBottom: 16, color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── AI Generation panel ──────────────────────────────────────── */}
      <div style={{ background: "#0d0d1f", border: "1px solid #2a1a5a", borderRadius: 12, padding: "16px 18px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 15 }}>✦</span>
          <p style={{ color: "#a080ff", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Generate with Flux.1
          </p>
          <span style={{ fontSize: 10, background: "#1a1030", color: "#6040b0", borderRadius: 4, padding: "1px 7px", border: "1px solid #2a1a5a" }}>
            ComfyUI · localhost:8188
          </span>
        </div>

        <p style={{ fontSize: 11, color: "#4a4a7a", marginBottom: 10, lineHeight: 1.5 }}>
          Describe the character visually. Each angle slot gets its own camera direction added automatically.
          Generation takes ~30–60s per image.
        </p>

        <textarea
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="e.g. Nigerian woman in her 30s, natural afro hair, wearing a red ankara blouse, warm brown eyes, confident expression"
          rows={3}
          style={{
            width: "100%", background: "#12102a", border: "1px solid #2a1a5a",
            borderRadius: 8, padding: "10px 12px", color: "#d0c0ff",
            fontSize: 12, resize: "vertical", outline: "none",
            fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
          }}
        />

        {genError && (
          <p style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>{genError}</p>
        )}

        {isGeneratingAny && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: "#7c5cfc",
              animation: "pulse 1.2s ease-in-out infinite",
            }} />
            <p style={{ color: "#7c5cfc", fontSize: 11, margin: 0 }}>
              Generating {ANGLE_SLOTS.find(s => s.angle === generating)?.label ?? generating}… this may take up to 60s
            </p>
          </div>
        )}
      </div>

      {/* ── Reference images grid ────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <p style={{ color: "#7070a0", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Reference Images
          </p>
          <span style={{ fontSize: 10, background: loadedCount > 0 ? "#7c5cfc22" : "#1a1a2e", color: loadedCount > 0 ? "#7c5cfc" : "#3a3a5a", borderRadius: 4, padding: "1px 7px", border: `1px solid ${loadedCount > 0 ? "#7c5cfc44" : "#2a2a40"}` }}>
            {loadedCount} / {ANGLE_SLOTS.length} uploaded
          </span>
        </div>
        <p style={{ fontSize: 11, color: "#3a3a5a", marginBottom: 16, lineHeight: 1.5 }}>
          Used as character reference for Runway, Kling, and Veo to maintain consistent casting across scenes.
          Upload manually or generate with Flux.1 above.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 12 }}>
          {ANGLE_SLOTS.map(slot => {
            const existing    = refImages.find(r => r.angle === slot.angle);
            const isUploading = uploading  === slot.angle;
            const isDeleting  = deleting   === slot.angle;
            const isGenerating = generating === slot.angle;
            const isDragOver  = dragOver   === slot.angle;

            return (
              <div
                key={slot.angle}
                onDragOver={e => { e.preventDefault(); setDragOver(slot.angle); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(null);
                  handleFiles(slot.angle, e.dataTransfer.files);
                }}
                style={{
                  background:   isDragOver ? "#1a1a3e" : existing ? "#0d130d" : "#0f0f1a",
                  border:       `1px solid ${isDragOver ? "#7c5cfc" : existing ? "#1a3a1a" : "#1e1e38"}`,
                  borderRadius: 12,
                  overflow:     "hidden",
                  transition:   "border-color 0.15s, background 0.15s",
                }}
              >
                {/* Image area */}
                <div style={{ position: "relative", height: 148, background: "#12121a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {existing ? (
                    <>
                      <img
                        src={existing.url}
                        alt={slot.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      <button
                        onClick={() => deleteImage(slot.angle)}
                        disabled={isDeleting}
                        style={{
                          position: "absolute", top: 6, right: 6,
                          background: "rgba(0,0,0,0.7)", border: "1px solid #f87171",
                          borderRadius: 5, padding: "2px 7px", fontSize: 10,
                          color: "#f87171", cursor: "pointer", opacity: isDeleting ? 0.5 : 1,
                        }}
                      >
                        {isDeleting ? "…" : "✕"}
                      </button>
                      <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(74,222,128,0.9)", color: "#0a1a0a", fontSize: 9, borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>
                        LOADED
                      </span>
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: 12 }}>
                      {isUploading || isGenerating ? (
                        <div>
                          <p style={{ color: "#7c5cfc", fontSize: 11, marginBottom: 4 }}>
                            {isGenerating ? "Generating…" : "Uploading…"}
                          </p>
                          {isGenerating && (
                            <p style={{ color: "#4a3a7a", fontSize: 9 }}>Flux.1 running</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <p style={{ fontSize: 24, marginBottom: 6 }}>📷</p>
                          <p style={{ fontSize: 10, color: "#3a3a5a", lineHeight: 1.4 }}>{slot.hint}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Slot label + action buttons */}
                <div style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 11, color: existing ? "#4ade80" : "#5a5a7a", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    {slot.label}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {/* Upload button */}
                    <label style={{
                      flex: 1, textAlign: "center",
                      fontSize: 10, background: "#1a1a2e", border: "1px solid #2a2a40",
                      borderRadius: 5, padding: "4px 6px", color: "#7070a0",
                      cursor: isUploading ? "wait" : "pointer",
                      opacity: isUploading || isGenerating ? 0.5 : 1,
                    }}>
                      {existing ? "Replace" : "Upload"}
                      <input
                        ref={el => { fileInputRefs.current[slot.angle] = el; }}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={isUploading || isGenerating}
                        onChange={e => handleFiles(slot.angle, e.target.files)}
                      />
                    </label>

                    {/* Generate button */}
                    <button
                      onClick={() => generateImage(slot.angle)}
                      disabled={isGeneratingAny || isUploading}
                      title={aiPrompt.trim() ? `Generate ${slot.label} with Flux.1` : "Enter a visual description first"}
                      style={{
                        flex: 1,
                        fontSize: 10, background: isGenerating ? "#1a0a3a" : "#160d30",
                        border: `1px solid ${isGenerating ? "#7c5cfc" : "#2a1a5a"}`,
                        borderRadius: 5, padding: "4px 6px",
                        color: isGenerating ? "#7c5cfc" : "#5040a0",
                        cursor: isGeneratingAny || isUploading ? "not-allowed" : "pointer",
                        opacity: isGeneratingAny && !isGenerating ? 0.4 : 1,
                        transition: "border-color 0.15s, color 0.15s",
                      }}
                    >
                      {isGenerating ? "…" : "✦ Gen"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generation readiness summary */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 10, padding: "14px 18px" }}>
        <p style={{ fontSize: 12, color: "#5a5a7a", marginBottom: 8, fontWeight: 600 }}>Generation readiness</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { provider: "Kling",  needed: ["front"], bonus: ["three_quarter_left", "three_quarter_right"] },
            { provider: "Runway", needed: ["front"], bonus: ["full_body_front"] },
            { provider: "Veo",    needed: ["front"], bonus: ["three_quarter_left"] },
          ].map(({ provider, needed, bonus }) => {
            const hasAll   = needed.every(a => refImages.some(r => r.angle === a));
            const hasBonus = bonus.some(a => refImages.some(r => r.angle === a));
            return (
              <div key={provider} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: hasAll ? "#4ade80" : "#3a3a5a" }} />
                <span style={{ fontSize: 11, color: hasAll ? "#c0e0c0" : "#3a3a5a" }}>
                  {provider}
                  {hasAll && hasBonus && <span style={{ color: "#7c5cfc", marginLeft: 4 }}>+ bonus angles</span>}
                  {!hasAll && <span style={{ color: "#3a3a5a" }}> — needs front face</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
