"use client";

import { useEffect, useRef, useState } from "react";
import AITierSelector, { type AITier } from "../../components/AITierSelector";

// ── Types ──────────────────────────────────────────────────────────────────
interface StoryScene {
  id: string;
  title: string | null;
  description: string;
  durationSeconds: number;
  orderIndex: number;
  notes: string | null;
}

interface Chapter {
  id: string;
  title: string;
  summary: string | null;
  orderIndex: number;
  scenes: StoryScene[];
}

interface Story {
  id: string;
  title: string;
  genre: string | null;
  tone: string | null;
  logline: string | null;
  targetDurationSeconds: number;
  status: string;
  chapters: Chapter[];
  createdAt: string;
  updatedAt: string;
}

interface ChatMsg { role: "user" | "ai"; content: string; }

// ── Design tokens ──────────────────────────────────────────────────────────
const bg      = "#0b0b14";
const surface = "#13131f";
const card    = "#1a1a2e";
const border  = "#ffffff12";
const accent  = "#f5c518";
const purple  = "#8b5cf6";
const green   = "#22c55e";
const muted   = "#888";
const red     = "#ef4444";
const input: React.CSSProperties = {
  background: "#0d0d1a", border: `1px solid ${border}`, borderRadius: 8,
  color: "#fff", outline: "none", fontFamily: "inherit",
};

