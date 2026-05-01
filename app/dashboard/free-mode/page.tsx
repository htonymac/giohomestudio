"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { ds } from "../../../lib/designSystem";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Scene {
  id:    string;
  title: string;
  text:  string;
  mood:  string;
}

interface ChatMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  scenes?:   Scene[];
  timestamp: number;
}

interface Character {
  id:   string;
  name: string;
  imageUrl?: string | null;
  role?: string | null;
}

interface DailyLimits {
  imageCount:     number;
  videoCount:     number;
  imageLimit:     number;
  videoLimit:     number;
  imageRemaining: number;
  videoRemaining: number;
}

interface IntroOutroData {
  text:  string;
  phone: string;
  type:  "whatsapp" | "call" | "contact";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function genSessionId(): string {
  return "fms_" + genId();
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:     ds.color.paper,
  card:   ds.color.card,
  alert:  ds.color.alert,
  line:   ds.color.line,
  ink:    ds.color.ink,
  mute:   ds.color.mute,
  mute2:  ds.color.mute2,
  sky:    ds.color.sky,
  lilac:  ds.color.lilac,
  mint:   ds.color.mint,
  gold:   ds.color.gold,
  pink:   ds.color.pink,
  coral:  ds.color.coral,
};

// ── Scene Card ─────────────────────────────────────────────────────────────────

function SceneCard({
  scene,
  index,
  onEdit,
}: {
  scene: Scene;
  index: number;
  onEdit: (id: string, field: "title" | "text", value: string) => void;
}) {
  const moodColor: Record<string, string> = {
    tense: C.coral, dramatic: C.pink, calm: C.mint, joyful: C.gold,
    mysterious: C.lilac, romantic: C.pink, neutral: C.mute,
    hopeful: C.sky, sad: C.sky, angry: C.coral, funny: C.gold,
  };
  const mc = moodColor[scene.mood.toLowerCase()] ?? C.sky;

  return (
    <div style={{
      borderRadius: 12, background: C.alert,
      border: `1px solid ${C.line}`,
      overflow: "hidden", marginBottom: 8,
      animation: "fadeSlideUp 0.3s ease",
    }}>
      <div style={{
        padding: "8px 14px", borderBottom: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: `${mc}08`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, color: C.mute2, letterSpacing: 1.2,
            textTransform: "uppercase",
          }}>Scene {index + 1}</span>
          <span style={{
            padding: "1px 7px", borderRadius: 20, fontSize: 9, fontWeight: 700,
            background: `${mc}18`, color: mc, border: `1px solid ${mc}35`,
            textTransform: "capitalize",
          }}>{scene.mood}</span>
        </div>
      </div>
      <div style={{ padding: "10px 14px" }}>
        <input
          value={scene.title}
          onChange={e => onEdit(scene.id, "title", e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "transparent", border: "none",
            color: C.ink, fontSize: 12, fontWeight: 700,
            outline: "none", marginBottom: 6, padding: 0,
            fontFamily: "inherit",
          }}
          placeholder="Scene title…"
        />
        <textarea
          value={scene.text}
          onChange={e => onEdit(scene.id, "text", e.target.value)}
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "transparent", border: "none",
            color: C.ink, fontSize: 13, lineHeight: 1.65,
            outline: "none", resize: "none", padding: 0,
            fontFamily: "inherit",
          }}
          placeholder="Scene description…"
        />
      </div>
    </div>
  );
}

// ── Action Buttons (4 buttons) ─────────────────────────────────────────────────

function ActionButtons({
  scenes,
  onGenImage,
  onGenVideo,
  onGenHybrid,
  onEditMode,
  editMode,
  limits,
}: {
  scenes: Scene[];
  onGenImage: () => void;
  onGenVideo: () => void;
  onGenHybrid: () => void;
  onEditMode: () => void;
  editMode: boolean;
  limits: DailyLimits;
}) {
  return (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12,
      padding: "10px 14px",
      borderTop: `1px solid ${C.line}`,
    }}>
      <button onClick={onEditMode} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
        border: `1px solid ${editMode ? C.sky + "60" : C.line}`,
        background: editMode ? `${C.sky}15` : "transparent",
        color: editMode ? C.sky : C.mute, cursor: "pointer",
        transition: "all 0.15s",
      }}>
        ✏️ {editMode ? "Re-send to AI" : "Edit Scene/Movie"}
      </button>
      <button
        onClick={onGenImage}
        disabled={limits.imageRemaining <= 0}
        title={limits.imageRemaining <= 0 ? `Daily image limit reached (${limits.imageLimit}/day)` : `${limits.imageRemaining} images left today`}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          border: `1px solid ${limits.imageRemaining <= 0 ? C.mute2 + "40" : C.lilac + "60"}`,
          background: limits.imageRemaining <= 0 ? "transparent" : `${C.lilac}15`,
          color: limits.imageRemaining <= 0 ? C.mute2 : C.lilac,
          cursor: limits.imageRemaining <= 0 ? "not-allowed" : "pointer",
          opacity: limits.imageRemaining <= 0 ? 0.5 : 1,
          transition: "all 0.15s",
        }}>
        🖼️ Gen Image
      </button>
      <button
        onClick={onGenVideo}
        disabled={limits.videoRemaining <= 0}
        title={limits.videoRemaining <= 0 ? `Daily video limit reached (${limits.videoLimit}/day)` : `${limits.videoRemaining} videos left today`}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
          border: `1px solid ${limits.videoRemaining <= 0 ? C.mute2 + "40" : C.gold + "60"}`,
          background: limits.videoRemaining <= 0 ? "transparent" : `${C.gold}15`,
          color: limits.videoRemaining <= 0 ? C.mute2 : C.gold,
          cursor: limits.videoRemaining <= 0 ? "not-allowed" : "pointer",
          opacity: limits.videoRemaining <= 0 ? 0.5 : 1,
          transition: "all 0.15s",
        }}>
        🎬 Generate Movie
      </button>
      <button onClick={onGenHybrid} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
        border: `1px solid ${C.mint + "60"}`,
        background: `${C.mint}15`, color: C.mint, cursor: "pointer",
        transition: "all 0.15s",
      }}>
        🔀 Generate Hybrid
      </button>
    </div>
  );
}

