"use client";

// AI Motion Video — Character-first motion generation
// Workflow: Pick character (mandatory) → choose mode → upload media → generate
//
// Modes:
//  Image → Video      : still image gets animated (FAL Wan Pro)
//  Image + Video → Video : image adopts motion from reference video (motion transfer)
//  Video → Video      : generate new video inspired by reference video
//
// Character is MANDATORY. Without a character the motion has no subject to anchor to.

import { useState, useRef, useEffect } from "react";
import CharacterPicker from "../../components/CharacterPicker";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import ModelPicker from "../../components/ModelPicker";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";
import { safeJson } from "../../../lib/api-utils";

const cardStyle: React.CSSProperties = {
  background: ds.color.card,
  border: `1px solid ${ds.color.line}`,
  borderRadius: ds.radius.lg,
  padding: 20,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: ds.color.paper,
  border: `1px solid ${ds.color.line}`,
  borderRadius: ds.radius.sm,
  padding: "10px 12px",
  color: ds.color.ink,
  fontSize: 14,
  outline: "none",
  fontFamily: ds.font.sans,
};

type Mode = "image-to-video" | "image-plus-video" | "video-to-video";

interface Character {
  id: string;
  characterId?: string | null;
  name: string;
  imageUrl?: string;
  visualDescription?: string;
}

const MODES: { id: Mode; title: string; subtitle: string; uploads: string; color: string }[] = [
  {
    id: "image-to-video",
    title: "Image → Video",
    subtitle: "Upload a still image. AI brings it to life with motion.",
    uploads: "1 image",
    color: ds.color.sky,
  },
  {
    id: "image-plus-video",
    title: "Image + Video → Video",
    subtitle: "Upload your image AND a reference motion video. AI makes your image move the same way.",
    uploads: "1 image + 1 video",
    color: ds.color.lilac,
  },
  {
    id: "video-to-video",
    title: "Video → Video",
    subtitle: "Upload a reference video. AI creates a new video with your character doing the same motion.",
    uploads: "1 video",
    color: ds.color.gold,
  },
];

function assetUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("/api/") || filePath.startsWith("http")) return filePath;
  const cleaned = filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

const AI_MOTION_DB_KEY = "ghs_aimotionvideo_session";