const DURATION_OPTIONS = [5, 8, 10, 15, 20, 30];
const GENRES = ["Action", "Adventure", "Animation", "Children", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Horror", "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller"];
const TONES  = ["Heartwarming", "Epic", "Dark", "Funny", "Inspirational", "Suspenseful", "Romantic", "Mysterious", "Calm", "Energetic"];

const STATUSES = ["draft", "scripted", "in_production", "done"] as const;
type StoryStatus = typeof STATUSES[number];
const STATUS_COLORS: Record<string, string> = {
  draft: "#888",
  scripted: "#60a5fa",
  in_production: "#f59e0b",
  done: "#22c55e",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scripted: "Scripted",
  in_production: "In Production",
  done: "Done",
};

function totalDur(chapters: Chapter[]) {
  return chapters.flatMap(c => c.scenes).reduce((s, sc) => s + sc.durationSeconds, 0);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function StoryBankPage() {
  const [stories, setStories]         = useState<Story[]>([]);
  const [active, setActive]           = useState<Story | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [status, setStatus]           = useState("");

  // New story form
  const [showNew, setShowNew]         = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newGenre, setNewGenre]       = useState("");
  const [newTone, setNewTone]         = useState("");
  const [newLogline, setNewLogline]   = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [creating, setCreating]       = useState(false);

  // Expand
  const [expanding, setExpanding]     = useState(false);
  const [expandNotes, setExpandNotes] = useState("");
  const [aiTier, setAiTier]           = useState<AITier>("pro");

  // Chapter / scene edit
  const [editingChapter, setEditingChapter]   = useState<string | null>(null);
  const [editingScene, setEditingScene]       = useState<string | null>(null);
  const [expandingChapter, setExpandingChapter] = useState<string | null>(null);
  const [chapterNotes, setChapterNotes]       = useState("");
  const [collapsed, setCollapsed]             = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus]       = useState<string>("all");

  // Brainstorm panel
  const [showChat, setShowChat]       = useState(false);
  const [chatInput, setChatInput]     = useState("");
  const [chatMsgs, setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottom                    = useRef<HTMLDivElement>(null);

  // ── Load stories ──
  useEffect(() => {
    fetch("/api/story-bank/stories")
      .then(r => r.json())
      .then(d => { setStories(d.stories || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Load full story with chapters + scenes ──
  async function loadStory(id: string) {
    setStatus("Loading…");
    const r = await fetch(`/api/story-bank/stories/${id}`);
    const d = await r.json();
    if (d.story) { setActive(d.story); setStatus(""); }
    else setStatus("Failed to load story");
  }

  // ── Create story ──
  async function createStory() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const r = await fetch("/api/story-bank/stories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, genre: newGenre, tone: newTone, logline: newLogline, targetDurationSeconds: newDuration }),
    });
    const d = await r.json();
    if (d.id) {
      setShowNew(false); setNewTitle(""); setNewGenre(""); setNewTone(""); setNewLogline(""); setNewDuration(60);
      await refreshList();
      await loadStory(d.id);
    }
    setCreating(false);
  }

  async function refreshList() {
    const r = await fetch("/api/story-bank/stories");
    const d = await r.json();
    setStories(d.stories || []);
  }

  // ── AI expand full story ──
  async function expandStory() {
    if (!active) return;
    setExpanding(true); setStatus("AI is expanding your story into chapters and scenes…");
    try {
      const r = await fetch(`/api/story-bank/stories/${active.id}/expand`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: active.title, genre: active.genre, tone: active.tone,
          logline: active.logline, targetDurationSeconds: active.targetDurationSeconds, userNotes: expandNotes,
        }),
      });
      const d = await r.json();
      if (!d.ok) { setStatus(`Expand failed: ${d.error}`); return; }

      // Save expanded chapters + scenes to DB
      const exp = d.expanded;
      if (exp.logline) await fetch(`/api/story-bank/stories/${active.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logline: exp.logline }) });

      for (let ci = 0; ci < (exp.chapters || []).length; ci++) {
        const ch = exp.chapters[ci];
        const cr = await fetch(`/api/story-bank/stories/${active.id}/chapters`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: ch.title, summary: ch.summary, orderIndex: ci }),
        });
        const cd = await cr.json();
        if (cd.id) {
          for (let si = 0; si < (ch.scenes || []).length; si++) {
            const sc = ch.scenes[si];
            await fetch(`/api/story-bank/chapters/${cd.id}/scenes`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: sc.title, description: sc.description, durationSeconds: sc.durationSeconds, orderIndex: si, notes: sc.notes }),
            });
          }
        }
      }
      setStatus("Story expanded! Chapters and scenes saved.");
      setExpandNotes("");
      await loadStory(active.id);
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    setExpanding(false);
  }

  // ── AI expand single chapter ──
  async function expandChapter(ch: Chapter) {
    if (!active) return;
    setExpandingChapter(ch.id);
    setStatus(`Expanding chapter: "${ch.title}"…`);
    try {
      const totalChDur = Math.round((active.targetDurationSeconds || 60) / Math.max((active.chapters || []).length, 1));
      const r = await fetch(`/api/story-bank/chapters/${ch.id}/expand`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterTitle: ch.title, chapterSummary: ch.summary,
          storyContext: `${active.title} — ${active.logline || ""}`,
          targetDurationSeconds: totalChDur,
          userNotes: chapterNotes,
          existingScenes: ch.scenes,
        }),
      });
      const d = await r.json();
      if (!d.ok) { setStatus(`Chapter expand failed: ${d.error}`); return; }
      const exp = d.expanded;

      // Update chapter summary
      if (exp.summary) await fetch(`/api/story-bank/chapters/${ch.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: exp.summary }) });

      // Add new scenes
      for (let si = 0; si < (exp.scenes || []).length; si++) {
        const sc = exp.scenes[si];
        await fetch(`/api/story-bank/chapters/${ch.id}/scenes`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: sc.title, description: sc.description, durationSeconds: sc.durationSeconds, orderIndex: ch.scenes.length + si, notes: sc.notes }),
        });
      }
      setStatus(`Chapter "${ch.title}" expanded!`);
      setChapterNotes("");
      await loadStory(active.id);
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    setExpandingChapter(null);
  }

  // ── Save scene edits ──
  async function saveScene(sc: StoryScene) {
    setSaving(true);
    await fetch(`/api/story-bank/scenes/${sc.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: sc.title, description: sc.description, durationSeconds: sc.durationSeconds, notes: sc.notes }),
    });
    setSaving(false); setEditingScene(null);
    if (active) loadStory(active.id);
  }

  // ── Delete scene ──
  async function deleteScene(scId: string) {
    await fetch(`/api/story-bank/scenes/${scId}`, { method: "DELETE" });
    if (active) loadStory(active.id);
  }

  // ── Delete chapter ──
  async function deleteChapter(chId: string) {
    await fetch(`/api/story-bank/chapters/${chId}`, { method: "DELETE" });
    if (active) loadStory(active.id);
  }

  // ── Add blank scene to chapter ──
  async function addScene(chId: string, chScenes: StoryScene[]) {
    await fetch(`/api/story-bank/chapters/${chId}/scenes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New scene", description: "", durationSeconds: 5, orderIndex: chScenes.length }),
    });
    if (active) loadStory(active.id);
  }

  // ── Add blank chapter ──
  async function addChapter() {
    if (!active) return;
    const r = await fetch(`/api/story-bank/stories/${active.id}/chapters`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chapter", orderIndex: active.chapters.length }),
    });
    const d = await r.json();
    if (d.id) { loadStory(active.id); }
  }

  // ── Update story status ──
  async function updateStoryStatus(storyId: string, newStatus: string) {
    await fetch(`/api/story-bank/stories/${storyId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, status: newStatus } : s));
    if (active?.id === storyId) setActive(prev => prev ? { ...prev, status: newStatus } : prev);
  }

  // ── Delete story ──
  async function deleteStory(storyId: string) {
    if (!confirm("Delete this story and all its chapters and scenes?")) return;
    await fetch(`/api/story-bank/stories/${storyId}`, { method: "DELETE" });
    if (active?.id === storyId) setActive(null);
    await refreshList();
  }

  // ── Brainstorm chat ──
  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    const userMsg: ChatMsg = { role: "user", content: msg };
    setChatMsgs(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const r = await fetch("/api/story-bank/brainstorm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          storyContext: active ? `${active.title} (${active.genre}, ${active.tone}) — ${active.logline}` : "",
          messages: chatMsgs.slice(-6),
        }),
      });
      const d = await r.json();
      setChatMsgs(prev => [...prev, { role: "ai", content: d.reply || d.error || "No response" }]);
    } catch { setChatMsgs(prev => [...prev, { role: "ai", content: "Connection error" }]); }
    setChatLoading(false);
    setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // ── Send to Hybrid Planner ──
  async function sendToHybrid() {
    if (!active || !active.chapters.length) return;
    const allScenes = active.chapters.flatMap((ch, ci) =>
      ch.scenes.map((sc, si) => ({
        scene: ci * 100 + si + 1,
        sceneId: sc.id,
        title: `${ch.title} — ${sc.title || `Scene ${si + 1}`}`,
        description: sc.description,
        motionDuration: sc.durationSeconds,
        characterIds: [],
      }))
    );
    localStorage.setItem("ghs_story_bank_import", JSON.stringify({ story: active, scenes: allScenes }));
    window.location.href = "/dashboard/hybrid-planner";
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const activeDur = active ? totalDur(active.chapters) : 0;

  return (
    <div style={{ display: "flex", height: "100vh", background: bg, fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>

      {/* ── LEFT SIDEBAR — story list ── */}
      <div style={{ width: 260, background: surface, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", margin: 0 }}>📚 Story Bank</p>
          <p style={{ fontSize: 10, color: muted, margin: "2px 0 10px" }}>Your story development studio</p>
          <button onClick={() => setShowNew(true)}
            style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
            + New Story
          </button>
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            {["all", ...STATUSES].map(st => (
              <button key={st} onClick={() => setFilterStatus(st)}
                style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${filterStatus === st ? (STATUS_COLORS[st] || accent) : "#ffffff15"}`, background: filterStatus === st ? `${STATUS_COLORS[st] || accent}20` : "transparent", color: filterStatus === st ? (STATUS_COLORS[st] || accent) : muted, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                {st === "all" ? "All" : STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loading ? <p style={{ fontSize: 11, color: muted, padding: 8 }}>Loading…</p> :
            stories.length === 0 ? <p style={{ fontSize: 11, color: muted, padding: 8 }}>No stories yet. Create one.</p> :
              stories.filter(s => filterStatus === "all" || s.status === filterStatus).map(s => (
                <div key={s.id} onClick={() => loadStory(s.id)}
                  style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 4, cursor: "pointer", background: active?.id === s.id ? `${accent}15` : "transparent", border: `1px solid ${active?.id === s.id ? `${accent}40` : "transparent"}`, position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: active?.id === s.id ? accent : "#fff", margin: 0, flex: 1, lineHeight: 1.3 }}>{s.title}</p>
                    <button onClick={e => { e.stopPropagation(); deleteStory(s.id); }}
                      style={{ background: "transparent", border: "none", color: "#ffffff20", fontSize: 12, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
                      title="Delete story">✕</button>
                  </div>
                  <p style={{ fontSize: 10, color: muted, margin: "3px 0 5px" }}>{s.genre || "No genre"}</p>
                  <select value={s.status} onClick={e => e.stopPropagation()}
                    onChange={async e => { e.stopPropagation(); await updateStoryStatus(s.id, e.target.value); }}
                    style={{ background: `${STATUS_COLORS[s.status] || muted}18`, border: `1px solid ${STATUS_COLORS[s.status] || muted}40`, borderRadius: 5, color: STATUS_COLORS[s.status] || muted, fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "2px 6px", outline: "none" }}>
                    {STATUSES.map(st => <option key={st} value={st} style={{ background: "#1a1a2e", color: "#fff" }}>{STATUS_LABELS[st]}</option>)}
                  </select>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${border}`, background: surface, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {active ? (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>{active.title}</p>
                  <select value={active.status}
                    onChange={async e => updateStoryStatus(active.id, e.target.value)}
                    style={{ background: `${STATUS_COLORS[active.status] || muted}20`, border: `1px solid ${STATUS_COLORS[active.status] || muted}50`, borderRadius: 6, color: STATUS_COLORS[active.status] || muted, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "3px 8px", outline: "none" }}>
                    {STATUSES.map(st => <option key={st} value={st} style={{ background: "#1a1a2e", color: "#fff" }}>{STATUS_LABELS[st]}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: 10, color: muted, margin: 0 }}>{active.genre} · {active.tone} · {activeDur}s assembled / {active.targetDurationSeconds}s target · {active.chapters.length} chapters</p>
              </div>
              <button onClick={() => setShowChat(v => !v)}
                style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${purple}40`, background: showChat ? `${purple}20` : "transparent", color: purple, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                🧠 Brainstorm AI
              </button>
              <button onClick={sendToHybrid}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${green}, #16a34a)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                → Send to Hybrid Planner
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: muted }}>Select a story from the sidebar or create a new one</p>
          )}
        </div>

        {/* Status bar */}
        {status && (
          <div style={{ padding: "8px 20px", background: status.includes("failed") || status.includes("Error") ? "#2a0a0a" : "#0a1a2a", borderBottom: `1px solid ${border}` }}>
            <p style={{ fontSize: 11, color: status.includes("failed") || status.includes("Error") ? red : accent, margin: 0, fontWeight: 600 }}>{status}</p>
          </div>
        )}

        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Story editor */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

            {/* New story form */}
            {showNew && (
              <div style={{ background: card, borderRadius: 14, padding: 20, border: `1px solid ${accent}30`, marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: accent, marginBottom: 14 }}>New Story</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Story title *"
                    style={{ ...input, padding: "9px 12px", fontSize: 13, gridColumn: "1/-1" }} />
                  <select value={newGenre} onChange={e => setNewGenre(e.target.value)}
                    style={{ ...input, padding: "9px 12px", fontSize: 12 }}>
                    <option value="">Genre</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={newTone} onChange={e => setNewTone(e.target.value)}
                    style={{ ...input, padding: "9px 12px", fontSize: 12 }}>
                    <option value="">Tone</option>
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <textarea value={newLogline} onChange={e => setNewLogline(e.target.value)} placeholder="One-line pitch (optional)"
                    rows={2} style={{ ...input, padding: "9px 12px", fontSize: 12, resize: "none", gridColumn: "1/-1" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: muted }}>Target duration:</span>
                    <input type="number" value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} min={10} max={3600}
                      style={{ ...input, padding: "6px 10px", fontSize: 12, width: 80 }} />
                    <span style={{ fontSize: 11, color: muted }}>seconds</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={createStory} disabled={!newTitle.trim() || creating}
                    style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: creating ? "#2a2a40" : "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                    {creating ? "Creating…" : "Create Story"}
                  </button>
                  <button onClick={() => setShowNew(false)}
                    style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {active && (
              <>
                {/* Story expand panel */}
                {active.chapters.length === 0 && (
                  <div style={{ background: card, borderRadius: 14, padding: 20, border: `1px solid ${purple}30`, marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: purple, marginBottom: 8 }}>🤖 Let AI expand your story into chapters and scenes</p>
                    <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>AI will create chapters, write visual scene descriptions, and set scene durations based on your target video length.</p>
                    <textarea value={expandNotes} onChange={e => setExpandNotes(e.target.value)}
                      placeholder="Any notes for AI? (e.g. 'Make it dramatic', 'Child-friendly', '5s clips only'…)"
                      rows={2} style={{ ...input, width: "100%", padding: "9px 12px", fontSize: 12, resize: "none", marginBottom: 10, boxSizing: "border-box" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: muted, flexShrink: 0 }}>AI Model</span>
                      <AITierSelector value={aiTier} onChange={setAiTier} compact />
                    </div>
                    <button onClick={expandStory} disabled={expanding}
                      style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: expanding ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      {expanding ? "⟳ Expanding…" : "✨ Expand Story with AI"}
                    </button>
                  </div>
                )}

                {/* Chapters */}
                {active.chapters.sort((a, b) => a.orderIndex - b.orderIndex).map((ch, ci) => {
                  const chDur = ch.scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
                  const isCollapsed = collapsed[ch.id];
                  return (
                    <div key={ch.id} style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, marginBottom: 12 }}>
                      {/* Chapter header */}
                      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setCollapsed(p => ({ ...p, [ch.id]: !p[ch.id] }))}
                          style={{ background: "transparent", border: "none", color: muted, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                          {isCollapsed ? "▶" : "▼"}
                        </button>
                        <div style={{ flex: 1 }}>
                          {editingChapter === ch.id ? (
                            <input defaultValue={ch.title} autoFocus
                              onBlur={async e => {
                                await fetch(`/api/story-bank/chapters/${ch.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: e.target.value }) });
                                setEditingChapter(null); loadStory(active.id);
                              }}
                              style={{ ...input, padding: "4px 8px", fontSize: 13, fontWeight: 700, width: "100%" }} />
                          ) : (
                            <p onDoubleClick={() => setEditingChapter(ch.id)}
                              style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, cursor: "text" }}>
                              Chapter {ci + 1}: {ch.title}
                            </p>
                          )}
                          {ch.summary && <p style={{ fontSize: 10, color: muted, margin: "2px 0 0" }}>{ch.summary}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, color: accent, fontWeight: 700, background: `${accent}15`, padding: "3px 8px", borderRadius: 5 }}>{chDur}s</span>
                          <span style={{ fontSize: 10, color: muted }}>{ch.scenes.length} scenes</span>
                          <button onClick={() => { setExpandingChapter(ch.id === expandingChapter ? null : ch.id); setChapterNotes(""); }}
                            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${purple}40`, background: "transparent", color: purple, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                            🤖 AI
                          </button>
                          <button onClick={() => deleteChapter(ch.id)}
                            style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 10, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>

                      {/* Chapter AI expand panel */}
                      {expandingChapter === ch.id && (
                        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: 10, background: `${purple}08`, border: `1px solid ${purple}20` }}>
                          <textarea value={chapterNotes} onChange={e => setChapterNotes(e.target.value)}
                            placeholder="Notes for AI? (e.g. 'Add more tension', 'Keep scenes 5s', 'Focus on dialogue'…)"
                            rows={2} style={{ ...input, width: "100%", padding: "8px 10px", fontSize: 11, resize: "none", marginBottom: 8, boxSizing: "border-box" }} />
                          <button onClick={() => expandChapter(ch)} disabled={expandingChapter !== ch.id || expanding}
                            style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            ✨ Expand Chapter
                          </button>
                        </div>
                      )}

                      {/* Scenes */}
                      {!isCollapsed && (
                        <div style={{ padding: "0 16px 14px" }}>
                          {ch.scenes.sort((a, b) => a.orderIndex - b.orderIndex).map((sc, si) => (
                            <div key={sc.id} style={{ background: "#0d0d1a", borderRadius: 10, border: `1px solid ${border}`, padding: 12, marginBottom: 6 }}>
                              {editingScene === sc.id ? (
                                <SceneEditor scene={sc} onSave={saveScene} onCancel={() => setEditingScene(null)} />
                              ) : (
                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                  {/* Duration badge */}
                                  <div style={{ flexShrink: 0, background: `${accent}15`, border: `1px solid ${accent}30`, borderRadius: 8, padding: "6px 10px", textAlign: "center", minWidth: 44 }}>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: accent, margin: 0 }}>{sc.durationSeconds}s</p>
                                    <p style={{ fontSize: 8, color: muted, margin: 0 }}>CLIP</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>
                                      {si + 1}. {sc.title || "Untitled scene"}
                                    </p>
                                    <p style={{ fontSize: 11, color: "#bbb", margin: 0, lineHeight: 1.5 }}>{sc.description || <span style={{ color: muted }}>No description yet</span>}</p>
                                    {sc.notes && <p style={{ fontSize: 10, color: purple, margin: "4px 0 0" }}>📝 {sc.notes}</p>}
                                  </div>
                                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                    <button onClick={() => setEditingScene(sc.id)}
                                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>Edit</button>
                                    <button onClick={() => deleteScene(sc.id)}
                                      style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 10, cursor: "pointer" }}>✕</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <button onClick={() => addScene(ch.id, ch.scenes)}
                            style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: `1px dashed ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer", marginTop: 4 }}>
                            + Add Scene
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add chapter button */}
                <button onClick={addChapter}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1px dashed ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
                  + Add Chapter
                </button>

                {/* Duration summary */}
                {active.chapters.length > 0 && (
                  <div style={{ background: card, borderRadius: 12, padding: 14, border: `1px solid ${border}`, marginBottom: 20, display: "flex", gap: 20 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: accent, margin: 0 }}>{activeDur}s</p>
                      <p style={{ fontSize: 9, color: muted, margin: 0 }}>TOTAL ASSEMBLED</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: active.targetDurationSeconds && activeDur <= active.targetDurationSeconds ? green : red, margin: 0 }}>{active.targetDurationSeconds}s</p>
                      <p style={{ fontSize: 9, color: muted, margin: 0 }}>TARGET</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>{active.chapters.flatMap(c => c.scenes).length}</p>
                      <p style={{ fontSize: 9, color: muted, margin: 0 }}>TOTAL SCENES</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>{active.chapters.length}</p>
                      <p style={{ fontSize: 9, color: muted, margin: 0 }}>CHAPTERS</p>
                    </div>
                    {saving && <p style={{ fontSize: 11, color: muted, alignSelf: "center" }}>Saving…</p>}
                  </div>
                )}
              </>
            )}

            {!active && !showNew && (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📖</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Your Story Development Studio</p>
                <p style={{ fontSize: 12, color: muted, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
                  Write your story idea → AI expands into chapters and scenes → each scene gets a duration → send to Hybrid Planner to produce the video.
                </p>
                <button onClick={() => setShowNew(true)}
                  style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  + Create Your First Story
                </button>
              </div>
            )}
          </div>

          {/* ── BRAINSTORM PANEL ── */}
          {showChat && (
            <div style={{ width: 320, background: surface, borderLeft: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: purple, margin: 0 }}>🧠 AI Brainstorm</p>
                <p style={{ fontSize: 10, color: muted, margin: "2px 0 0" }}>Ask anything about your story. Low cost — local AI.</p>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {chatMsgs.length === 0 && (
                  <p style={{ fontSize: 11, color: muted, textAlign: "center", paddingTop: 20 }}>
                    Ask me anything — plot holes, character ideas, scene suggestions, pacing…
                  </p>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 10, fontSize: 11, lineHeight: 1.5,
                    background: m.role === "user" ? `${purple}20` : "#0d0d1a",
                    color: m.role === "user" ? "#fff" : "#ddd",
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%", border: `1px solid ${m.role === "user" ? `${purple}30` : border}` }}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && <div style={{ padding: "8px 10px", borderRadius: 10, fontSize: 11, color: muted, background: "#0d0d1a", border: `1px solid ${border}` }}>Thinking…</div>}
                <div ref={chatBottom} />
              </div>
              <div style={{ padding: 10, borderTop: `1px solid ${border}`, display: "flex", gap: 6 }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }}}
                  placeholder="Ask AI…" rows={2}
                  style={{ ...input, flex: 1, padding: "8px 10px", fontSize: 11, resize: "none" }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: chatLoading ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>
                  ↑
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scene inline editor ────────────────────────────────────────────────────
function SceneEditor({ scene, onSave, onCancel }: { scene: StoryScene; onSave: (s: StoryScene) => void; onCancel: () => void }) {
  const [s, setS] = useState({ ...scene });
  const input: React.CSSProperties = { background: "#0d0d1a", border: "1px solid #ffffff12", borderRadius: 8, color: "#fff", outline: "none", fontFamily: "inherit" };
  const accent = "#f5c518";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={s.title || ""} onChange={e => setS(p => ({ ...p, title: e.target.value }))} placeholder="Scene title"
        style={{ ...input, padding: "7px 10px", fontSize: 12 }} />
      <textarea value={s.description} onChange={e => setS(p => ({ ...p, description: e.target.value }))} placeholder="What the camera sees…"
        rows={3} style={{ ...input, padding: "7px 10px", fontSize: 12, resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#888" }}>Duration:</span>
        {[5, 8, 10, 15, 20, 30].map(d => (
          <button key={d} onClick={() => setS(p => ({ ...p, durationSeconds: d }))}
            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${s.durationSeconds === d ? "#10b981" : "#ffffff12"}`, background: s.durationSeconds === d ? "#10b98120" : "transparent", color: s.durationSeconds === d ? "#10b981" : "#888", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {d}s
          </button>
        ))}
        <input type="number" value={s.durationSeconds} onChange={e => setS(p => ({ ...p, durationSeconds: Number(e.target.value) }))} min={1} max={120}
          style={{ ...input, padding: "4px 8px", fontSize: 11, width: 60 }} />
      </div>
      <input value={s.notes || ""} onChange={e => setS(p => ({ ...p, notes: e.target.value }))} placeholder="Director note (optional)"
        style={{ ...input, padding: "7px 10px", fontSize: 11 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onSave(s)}
          style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
          ✓ Save
        </button>
        <button onClick={onCancel}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #ffffff12", background: "transparent", color: "#888", fontSize: 11, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