// ── Video Confirm Modal ────────────────────────────────────────────────────────

function VideoConfirmModal({
  onConfirm,
  onCancel,
  generating,
}: {
  onConfirm: (duration: number) => void;
  onCancel: () => void;
  generating: boolean;
}) {
  const [duration, setDuration] = useState(5);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 420, borderRadius: 18,
        background: C.card, border: `1px solid ${C.line}`,
        padding: 24,
        animation: "fadeSlideUp 0.2s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 6 }}>
          Generate Movie Clip
        </div>
        <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.6, marginBottom: 20, margin: "0 0 16px" }}>
          AI will generate a short video clip for each scene.
          Set the total duration below.
        </p>
        <label style={{ fontSize: 11, fontWeight: 700, color: C.mute2, display: "block", marginBottom: 6 }}>
          Duration per scene (seconds)
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[3, 5, 8, 10].map(v => (
            <button key={v} onClick={() => setDuration(v)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: `1px solid ${duration === v ? C.gold + "60" : C.line}`,
              background: duration === v ? `${C.gold}18` : "transparent",
              color: duration === v ? C.gold : C.mute, cursor: "pointer",
            }}>{v}s</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: `1px solid ${C.line}`, background: "transparent",
            color: C.mute, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => onConfirm(duration)} disabled={generating} style={{
            flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
            background: generating ? C.alert
              : `linear-gradient(135deg, ${C.gold}, ${C.coral})`,
            color: generating ? C.mute : "#fff",
            fontSize: 13, fontWeight: 800, cursor: generating ? "not-allowed" : "pointer",
          }}>
            {generating ? "Generating…" : `Confirm: generate ${duration}s video`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Hybrid Progress Modal ──────────────────────────────────────────────────────

function HybridModal({
  scenes,
  onClose,
}: {
  scenes: Scene[];
  onClose: () => void;
}) {
  const [totalDuration, setTotalDuration] = useState(30);
  const [steps, setSteps] = useState<{ label: string; status: "pending" | "running" | "done" | "error" }[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runHybrid() {
    setRunning(true);
    setError(null);
    const pipeline = [
      "Calculate scene timings",
      "Generate scene images",
      "Add text overlays",
      "Match SFX from scene mood",
      "Assemble final video",
    ];
    setSteps(pipeline.map(label => ({ label, status: "pending" })));

    const sceneDuration = totalDuration / scenes.length;

    try {
      // Step 1: timings
      setSteps(s => s.map((x, i) => i === 0 ? { ...x, status: "running" } : x));
      await new Promise(r => setTimeout(r, 400));
      setSteps(s => s.map((x, i) => i === 0 ? { ...x, status: "done" } : x));

      // Step 2-5: call hybrid assemble with Auto-Timestamp
      setSteps(s => s.map((x, i) => i === 1 ? { ...x, status: "running" } : x));

      // Auto-Timestamp: distribute scenes evenly across totalDuration
      const timeline = scenes.map((sc, idx) => {
        const startTime = idx * sceneDuration;
        const endTime   = (idx + 1) * sceneDuration;
        return {
          sceneId:    sc.id,
          startTime,
          endTime,
          duration:   sceneDuration,
          // text overlay appears 0.5s after scene start
          textOverlayAt: startTime + 0.5,
          orderIndex:  idx,
        };
      });

      const scenePayload = scenes.map((sc, idx) => ({
        sceneId:    sc.id,
        title:      sc.title,
        text:       sc.text,
        mood:       sc.mood,
        duration:   Math.round(sceneDuration),
        orderIndex: idx,
        startTime:  timeline[idx].startTime,
        endTime:    timeline[idx].endTime,
        textOverlayAt: timeline[idx].textOverlayAt,
      }));

      const res = await fetch("/api/hybrid/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: scenePayload,
          timeline,
          totalDuration,
          mode: "free_mode_hybrid",
          addTextOverlay: true,
          addSfx: true,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Hybrid assembly failed");
      }

      const data = await res.json();
      setSteps(s => s.map((x, i) => i >= 1 ? { ...x, status: "done" } : x));
      setResultUrl(data.videoUrl ?? data.outputPath ?? null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly failed");
      setSteps(s => s.map(x => x.status === "running" ? { ...x, status: "error" } : x));
    }

    setRunning(false);
  }

  const statusColor = { pending: C.mute2, running: C.sky, done: C.mint, error: C.coral };
  const statusIcon  = { pending: "○", running: "⟳", done: "✓", error: "✕" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 460, borderRadius: 18,
        background: C.card, border: `1px solid ${C.line}`,
        padding: 24,
        animation: "fadeSlideUp 0.2s ease",
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, marginBottom: 6 }}>
          🔀 Generate Hybrid Video
        </div>
        <p style={{ fontSize: 13, color: C.mute, margin: "0 0 16px", lineHeight: 1.6 }}>
          AI will generate an image per scene, add text overlay, match SFX, and assemble one video.
        </p>

        {!running && !done && (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.mute2, display: "block", marginBottom: 6 }}>
              Total video length (seconds)
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[15, 30, 60, 90].map(v => (
                <button key={v} onClick={() => setTotalDuration(v)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: `1px solid ${totalDuration === v ? C.mint + "60" : C.line}`,
                  background: totalDuration === v ? `${C.mint}18` : "transparent",
                  color: totalDuration === v ? C.mint : C.mute, cursor: "pointer",
                }}>{v}s</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.mute2, marginBottom: 20 }}>
              {scenes.length} scenes × ~{Math.round(totalDuration / scenes.length)}s each
            </div>
          </>
        )}

        {steps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: i < steps.length - 1 ? `1px solid ${C.line}` : "none",
              }}>
                <span style={{
                  fontSize: 14, color: statusColor[step.status],
                  animation: step.status === "running" ? "spin 1s linear infinite" : "none",
                  display: "inline-block",
                }}>{statusIcon[step.status]}</span>
                <span style={{ fontSize: 12, color: step.status === "pending" ? C.mute2 : C.ink }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: `${C.coral}0a`, border: `1px solid ${C.coral}30`,
            fontSize: 12, color: C.coral,
          }}>{error}</div>
        )}

        {done && resultUrl && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
            background: `${C.mint}0a`, border: `1px solid ${C.mint}30`,
            fontSize: 12, color: C.mint,
          }}>
            Video ready!{" "}
            <a href={resultUrl} target="_blank" rel="noreferrer" style={{ color: C.sky, textDecoration: "underline" }}>
              Download
            </a>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: `1px solid ${C.line}`, background: "transparent",
            color: C.mute, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>{done ? "Close" : "Cancel"}</button>
          {!running && !done && (
            <button onClick={runHybrid} style={{
              flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg, ${C.mint}, ${ds.color.sky})`,
              color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
            }}>
              Start ({scenes.length} scenes)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Character Drawer ───────────────────────────────────────────────────────────

function CharacterDrawer({
  selectedIds,
  onSelect,
  onClose,
}: {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState("");
  const [newDesc, setNewDesc]       = useState("");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetch("/api/character")
      .then(r => r.ok ? r.json() : { characters: [] })
      .then(d => setCharacters(d.characters ?? d.items ?? []))
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter(x => x !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  }

  async function createCharacter() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), visualDescription: newDesc.trim(), role: "supporting" }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.character ?? data;
        setCharacters(prev => [created, ...prev]);
        onSelect([...selectedIds, created.id]);
        setCreating(false);
        setNewName(""); setNewDesc("");
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      display: "flex", alignItems: "stretch",
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />

      {/* Drawer */}
      <div style={{
        width: 340, background: C.card,
        borderLeft: `1px solid ${C.line}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>Add Character</span>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: C.mute, fontSize: 18, cursor: "pointer",
          }}>×</button>
        </div>

        {/* Search / list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: C.mute, fontSize: 12, padding: 24 }}>Loading characters…</div>
          ) : (
            <>
              {characters.length === 0 && !creating && (
                <div style={{ textAlign: "center", color: C.mute2, fontSize: 12, padding: 24 }}>
                  No characters yet. Create one below.
                </div>
              )}
              {characters.map(ch => {
                const active = selectedIds.includes(ch.id);
                return (
                  <div key={ch.id} onClick={() => toggle(ch.id)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer",
                    border: `1px solid ${active ? C.sky + "60" : C.line}`,
                    background: active ? `${C.sky}10` : C.alert,
                    transition: "all 0.15s",
                  }}>
                    {ch.imageUrl ? (
                      <img src={ch.imageUrl} alt={ch.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: `${C.lilac}20`, border: `1px solid ${C.lilac}35`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: C.lilac, fontWeight: 700,
                      }}>{ch.name.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{ch.name}</div>
                      {ch.role && <div style={{ fontSize: 10, color: C.mute }}>{ch.role}</div>}
                    </div>
                    {active && <span style={{ fontSize: 14, color: C.sky }}>✓</span>}
                  </div>
                );
              })}

              {creating && (
                <div style={{
                  padding: "14px 12px", borderRadius: 12,
                  background: C.alert, border: `1px solid ${C.line}`,
                  marginTop: 8,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.mute2, marginBottom: 8 }}>
                    NEW CHARACTER
                  </div>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Character name…"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: C.card, border: `1px solid ${C.line}`,
                      color: C.ink, borderRadius: 8, padding: "8px 10px",
                      fontSize: 12, marginBottom: 8, outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Brief description (appearance, role…)"
                    rows={2}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: C.card, border: `1px solid ${C.line}`,
                      color: C.ink, borderRadius: 8, padding: "8px 10px",
                      fontSize: 12, resize: "none", outline: "none", marginBottom: 10,
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setCreating(false)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8,
                      border: `1px solid ${C.line}`, background: "transparent",
                      color: C.mute, fontSize: 11, cursor: "pointer",
                    }}>Cancel</button>
                    <button onClick={createCharacter} disabled={saving || !newName.trim()} style={{
                      flex: 2, padding: "8px 0", borderRadius: 8, border: "none",
                      background: saving ? C.alert : `linear-gradient(135deg, ${C.lilac}, ${C.sky})`,
                      color: saving ? C.mute : "#fff",
                      fontSize: 11, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    }}>{saving ? "Saving…" : "Create"}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!creating && (
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setCreating(true)} style={{
              width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg, ${C.lilac}40, ${C.sky}40)`,
              color: C.ink, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>+ Create New Character</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Intro/Outro Form ───────────────────────────────────────────────────────────

function IntroOutroPanel({
  type,
  data,
  onChange,
  onClose,
}: {
  type: "intro" | "outro";
  data: IntroOutroData;
  onChange: (d: IntroOutroData) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      padding: "12px 14px",
      background: C.alert,
      border: `1px solid ${C.line}`,
      borderRadius: 12, marginBottom: 8,
      animation: "fadeSlideUp 0.2s ease",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.mute2, textTransform: "uppercase", letterSpacing: 1 }}>
          {type === "intro" ? "Intro" : "Outro"}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.mute, fontSize: 14, cursor: "pointer" }}>×</button>
      </div>
      <input
        value={data.text}
        onChange={e => onChange({ ...data, text: e.target.value })}
        placeholder={type === "intro" ? "Intro text (e.g. GioHomeStudio presents…)" : "Outro text (e.g. Thank you for watching!)"}
        style={{
          width: "100%", boxSizing: "border-box",
          background: C.card, border: `1px solid ${C.line}`,
          color: C.ink, borderRadius: 8, padding: "8px 10px", fontSize: 12,
          outline: "none", marginBottom: 8, fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={data.phone}
          onChange={e => onChange({ ...data, phone: e.target.value })}
          placeholder="Phone / WhatsApp number"
          style={{
            flex: 1, boxSizing: "border-box",
            background: C.card, border: `1px solid ${C.line}`,
            color: C.ink, borderRadius: 8, padding: "8px 10px", fontSize: 12,
            outline: "none", fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {(["contact", "whatsapp", "call"] as const).map(t => (
            <button key={t} onClick={() => onChange({ ...data, type: t })} style={{
              padding: "6px 8px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${data.type === t ? C.mint + "60" : C.line}`,
              background: data.type === t ? `${C.mint}18` : "transparent",
              color: data.type === t ? C.mint : C.mute2,
            }}>{t === "contact" ? "CONTACT" : t === "whatsapp" ? "WA" : "CALL"}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onEditScene,
  onReSendToAI,
  onGenImage,
  onGenVideo,
  onGenHybrid,
  limits,
  editMode,
  onToggleEdit,
  imageResults,
}: {
  msg: ChatMessage;
  onEditScene: (msgId: string, sceneId: string, field: "title" | "text", value: string) => void;
  onReSendToAI: (msgId: string) => void;
  onGenImage: (msgId: string) => void;
  onGenVideo: (msgId: string) => void;
  onGenHybrid: (msgId: string) => void;
  limits: DailyLimits;
  editMode: Set<string>;
  onToggleEdit: (msgId: string) => void;
  imageResults: Record<string, string[]>;
}) {
  const isUser = msg.role === "user";
  const isEdit = editMode.has(msg.id);

  if (isUser) {
    return (
      <div style={{
        display: "flex", justifyContent: "flex-end", marginBottom: 12,
        animation: "fadeSlideUp 0.25s ease",
      }}>
        <div style={{
          maxWidth: "72%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px",
          background: `linear-gradient(135deg, ${C.lilac}30, ${C.sky}20)`,
          border: `1px solid ${C.lilac}35`,
          color: C.ink, fontSize: 13, lineHeight: 1.6,
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div style={{ marginBottom: 16, animation: "fadeSlideUp 0.25s ease" }}>
      {/* Summary */}
      {msg.content && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${C.lilac}, ${C.sky})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: "#fff",
          }}>G</div>
          <div style={{
            flex: 1, padding: "10px 14px", borderRadius: "4px 16px 16px 16px",
            background: C.card, border: `1px solid ${C.line}`,
            color: C.ink, fontSize: 13, lineHeight: 1.6,
          }}>
            {msg.content}
          </div>
        </div>
      )}

      {/* Scene cards */}
      {msg.scenes && msg.scenes.length > 0 && (
        <div style={{ paddingLeft: 38 }}>
          {msg.scenes.map((scene, i) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={i}
              onEdit={(sceneId, field, value) => onEditScene(msg.id, sceneId, field, value)}
            />
          ))}

          {/* Image results */}
          {imageResults[msg.id] && imageResults[msg.id].length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {imageResults[msg.id].map((url, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={url} alt={`Scene ${i + 1}`} style={{
                    width: 120, height: 120, objectFit: "cover", borderRadius: 10,
                    border: `1px solid ${C.line}`,
                  }} />
                  <span style={{
                    position: "absolute", bottom: 4, left: 4,
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    background: "rgba(0,0,0,0.6)", padding: "2px 5px", borderRadius: 4,
                  }}>S{i + 1}</span>
                </div>
              ))}
            </div>
          )}

          {/* 4 action buttons */}
          <div style={{
            background: C.card, borderRadius: 12,
            border: `1px solid ${C.line}`,
            overflow: "hidden",
          }}>
            <ActionButtons
              scenes={msg.scenes}
              onEditMode={() => {
                onToggleEdit(msg.id);
                if (isEdit) onReSendToAI(msg.id);
              }}
              editMode={isEdit}
              onGenImage={() => onGenImage(msg.id)}
              onGenVideo={() => onGenVideo(msg.id)}
              onGenHybrid={() => onGenHybrid(msg.id)}
              limits={limits}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function FreeModeChat() {
  const sessionId   = useRef<string>(genSessionId());
  const feedRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [input,          setInput]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [loaded,         setLoaded]         = useState(false);
  const [characters,     setCharacters]     = useState<Character[]>([]);
  const [charDrawer,     setCharDrawer]     = useState(false);
  const [selectedCharIds,setSelectedCharIds]= useState<string[]>([]);
  const [plusMenuOpen,   setPlusMenuOpen]   = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const [limits,         setLimits]         = useState<DailyLimits>({
    imageCount: 0, videoCount: 0, imageLimit: 4, videoLimit: 2,
    imageRemaining: 4, videoRemaining: 2,
  });
  const [intro,          setIntro]          = useState<IntroOutroData | null>(null);
  const [outro,          setOutro]          = useState<IntroOutroData | null>(null);
  const [videoConfirm,   setVideoConfirm]   = useState<string | null>(null); // msgId
  const [genVideoState,  setGenVideoState]  = useState(false);
  const [hybridMsg,      setHybridMsg]      = useState<string | null>(null); // msgId
  const [editModeSet,    setEditModeSet]    = useState<Set<string>>(new Set());
  const [imageResults,   setImageResults]   = useState<Record<string, string[]>>({});
  const [genImageFor,    setGenImageFor]    = useState<string | null>(null);

  // Load from DB on mount
  useEffect(() => {
    const sid = sessionId.current;
    fetch(`/api/free-mode/sessions?sessionId=${sid}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.messages && data.messages.length > 0) {
          const restored: ChatMessage[] = data.messages.map((m: {
            id: string; role: string; content: string;
            scenes?: Scene[]; createdAt: string;
          }) => ({
            id:        m.id,
            role:      m.role as "user" | "assistant",
            content:   m.content,
            scenes:    m.scenes ? (m.scenes as Scene[]) : undefined,
            timestamp: new Date(m.createdAt).getTime(),
          }));
          setMessages(restored);
        }
        if (data?.session?.characters?.length > 0) {
          setSelectedCharIds(data.session.characters);
        }
        if (data?.session?.introText) {
          setIntro({ text: data.session.introText, phone: data.session.introPhone ?? "", type: "contact" });
        }
        if (data?.session?.outroText) {
          setOutro({ text: data.session.outroText, phone: data.session.outroPhone ?? "", type: "contact" });
        }
      })
      .catch(() => null)
      .finally(() => setLoaded(true));

    // Load daily limits
    fetch("/api/free-mode/daily-limits")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLimits(d); })
      .catch(() => null);
  }, []);

  // Load selected characters detail
  useEffect(() => {
    if (selectedCharIds.length === 0) { setCharacters([]); return; }
    fetch("/api/character")
      .then(r => r.ok ? r.json() : { characters: [] })
      .then(d => {
        const all: Character[] = d.characters ?? d.items ?? [];
        setCharacters(all.filter((c: Character) => selectedCharIds.includes(c.id)));
      })
      .catch(() => null);
  }, [selectedCharIds]);

  // Auto-scroll
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages.length, sending]);

  // Close plus menu on outside click
  useEffect(() => {
    if (!plusMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [plusMenuOpen]);

  // Persist session characters/intro/outro on change (debounced)
  const persistSession = useCallback(async (
    chars: string[],
    introData: IntroOutroData | null,
    outroData: IntroOutroData | null
  ) => {
    await fetch("/api/free-mode/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId:  sessionId.current,
        characters: chars,
        introText:  introData?.text  ?? null,
        introPhone: introData?.phone ?? null,
        outroText:  outroData?.text  ?? null,
        outroPhone: outroData?.phone ?? null,
      }),
    }).catch(() => null);
  }, []);

  // Handle send
  async function handleSend(overrideInput?: string) {
    const text = (overrideInput ?? input).trim();
    if (!text || sending) return;
    setInput("");

    const userMsg: ChatMessage = {
      id:        "u-" + genId(),
      role:      "user",
      content:   text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    // Build history for LLM context (last 10 messages)
    const historyContext = messages.slice(-10).map(m => ({
      role:    m.role,
      content: m.scenes
        ? m.content + "\n[Scenes: " + m.scenes.map(s => s.title).join(", ") + "]"
        : m.content,
    }));

    try {
      const res = await fetch("/api/free-mode/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message:   text,
          history:   historyContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg: ChatMessage = {
          id:        "a-" + genId(),
          role:      "assistant",
          content:   data.error ?? "Something went wrong. Please try again.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
        return;
      }

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id:        data.messageId ?? "a-" + genId(),
        role:      "assistant",
        content:   data.summary ?? "",
        scenes:    data.scenes ?? [],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id:        "a-" + genId(),
        role:      "assistant",
        content:   err instanceof Error ? err.message : "Unexpected error",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

  function editScene(msgId: string, sceneId: string, field: "title" | "text", value: string) {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.scenes) return m;
      return {
        ...m,
        scenes: m.scenes.map(s => s.id === sceneId ? { ...s, [field]: value } : s),
      };
    }));
  }

  function toggleEdit(msgId: string) {
    setEditModeSet(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }

  function reSendToAI(msgId: string) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes) return;
    const sceneSummary = msg.scenes
      .map(s => `${s.title}: ${s.text}`)
      .join("\n\n");
    const reSendText = `Please refine the following story scenes I edited:\n\n${sceneSummary}`;
    handleSend(reSendText);
    setEditModeSet(prev => { const next = new Set(prev); next.delete(msgId); return next; });
  }

  async function genImageForMsg(msgId: string) {
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes || limits.imageRemaining <= 0) return;

    setGenImageFor(msgId);
    const urls: string[] = [];

    for (const scene of msg.scenes.slice(0, limits.imageRemaining)) {
      try {
        // Increment usage first
        const limitRes = await fetch("/api/free-mode/daily-limits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "image" }),
        });
        if (!limitRes.ok) break; // limit reached

        const limData = await limitRes.json();
        setLimits(limData);

        const imgRes = await fetch("/api/generation/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt:  scene.text,
            modelId: "segmind_flux",
            width:   832, height: 1472,
          }),
        });
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          if (imgData.imagePath) {
            urls.push(`/api/media/file?path=${encodeURIComponent(imgData.imagePath)}`);
          }
        }
      } catch { /* continue */ }
    }

    setImageResults(prev => ({ ...prev, [msgId]: urls }));
    setGenImageFor(null);
  }

  function handleCharSelect(ids: string[]) {
    setSelectedCharIds(ids);
    persistSession(ids, intro, outro);
  }

  function updateIntro(d: IntroOutroData) {
    setIntro(d);
    persistSession(selectedCharIds, d, outro);
  }

  function updateOutro(d: IntroOutroData) {
    setOutro(d);
    persistSession(selectedCharIds, intro, d);
  }

  function handleVideoConfirm(msgId: string, duration: number) {
    // Video generation uses pipeline API
    const msg = messages.find(m => m.id === msgId);
    if (!msg?.scenes) return;

    setGenVideoState(true);
    fetch("/api/free-mode/daily-limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "video" }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLimits(d); })
      .catch(() => null)
      .finally(() => {
        // Fire and forget pipeline call
        const sceneParts = msg.scenes!.map(s => s.text).join(". ");
        fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawInput:        sceneParts,
            outputMode:      "text_to_video",
            llmModel:        "claude:claude-haiku-4-5-20251001",
            videoModelId:    "wan_2_5_lite",
            durationSeconds: duration,
            aspectRatio:     "9:16",
            aiAutoMode:      true,
            audioMode:       "voice_music",
          }),
        }).catch(() => null);

        setVideoConfirm(null);
        setGenVideoState(false);
      });
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: C.bg, color: C.ink, fontFamily: "system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* ── Modals ── */}
      {videoConfirm && (
        <VideoConfirmModal
          onConfirm={(dur) => handleVideoConfirm(videoConfirm, dur)}
          onCancel={() => setVideoConfirm(null)}
          generating={genVideoState}
        />
      )}
      {hybridMsg && (
        <HybridModal
          scenes={messages.find(m => m.id === hybridMsg)?.scenes ?? []}
          onClose={() => setHybridMsg(null)}
        />
      )}
      {charDrawer && (
        <CharacterDrawer
          selectedIds={selectedCharIds}
          onSelect={handleCharSelect}
          onClose={() => setCharDrawer(false)}
        />
      )}

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, borderBottom: `1px solid ${C.line}`,
        padding: "11px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.card, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#fff", fontWeight: 900,
          }}>G</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, letterSpacing: -0.3 }}>Free Mode</div>
            <div style={{ fontSize: 10, color: C.mute2 }}>Chat • Tell AI anything → get scenes</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/dashboard/hybrid-planner" style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            textDecoration: "none", border: `1px solid ${C.line}`, color: C.mute,
          }}>Hybrid</a>
          <a href="/dashboard/review" style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 600,
            textDecoration: "none", background: `${C.sky}15`,
            border: `1px solid ${C.sky}40`, color: C.sky,
          }}>Review Queue</a>
        </div>
      </div>

      {/* ── Chat feed ── */}
      <div ref={feedRef} style={{
        flex: 1, overflowY: "auto", padding: "20px 20px 8px",
        maxWidth: 860, width: "100%", margin: "0 auto",
        boxSizing: "border-box",
      }}>
        {!loaded ? (
          <div style={{ textAlign: "center", color: C.mute, fontSize: 12, padding: 40 }}>
            Loading session…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px 32px", maxWidth: 520, margin: "0 auto" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✨</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: C.ink, marginBottom: 8, letterSpacing: -0.5 }}>
              What story do you want to create?
            </h2>
            <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, marginBottom: 28 }}>
              Type any idea — movie concept, short film, ad script, drama, comedy.<br />
              AI reads it, writes the story, and divides it into editable scenes.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                "A Nigerian mother searching for her missing son in Lagos",
                "A product promo for a luxury hair cream",
                "Comedy: office worker discovers his boss is a robot",
                "Romantic short film: two strangers meet on a rainy night",
              ].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  padding: "8px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${C.line}`, background: C.card,
                  color: C.mute, cursor: "pointer", lineHeight: 1.4,
                }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onEditScene={editScene}
                onReSendToAI={reSendToAI}
                onGenImage={genImageForMsg}
                onGenVideo={(msgId) => setVideoConfirm(msgId)}
                onGenHybrid={(msgId) => setHybridMsg(msgId)}
                limits={limits}
                editMode={editModeSet}
                onToggleEdit={toggleEdit}
                imageResults={imageResults}
              />
            ))}
            {(sending || genImageFor) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 38, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.lilac}, ${C.sky})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "#fff", fontWeight: 900,
                }}>G</div>
                <div style={{
                  padding: "10px 14px", borderRadius: "4px 16px 16px 16px",
                  background: C.card, border: `1px solid ${C.line}`,
                  fontSize: 12, color: C.mute,
                }}>
                  {genImageFor ? "Generating images…" : "Writing scenes…"}
                  <span style={{ display: "inline-block", animation: "blink 1s infinite", marginLeft: 4 }}>▊</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Input area ── */}
      <div style={{
        flexShrink: 0, borderTop: `1px solid ${C.line}`,
        background: C.card, padding: "12px 20px 16px", zIndex: 10,
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* Intro/outro panels */}
          {intro && (
            <IntroOutroPanel type="intro" data={intro} onChange={updateIntro} onClose={() => { setIntro(null); persistSession(selectedCharIds, null, outro); }} />
          )}
          {outro && (
            <IntroOutroPanel type="outro" data={outro} onChange={updateOutro} onClose={() => { setOutro(null); persistSession(selectedCharIds, intro, null); }} />
          )}

          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginBottom: 8, flexWrap: "wrap",
          }}>
            {/* + button — consolidated menu for Add Character / Intro / Outro */}
            <div ref={plusMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setPlusMenuOpen(o => !o)}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: `1px solid ${plusMenuOpen ? C.sky + "80" : C.line}`,
                  background: plusMenuOpen ? `${C.sky}18` : "transparent",
                  color: plusMenuOpen ? C.sky : C.mute,
                  fontSize: 18, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                }}
                title="Add character, intro, or outro"
              >+</button>
              {plusMenuOpen && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 50,
                  background: C.card, border: `1px solid ${C.line}`, borderRadius: 10,
                  overflow: "hidden", minWidth: 160,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                }}>
                  {[
                    { label: "Add Character", icon: "👤", action: () => { setCharDrawer(true); setPlusMenuOpen(false); } },
                    { label: "Add Intro",     icon: "▶",  action: () => { setIntro({ text: "", phone: "", type: "contact" }); setPlusMenuOpen(false); } },
                    { label: "Add Outro",     icon: "⏹",  action: () => { setOutro({ text: "", phone: "", type: "contact" }); setPlusMenuOpen(false); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{
                      width: "100%", padding: "10px 14px", background: "transparent",
                      border: "none", color: C.ink, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.sky}10`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                      <span>{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Character chips */}
            {characters.map(ch => (
              <div key={ch.id} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 10px 3px 4px", borderRadius: 20,
                background: `${C.lilac}18`, border: `1px solid ${C.lilac}35`,
              }}>
                {ch.imageUrl ? (
                  <img src={ch.imageUrl} alt={ch.name} style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: C.lilac, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800,
                  }}>{ch.name.slice(0, 1)}</div>
                )}
                <span style={{ fontSize: 10, fontWeight: 600, color: C.lilac }}>{ch.name}</span>
                <button onClick={() => handleCharSelect(selectedCharIds.filter(id => id !== ch.id))} style={{
                  background: "none", border: "none", color: C.mute2, fontSize: 10, cursor: "pointer", padding: 0, lineHeight: 1, marginLeft: 2,
                }}>×</button>
              </div>
            ))}

            {/* Add Character */}
            <button onClick={() => setCharDrawer(true)} style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: `1px solid ${C.line}`, background: "transparent",
              color: C.mute, cursor: "pointer",
            }}>+ Character</button>

            {/* Add Intro */}
            <button onClick={() => { if (!intro) setIntro({ text: "", phone: "", type: "contact" }); }} style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: `1px solid ${intro ? C.mint + "50" : C.line}`,
              background: intro ? `${C.mint}12` : "transparent",
              color: intro ? C.mint : C.mute, cursor: "pointer",
            }}>Intro</button>

            {/* Add Outro */}
            <button onClick={() => { if (!outro) setOutro({ text: "", phone: "", type: "contact" }); }} style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              border: `1px solid ${outro ? C.gold + "50" : C.line}`,
              background: outro ? `${C.gold}12` : "transparent",
              color: outro ? C.gold : C.mute, cursor: "pointer",
            }}>Outro</button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Daily limit counters */}
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: limits.imageRemaining <= 0 ? `${C.coral}12` : `${C.lilac}12`,
                color: limits.imageRemaining <= 0 ? C.coral : C.lilac,
                border: `1px solid ${limits.imageRemaining <= 0 ? C.coral + "40" : C.lilac + "30"}`,
              }}>
                🖼️ {limits.imageCount}/{limits.imageLimit}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                background: limits.videoRemaining <= 0 ? `${C.coral}12` : `${C.gold}12`,
                color: limits.videoRemaining <= 0 ? C.coral : C.gold,
                border: `1px solid ${limits.videoRemaining <= 0 ? C.coral + "40" : C.gold + "30"}`,
              }}>
                🎬 {limits.videoCount}/{limits.videoLimit}
              </span>
            </div>
          </div>

          {/* Text input */}
          <div style={{ position: "relative" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your story, movie idea, ad concept, or anything creative…"
              rows={2}
              disabled={sending}
              style={{
                width: "100%", boxSizing: "border-box",
                background: C.alert, border: `1.5px solid ${C.line}`,
                borderRadius: 12, color: C.ink, fontSize: 13,
                padding: "11px 56px 11px 14px",
                resize: "none", outline: "none", lineHeight: 1.65,
                fontFamily: "inherit", transition: "border-color 0.2s",
                opacity: sending ? 0.6 : 1,
              }}
              onFocus={e => (e.target.style.borderColor = C.sky + "80")}
              onBlur={e => (e.target.style.borderColor = C.line)}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || sending}
              style={{
                position: "absolute", bottom: 8, right: 8,
                width: 36, height: 36, borderRadius: 9, border: "none",
                background: (!input.trim() || sending)
                  ? C.alert
                  : "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%)",
                color: (!input.trim() || sending) ? C.mute : "#fff",
                fontSize: 16, cursor: (!input.trim() || sending) ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: (!input.trim() || sending) ? "none" : "0 3px 16px rgba(236,72,153,0.45)",
                transition: "all 0.15s",
              }}
            >{sending ? "⟳" : "↑"}</button>
          </div>
          <div style={{ fontSize: 10, color: C.mute2, marginTop: 4 }}>
            ⌘↵ to send
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function FreeModePageWrapper() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#0e0e10",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700 }}>Loading Free Mode…</div>
      </div>
    }>
      <FreeModeChat />
    </Suspense>
  );
}