export default function AiMotionVideoPage() {
  // Step state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [character, setCharacter] = useState<Character | null>(null);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  // File state (files cannot be persisted, only previews if data URLs)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  // Prompt
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);

  // AI + model selection
  const [aiTier, setAiTier] = useState<AITier>("pro");
  const [videoModel, setVideoModel] = useState("muapi_seedance_v2");
  const [imageModel, setImageModel] = useState("fal_flux_dev");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  // ── Restore state on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/hybrid/saved-state?localId=${AI_MOTION_DB_KEY}`)
      .then(r => r.json())
      .then(d => {
        if (!d.found || !d.data) return;
        const s = d.data as Record<string, unknown>;
        if (s.mode)       setMode(s.mode as Mode);
        if (s.prompt)     setPrompt(s.prompt as string);
        if (s.duration)   setDuration(s.duration as number);
        if (s.aiTier)     setAiTier(s.aiTier as AITier);
        if (s.videoModel) setVideoModel(s.videoModel as string);
        if (s.imageModel) setImageModel(s.imageModel as string);
        if (s.resultUrl)  setResultUrl(s.resultUrl as string);
        // Restore character minimal info (no file blobs — user must re-pick)
        if (s.character)  { setCharacter(s.character as Character); setStep(s.mode ? 2 : 1); }
      })
      .catch(() => {})
      .finally(() => { restoredRef.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save state on changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!restoredRef.current) return;
    const draft = {
      mode, prompt, duration, aiTier, videoModel, imageModel,
      character: character ? { id: character.id, characterId: character.characterId, name: character.name, visualDescription: character.visualDescription } : null,
      resultUrl,
    };
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: AI_MOTION_DB_KEY, data: draft }),
    }).catch(() => {});
  }, [mode, prompt, duration, aiTier, videoModel, imageModel, character, resultUrl]);

  function pickImage(file: File) {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }
  function pickVideo(file: File) {
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  const selectedMode = MODES.find(m => m.id === mode);
  const needsImage = mode === "image-to-video" || mode === "image-plus-video";
  const needsVideo = mode === "image-plus-video" || mode === "video-to-video";
  const canGenerate = !!character && !!mode &&
    (!needsImage || !!imageFile) &&
    (!needsVideo || !!videoFile);

  async function generate() {
    if (!canGenerate || !character) return;
    setGenerating(true);
    setError(null);
    setResultUrl(null);

    try {
      const charDesc = character.visualDescription
        ? `${character.name}: ${character.visualDescription}`
        : character.name;

      if (mode === "image-to-video") {
        setProgress("Uploading image...");
        const fd = new FormData();
        fd.append("file", imageFile!);
        const upRes = await fetch("/api/upload/logo", { method: "POST", body: fd });
        const upData = await safeJson<{ url?: string; path?: string }>(upRes, "upload/logo");
        const imgUrl = upData.url || upData.path;

        setProgress("Generating video with AI...");
        const motionPrompt = [
          `CHARACTER ${charDesc}`,
          prompt || "Smooth natural motion, consistent character appearance throughout",
          "Cinematic quality, stable character design",
        ].join(". ");

        const res = await fetch("/api/hybrid/scene-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneText: motionPrompt,
            imageUrl: imgUrl,
            duration,
            motionDescription: prompt || undefined,
          }),
        });
        const data = await safeJson<{ videoUrl?: string; error?: string }>(res, "hybrid/scene-video");
        if (data.videoUrl) {
          setResultUrl(data.videoUrl);
          setProgress("");
        } else {
          setError(data.error || "Video generation failed");
        }

      } else if (mode === "image-plus-video") {
        setProgress("Uploading files...");
        const fd = new FormData();
        fd.append("image", imageFile!);
        fd.append("video", videoFile!);

        setProgress("Applying motion to your character...");
        const res = await fetch("/api/video-tools/motion-transfer", {
          method: "POST",
          body: fd,
        });
        const data = await safeJson<{ contentItemId?: string; error?: string }>(res, "video-tools/motion-transfer");
        if (data.contentItemId) {
          setProgress(`Processing (ID: ${data.contentItemId}) — check Review Queue for result`);
          setResultUrl(`/dashboard/review`);
        } else {
          setError(data.error || "Motion transfer failed");
        }

      } else if (mode === "video-to-video") {
        setProgress("Uploading reference video...");
        const fd = new FormData();
        fd.append("file", videoFile!);
        await fetch("/api/v2v/upload", { method: "POST", body: fd });

        setProgress("Generating new video with your character...");
        const genPrompt = [
          `CHARACTER ${charDesc} performing the same motion as the reference video`,
          prompt || "Same movement, same energy, consistent character appearance",
          "High quality, smooth motion, cinematic",
        ].join(". ");

        const res = await fetch("/api/generation/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: genPrompt,
            duration,
            imageUrl: character.imageUrl ? assetUrl(character.imageUrl) : undefined,
          }),
        });
        const data = await safeJson<{ videoUrl?: string; videoPath?: string; error?: string }>(res, "generation/video");
        if (data.videoUrl || data.videoPath) {
          const url = data.videoUrl || `/api/media/${(data.videoPath as string).replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
          setResultUrl(url);
          setProgress("");
        } else {
          setError(data.error || "Video generation failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setGenerating(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: ds.font.sans }}>

      <HeroTitle
        kicker="Motion Studio"
        title="AI Motion"
        italic="Video"
        sub="Animate images, transfer motion, and create videos — all anchored to your character."
      />

      {/* STEP 1: Character (mandatory) */}
      <div style={{
        ...cardStyle,
        borderColor: character ? `rgba(167,139,250,0.3)` : `rgba(239,68,68,0.3)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: character ? 10 : 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: character ? ds.color.lilac : "#ef4444",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}>1</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink }}>
              Select Character{" "}
              <span style={{ color: "#ef4444", fontSize: 10 }}>REQUIRED</span>
            </p>
            <p style={{ fontSize: 10, color: ds.color.mute }}>The character is the subject — every video is built around them.</p>
          </div>
          <button
            onClick={() => setShowCharPicker(true)}
            style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
              border: `1px solid ${character ? "rgba(167,139,250,0.4)" : "rgba(239,68,68,0.5)"}`,
              background: character ? "rgba(167,139,250,0.1)" : "rgba(239,68,68,0.08)",
              color: character ? ds.color.lilac : "#ef4444",
              fontSize: 10, fontWeight: 700,
            }}>
            {character ? "Change" : "Pick Character"}
          </button>
        </div>

        {character && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: ds.radius.sm,
            background: ds.color.paper, border: `1px solid rgba(167,139,250,0.2)`,
          }}>
            {character.imageUrl
              ? <img src={assetUrl(character.imageUrl)} alt="" style={{ width: 52, height: 52, borderRadius: ds.radius.sm, objectFit: "cover", border: `2px solid ${ds.color.lilac}` }} />
              : <div style={{ width: 52, height: 52, borderRadius: ds.radius.sm, background: "rgba(167,139,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: ds.color.lilac }}>C</div>
            }
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink }}>{character.name}</p>
              {character.visualDescription && (
                <p style={{ fontSize: 9, color: ds.color.mute, marginTop: 2, maxWidth: 400, lineHeight: 1.5 }}>{character.visualDescription.slice(0, 100)}...</p>
              )}
              <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: "rgba(167,139,250,0.15)", color: ds.color.lilac, fontWeight: 600 }}>Character selected</span>
            </div>
          </div>
        )}

        {!character && (
          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p style={{ fontSize: 10, color: "#ef4444" }}>You must select a character before generating. The character is the subject of the motion video.</p>
          </div>
        )}
      </div>

      {/* STEP 2: Mode */}
      <div style={{ ...cardStyle, borderColor: mode ? `rgba(167,139,250,0.3)` : ds.color.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: mode ? ds.color.lilac : ds.color.line2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: mode ? "#fff" : ds.color.mute, flexShrink: 0,
          }}>2</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink }}>Choose How to Create</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MODES.map(m => (
            <div key={m.id}
              onClick={() => { setMode(m.id); setImageFile(null); setImagePreview(null); setVideoFile(null); setVideoPreview(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: ds.radius.md,
                background: mode === m.id ? ds.color.card : ds.color.paper,
                border: `1px solid ${mode === m.id ? m.color + "50" : ds.color.line}`,
                cursor: "pointer", transition: "all 0.15s",
              }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: mode === m.id ? ds.color.ink : ds.color.ink2 }}>{m.title}</p>
                <p style={{ fontSize: 10, color: ds.color.mute, marginTop: 1 }}>{m.subtitle}</p>
              </div>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${m.color}15`, color: m.color, fontWeight: 600, flexShrink: 0 }}>{m.uploads}</span>
              {mode === m.id && <span style={{ fontSize: 12, color: m.color, flexShrink: 0, fontWeight: 800 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 3: Upload media */}
      {mode && (
        <div style={{ ...cardStyle, borderColor: canGenerate ? `rgba(124,196,255,0.2)` : ds.color.line }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: (needsImage ? !!imageFile : true) && (needsVideo ? !!videoFile : true) ? ds.color.sky : ds.color.line2,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#fff",
            }}>3</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink }}>Upload Media</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: needsImage && needsVideo ? "1fr 1fr" : "1fr", gap: 12 }}>
            {needsImage && (
              <div>
                <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, fontFamily: ds.font.mono }}>
                  {mode === "image-to-video" ? "Your Image (gets animated)" : "Your Image (character/subject)"}
                </p>
                <div
                  onClick={() => imageRef.current?.click()}
                  style={{
                    borderRadius: ds.radius.md,
                    border: `2px dashed ${imageFile ? ds.color.sky + "60" : ds.color.line2}`,
                    background: imageFile ? "rgba(124,196,255,0.06)" : ds.color.paper,
                    cursor: "pointer", minHeight: 120,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", transition: "all 0.15s",
                  }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover" }} />
                    : <div style={{ textAlign: "center", padding: 20 }}>
                        <p style={{ fontSize: 24, color: ds.color.mute, marginBottom: 6 }}>[ ]</p>
                        <p style={{ fontSize: 11, color: ds.color.mute }}>Click to upload image</p>
                        <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 2 }}>PNG, JPG, WebP</p>
                      </div>
                  }
                </div>
                <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
                {imageFile && <p style={{ fontSize: 9, color: ds.color.sky, marginTop: 4 }}>{imageFile.name}</p>}
              </div>
            )}

            {needsVideo && (
              <div>
                <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, fontFamily: ds.font.mono }}>
                  {mode === "image-plus-video" ? "Reference Video (motion to copy)" : "Reference Video (motion to recreate)"}
                </p>
                <div
                  onClick={() => videoRef.current?.click()}
                  style={{
                    borderRadius: ds.radius.md,
                    border: `2px dashed ${videoFile ? ds.color.lilac + "60" : ds.color.line2}`,
                    background: videoFile ? "rgba(167,139,250,0.06)" : ds.color.paper,
                    cursor: "pointer", minHeight: 120,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", transition: "all 0.15s",
                  }}>
                  {videoPreview
                    ? <video src={videoPreview} controls style={{ width: "100%", maxHeight: 180 }} />
                    : <div style={{ textAlign: "center", padding: 20 }}>
                        <p style={{ fontSize: 24, color: ds.color.mute, marginBottom: 6 }}>{"[>]"}</p>
                        <p style={{ fontSize: 11, color: ds.color.mute }}>Click to upload video</p>
                        <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 2 }}>MP4, MOV, WebM</p>
                      </div>
                  }
                </div>
                <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickVideo(f); }} />
                {videoFile && <p style={{ fontSize: 9, color: ds.color.lilac, marginTop: 4 }}>{videoFile.name}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Prompt + Duration */}
      {mode && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: ds.color.line2,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: ds.color.mute,
            }}>4</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink }}>
              Motion Description{" "}
              <span style={{ fontSize: 10, color: ds.color.mute, fontWeight: 400 }}>(optional)</span>
            </p>
          </div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2}
            placeholder={
              mode === "image-to-video" ? 'e.g. "slow walk forward, looking around, wind in fur"'
              : mode === "image-plus-video" ? 'e.g. "apply the same dance moves but slower"'
              : 'e.g. "same energy as reference but with my rabbit character"'
            }
            style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", marginTop: 4 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[3, 5, 8, 10].map(d => (
                <button key={d} onClick={() => setDuration(d)} style={{
                  padding: "5px 10px", borderRadius: 8,
                  border: `1px solid ${duration === d ? ds.color.sky : ds.color.line}`,
                  background: duration === d ? "rgba(124,196,255,0.2)" : "transparent",
                  color: duration === d ? ds.color.sky : ds.color.mute,
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>{d}s</button>
              ))}
            </div>
            <ModelPicker videoModel={videoModel} imageModel={imageModel}
              onVideoChange={setVideoModel} onImageChange={setImageModel}
              accentColor={ds.color.sky} compact />
            <AITierSelector value={aiTier} onChange={setAiTier} compact />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div data-testid="motion-video-error" style={{ padding: "10px 14px", borderRadius: ds.radius.sm, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div style={{ padding: "10px 14px", borderRadius: ds.radius.sm, background: "rgba(124,196,255,0.08)", border: `1px solid rgba(124,196,255,0.2)`, marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: ds.color.sky }}>{progress}</p>
        </div>
      )}

      {/* Generate button */}
      {mode && (
        <button
          onClick={generate}
          disabled={!canGenerate || generating}
          style={{
            width: "100%", fontSize: 15, padding: "15px", marginBottom: 16,
            borderRadius: ds.radius.md, border: "none", fontWeight: 700, cursor: canGenerate && !generating ? "pointer" : "not-allowed",
            background: canGenerate && !generating
              ? `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`
              : ds.color.card,
            color: canGenerate && !generating ? "#fff" : ds.color.mute,
          }}>
          {generating ? "Generating..." : !character ? "Select a character first" : !canGenerate ? "Upload required files" : "Generate Motion Video"}
        </button>
      )}

      {/* Result */}
      {resultUrl && !generating && (
        <div style={{ ...cardStyle, borderColor: "rgba(167,139,250,0.3)" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: ds.color.lilac, marginBottom: 12 }}>Video Ready</p>
          {resultUrl.startsWith("/dashboard") ? (
            <div style={{ padding: "12px 16px", borderRadius: ds.radius.sm, background: "rgba(167,139,250,0.08)", border: `1px solid rgba(167,139,250,0.2)` }}>
              <p style={{ fontSize: 12, color: ds.color.ink, marginBottom: 8 }}>Motion transfer is processing in the background.</p>
              <a href={resultUrl} style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "10px 18px", borderRadius: ds.radius.md, border: "none", fontWeight: 700,
                  background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
                  color: "#fff", fontSize: 12, cursor: "pointer",
                }}>Go to Review Queue</button>
              </a>
            </div>
          ) : (
            <>
              <video src={resultUrl} controls autoPlay loop style={{ width: "100%", borderRadius: ds.radius.sm, background: "#000", marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <a href={resultUrl} download style={{ textDecoration: "none" }}>
                  <button style={{
                    padding: "10px 18px", borderRadius: ds.radius.md, border: "none", fontWeight: 700,
                    background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
                    color: "#fff", fontSize: 12, cursor: "pointer",
                  }}>Download</button>
                </a>
                <button onClick={() => { setResultUrl(null); setImageFile(null); setImagePreview(null); setVideoFile(null); setVideoPreview(null); setPrompt(""); setProgress(""); }}
                  style={{ padding: "10px 18px", borderRadius: ds.radius.md, border: `1px solid ${ds.color.line}`, background: "transparent", color: ds.color.mute, fontSize: 12, cursor: "pointer" }}>
                  Make Another
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Character picker modal */}
      {showCharPicker && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.8)" }}
          onClick={() => setShowCharPicker(false)}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", borderRadius: ds.radius.lg, padding: 4 }}
            onClick={e => e.stopPropagation()}>
            <CharacterPicker
              onSelect={(char) => {
                const c = char as unknown as { id: string; characterId?: string | null; name: string; imageUrl?: string; visualDescription?: string };
                setCharacter({ id: c.characterId || c.id, characterId: c.characterId, name: c.name, imageUrl: c.imageUrl, visualDescription: c.visualDescription });
                setShowCharPicker(false);
              }}
              onCreateNew={() => { window.open("/dashboard/character-voices", "_blank"); setShowCharPicker(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
