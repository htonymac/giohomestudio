"use client";

import { useEffect, useRef, useState } from "react";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

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

// ── Local style tokens ─────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  background: ds.color.paper,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm,
  color: ds.color.ink,
  outline: "none",
  fontFamily: ds.font.sans,
};

const DURATION_OPTIONS = [5, 8, 10, 15, 20, 30];
const GENRES = ["Action", "Adventure", "Animation", "Children", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Horror", "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller"];
const TONES  = ["Heartwarming", "Epic", "Dark", "Funny", "Inspirational", "Suspenseful", "Romantic", "Mysterious", "Calm", "Energetic"];

const STATUSES = ["draft", "scripted", "in_production", "done"] as const;
type StoryStatus = typeof STATUSES[number];
const STATUS_COLORS: Record<string, string> = {
  draft:         ds.color.mute,
  scripted:      ds.color.sky,
  in_production: ds.color.gold,
  done:          ds.color.mint,
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", scripted: "Scripted", in_production: "In Production", done: "Done",
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

  const [showNew, setShowNew]         = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const [newGenre, setNewGenre]       = useState("");
  const [newTone, setNewTone]         = useState("");
  const [newLogline, setNewLogline]   = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [creating, setCreating]       = useState(false);

  const [expanding, setExpanding]     = useState(false);
  const [expandNotes, setExpandNotes] = useState("");
  const [aiTier, setAiTier]           = useState<AITier>("pro");

  const [editingChapter, setEditingChapter]   = useState<string | null>(null);
  const [editingScene, setEditingScene]       = useState<string | null>(null);
  const [expandingChapter, setExpandingChapter] = useState<string | null>(null);
  const [chapterNotes, setChapterNotes]       = useState("");
  const [collapsed, setCollapsed]             = useState<Record<string, boolean>>({});
  const [filterStatus, setFilterStatus]       = useState<string>("all");

  const [showChat, setShowChat]       = useState(false);
  const [chatInput, setChatInput]     = useState("");
  const [chatMsgs, setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottom                    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/story-bank/stories")
      .then(r => r.json())
      .then(d => { setStories(d.stories || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function loadStory(id: string) {
    setStatus("Loading…");
    const r = await fetch(`/api/story-bank/stories/${id}`);
    const d = await r.json();
    if (d.story) { setActive(d.story); setStatus(""); }
    else setStatus("Failed to load story");
  }

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
      await refreshList(); await loadStory(d.id);
    }
    setCreating(false);
  }

  async function refreshList() {
    const r = await fetch("/api/story-bank/stories");
    const d = await r.json();
    setStories(d.stories || []);
  }

  async function expandStory() {
    if (!active) return;
    setExpanding(true); setStatus("AI is expanding your story into chapters and scenes…");
    try {
      const r = await fetch(`/api/story-bank/stories/${active.id}/expand`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: active.title, genre: active.genre, tone: active.tone, logline: active.logline, targetDurationSeconds: active.targetDurationSeconds, userNotes: expandNotes }),
      });
      const d = await r.json();
      if (!d.ok) { setStatus(`Expand failed: ${d.error}`); return; }
      const exp = d.expanded;
      if (exp.logline) await fetch(`/api/story-bank/stories/${active.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logline: exp.logline }) });
      for (let ci = 0; ci < (exp.chapters || []).length; ci++) {
        const ch = exp.chapters[ci];
        const cr = await fetch(`/api/story-bank/stories/${active.id}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: ch.title, summary: ch.summary, orderIndex: ci }) });
        const cd = await cr.json();
        if (cd.id) {
          for (let si = 0; si < (ch.scenes || []).length; si++) {
            const sc = ch.scenes[si];
            await fetch(`/api/story-bank/chapters/${cd.id}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: sc.title, description: sc.description, durationSeconds: sc.durationSeconds, orderIndex: si, notes: sc.notes }) });
          }
        }
      }
      setStatus("Story expanded! Chapters and scenes saved.");
      setExpandNotes(""); await loadStory(active.id);
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    setExpanding(false);
  }

  async function expandChapter(ch: Chapter) {
    if (!active) return;
    setExpandingChapter(ch.id); setStatus(`Expanding chapter: "${ch.title}"…`);
    try {
      const totalChDur = Math.round((active.targetDurationSeconds || 60) / Math.max((active.chapters || []).length, 1));
      const r = await fetch(`/api/story-bank/chapters/${ch.id}/expand`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterTitle: ch.title, chapterSummary: ch.summary, storyContext: `${active.title} — ${active.logline || ""}`, targetDurationSeconds: totalChDur, userNotes: chapterNotes, existingScenes: ch.scenes }),
      });
      const d = await r.json();
      if (!d.ok) { setStatus(`Chapter expand failed: ${d.error}`); return; }
      const exp = d.expanded;
      if (exp.summary) await fetch(`/api/story-bank/chapters/${ch.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: exp.summary }) });
      for (let si = 0; si < (exp.scenes || []).length; si++) {
        const sc = exp.scenes[si];
        await fetch(`/api/story-bank/chapters/${ch.id}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: sc.title, description: sc.description, durationSeconds: sc.durationSeconds, orderIndex: ch.scenes.length + si, notes: sc.notes }) });
      }
      setStatus(`Chapter "${ch.title}" expanded!`); setChapterNotes(""); await loadStory(active.id);
    } catch (e) { setStatus(`Error: ${String(e)}`); }
    setExpandingChapter(null);
  }

  async function saveScene(sc: StoryScene) {
    setSaving(true);
    await fetch(`/api/story-bank/scenes/${sc.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: sc.title, description: sc.description, durationSeconds: sc.durationSeconds, notes: sc.notes }) });
    setSaving(false); setEditingScene(null);
    if (active) loadStory(active.id);
  }

  async function deleteScene(scId: string) {
    await fetch(`/api/story-bank/scenes/${scId}`, { method: "DELETE" });
    if (active) loadStory(active.id);
  }

  async function deleteChapter(chId: string) {
    await fetch(`/api/story-bank/chapters/${chId}`, { method: "DELETE" });
    if (active) loadStory(active.id);
  }

  async function addScene(chId: string, chScenes: StoryScene[]) {
    await fetch(`/api/story-bank/chapters/${chId}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New scene", description: "", durationSeconds: 5, orderIndex: chScenes.length }) });
    if (active) loadStory(active.id);
  }

  async function addChapter() {
    if (!active) return;
    const r = await fetch(`/api/story-bank/stories/${active.id}/chapters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New Chapter", orderIndex: active.chapters.length }) });
    const d = await r.json();
    if (d.id) { loadStory(active.id); }
  }

  async function updateStoryStatus(storyId: string, newSt: string) {
    await fetch(`/api/story-bank/stories/${storyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newSt }) });
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, status: newSt } : s));
    if (active?.id === storyId) setActive(prev => prev ? { ...prev, status: newSt } : prev);
  }

  async function deleteStory(storyId: string) {
    if (!confirm("Delete this story and all its chapters and scenes?")) return;
    await fetch(`/api/story-bank/stories/${storyId}`, { method: "DELETE" });
    if (active?.id === storyId) setActive(null);
    await refreshList();
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    const userMsg: ChatMsg = { role: "user", content: msg };
    setChatMsgs(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const r = await fetch("/api/story-bank/brainstorm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, storyContext: active ? `${active.title} (${active.genre}, ${active.tone}) — ${active.logline}` : "", messages: chatMsgs.slice(-6) }) });
      const d = await r.json();
      setChatMsgs(prev => [...prev, { role: "ai", content: d.reply || d.error || "No response" }]);
    } catch { setChatMsgs(prev => [...prev, { role: "ai", content: "Connection error" }]); }
    setChatLoading(false);
    setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function sendToHybrid() {
    if (!active || !active.chapters.length) return;
    const allScenes = active.chapters.flatMap((ch, ci) =>
      ch.scenes.map((sc, si) => ({ scene: ci * 100 + si + 1, sceneId: sc.id, title: `${ch.title} — ${sc.title || `Scene ${si + 1}`}`, description: sc.description, motionDuration: sc.durationSeconds, characterIds: [] }))
    );
    localStorage.setItem("ghs_story_bank_import", JSON.stringify({ story: active, scenes: allScenes }));
    window.location.href = "/dashboard/hybrid-planner";
  }

  const activeDur = active ? totalDur(active.chapters) : 0;

  const gradBtn: React.CSSProperties = {
    padding: "9px 22px", borderRadius: ds.radius.sm, border: "none",
    background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
    backgroundSize: "300% 100%",
    color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
    fontFamily: ds.font.sans,
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: ds.color.paper, fontFamily: ds.font.sans, overflow: "hidden" }}>

      {/* LEFT SIDEBAR */}
      <div style={{ width: 260, background: ds.color.sidebar, borderRight: `1px solid ${ds.color.line2}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${ds.color.line2}` }}>
          <HeroTitle kicker="Story Studio" title="Story" italic="Bank" />
          <button onClick={() => setShowNew(true)} style={{ ...gradBtn, width: "100%", padding: "8px 0", marginTop: 4, letterSpacing: 0.3, fontSize: 11 }}>
            + New Story
          </button>
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            {["all", ...STATUSES].map(st => (
              <button key={st} onClick={() => setFilterStatus(st)} style={{
                padding: "3px 8px", borderRadius: 5,
                border: `1px solid ${filterStatus === st ? (STATUS_COLORS[st] || ds.color.gold) : ds.color.line}`,
                background: filterStatus === st ? `${STATUS_COLORS[st] || ds.color.gold}20` : "transparent",
                color: filterStatus === st ? (STATUS_COLORS[st] || ds.color.gold) : ds.color.mute,
                fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: ds.font.mono,
              }}>
                {st === "all" ? "All" : STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loading ? <p style={{ fontSize: 11, color: ds.color.mute, padding: 8 }}>Loading…</p> :
            stories.length === 0 ? <p style={{ fontSize: 11, color: ds.color.mute, padding: 8 }}>No stories yet. Create one.</p> :
              stories.filter(s => filterStatus === "all" || s.status === filterStatus).map(s => (
                <div key={s.id} onClick={() => loadStory(s.id)} style={{
                  padding: "10px 12px", borderRadius: ds.radius.sm, marginBottom: 4, cursor: "pointer",
                  background: active?.id === s.id ? `${ds.color.lilac}12` : "transparent",
                  border: `1px solid ${active?.id === s.id ? `${ds.color.lilac}40` : "transparent"}`,
                  position: "relative",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: active?.id === s.id ? ds.color.lilac : ds.color.ink, margin: 0, flex: 1, lineHeight: 1.3 }}>{s.title}</p>
                    <button onClick={e => { e.stopPropagation(); deleteStory(s.id); }}
                      style={{ background: "transparent", border: "none", color: ds.color.line2, fontSize: 12, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
                      title="Delete story">✕</button>
                  </div>
                  <p style={{ fontSize: 10, color: ds.color.mute, margin: "3px 0 5px", fontFamily: ds.font.mono }}>{s.genre || "No genre"}</p>
                  <select value={s.status} onClick={e => e.stopPropagation()}
                    onChange={async e => { e.stopPropagation(); await updateStoryStatus(s.id, e.target.value); }}
                    style={{ background: `${STATUS_COLORS[s.status] || ds.color.mute}18`, border: `1px solid ${STATUS_COLORS[s.status] || ds.color.mute}40`, borderRadius: 5, color: STATUS_COLORS[s.status] || ds.color.mute, fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "2px 6px", outline: "none" }}>
                    {STATUSES.map(st => <option key={st} value={st} style={{ background: ds.color.card, color: ds.color.ink }}>{STATUS_LABELS[st]}</option>)}
                  </select>
                </div>
              ))
          }
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${ds.color.line2}`, background: ds.color.card, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {active ? (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: ds.color.ink, margin: 0 }}>{active.title}</p>
                  <select value={active.status} onChange={async e => updateStoryStatus(active.id, e.target.value)}
                    style={{ background: `${STATUS_COLORS[active.status] || ds.color.mute}20`, border: `1px solid ${STATUS_COLORS[active.status] || ds.color.mute}50`, borderRadius: 6, color: STATUS_COLORS[active.status] || ds.color.mute, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "3px 8px", outline: "none" }}>
                    {STATUSES.map(st => <option key={st} value={st} style={{ background: ds.color.card, color: ds.color.ink }}>{STATUS_LABELS[st]}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: 10, color: ds.color.mute, margin: 0, fontFamily: ds.font.mono }}>{active.genre} · {active.tone} · {activeDur}s assembled / {active.targetDurationSeconds}s target · {active.chapters.length} chapters</p>
              </div>
              <button onClick={() => setShowChat(v => !v)}
                style={{ padding: "7px 14px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.lilac}40`, background: showChat ? `${ds.color.lilac}20` : "transparent", color: ds.color.lilac, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Brainstorm AI
              </button>
              <button onClick={sendToHybrid} style={gradBtn}>
                Send to Hybrid Planner
              </button>
            </>
          ) : (
            <p style={{ fontSize: 13, color: ds.color.mute }}>Select a story from the sidebar or create a new one</p>
          )}
        </div>

        {/* Status bar */}
        {status && (
          <div style={{ padding: "8px 20px", background: status.includes("failed") || status.includes("Error") ? "#2a0a0a" : `${ds.color.sky}10`, borderBottom: `1px solid ${ds.color.line2}` }}>
            <p style={{ fontSize: 11, color: status.includes("failed") || status.includes("Error") ? "#f87171" : ds.color.gold, margin: 0, fontWeight: 600 }}>{status}</p>
          </div>
        )}

        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Story editor */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

            {/* New story form */}
            {showNew && (
              <div style={{ background: ds.color.card, borderRadius: ds.radius.md, padding: 20, border: `1px solid ${ds.color.lilac}30`, marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: ds.color.lilac, marginBottom: 14 }}>New Story</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Story title *"
                    style={{ ...inputSt, padding: "9px 12px", fontSize: 13, gridColumn: "1/-1" }} />
                  <select value={newGenre} onChange={e => setNewGenre(e.target.value)}
                    style={{ ...inputSt, padding: "9px 12px", fontSize: 12 }}>
                    <option value="">Genre</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={newTone} onChange={e => setNewTone(e.target.value)}
                    style={{ ...inputSt, padding: "9px 12px", fontSize: 12 }}>
                    <option value="">Tone</option>
                    {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <textarea value={newLogline} onChange={e => setNewLogline(e.target.value)} placeholder="One-line pitch (optional)"
                    rows={2} style={{ ...inputSt, padding: "9px 12px", fontSize: 12, resize: "none", gridColumn: "1/-1" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: ds.color.mute }}>Target duration:</span>
                    <input type="number" value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} min={10} max={3600}
                      style={{ ...inputSt, padding: "6px 10px", fontSize: 12, width: 80 }} />
                    <span style={{ fontSize: 11, color: ds.color.mute }}>seconds</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={createStory} disabled={!newTitle.trim() || creating}
                    style={{ ...gradBtn, opacity: creating || !newTitle.trim() ? 0.5 : 1 }}>
                    {creating ? "Creating…" : "Create Story"}
                  </button>
                  <button onClick={() => setShowNew(false)}
                    style={{ padding: "9px 16px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 12, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {active && (
              <>
                {/* Story expand panel */}
                {active.chapters.length === 0 && (
                  <div style={{ background: ds.color.card, borderRadius: ds.radius.md, padding: 20, border: `1px solid ${ds.color.lilac}30`, marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.lilac, marginBottom: 8 }}>Let AI expand your story into chapters and scenes</p>
                    <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12, lineHeight: 1.5 }}>AI will create chapters, write visual scene descriptions, and set scene durations based on your target video length.</p>
                    <textarea value={expandNotes} onChange={e => setExpandNotes(e.target.value)}
                      placeholder="Any notes for AI? (e.g. 'Make it dramatic', 'Child-friendly', '5s clips only'…)"
                      rows={2} style={{ ...inputSt, width: "100%", padding: "9px 12px", fontSize: 12, resize: "none", marginBottom: 10, boxSizing: "border-box" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: ds.color.mute, flexShrink: 0, fontFamily: ds.font.mono }}>AI Model</span>
                      <AITierSelector value={aiTier} onChange={setAiTier} compact />
                    </div>
                    <button onClick={expandStory} disabled={expanding} style={{ ...gradBtn, opacity: expanding ? 0.5 : 1 }}>
                      {expanding ? "Expanding…" : "Expand Story with AI"}
                    </button>
                  </div>
                )}

                {/* Chapters */}
                {active.chapters.sort((a, b) => a.orderIndex - b.orderIndex).map((ch, ci) => {
                  const chDur = ch.scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
                  const isCollapsed = collapsed[ch.id];
                  return (
                    <div key={ch.id} style={{ background: ds.color.card, borderRadius: ds.radius.md, border: `1px solid ${ds.color.line2}`, marginBottom: 12 }}>
                      {/* Chapter header */}
                      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setCollapsed(p => ({ ...p, [ch.id]: !p[ch.id] }))}
                          style={{ background: "transparent", border: "none", color: ds.color.mute, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                          {isCollapsed ? "▶" : "▼"}
                        </button>
                        <div style={{ flex: 1 }}>
                          {editingChapter === ch.id ? (
                            <input defaultValue={ch.title} autoFocus
                              onBlur={async e => {
                                await fetch(`/api/story-bank/chapters/${ch.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: e.target.value }) });
                                setEditingChapter(null); loadStory(active.id);
                              }}
                              style={{ ...inputSt, padding: "4px 8px", fontSize: 13, fontWeight: 700, width: "100%" }} />
                          ) : (
                            <p onDoubleClick={() => setEditingChapter(ch.id)} style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, margin: 0, cursor: "text" }}>
                              Chapter {ci + 1}: {ch.title}
                            </p>
                          )}
                          {ch.summary && <p style={{ fontSize: 10, color: ds.color.mute, margin: "2px 0 0" }}>{ch.summary}</p>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, color: ds.color.gold, fontWeight: 700, background: `${ds.color.gold}15`, padding: "3px 8px", borderRadius: 5, fontFamily: ds.font.mono }}>{chDur}s</span>
                          <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>{ch.scenes.length} scenes</span>
                          <button onClick={() => { setExpandingChapter(ch.id === expandingChapter ? null : ch.id); setChapterNotes(""); }}
                            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${ds.color.lilac}40`, background: "transparent", color: ds.color.lilac, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                            AI
                          </button>
                          <button onClick={() => deleteChapter(ch.id)}
                            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #4a1a1a", background: "transparent", color: "#f87171", fontSize: 10, cursor: "pointer" }}>✕</button>
                        </div>
                      </div>

                      {/* Chapter AI expand panel */}
                      {expandingChapter === ch.id && (
                        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: ds.radius.sm, background: `${ds.color.lilac}08`, border: `1px solid ${ds.color.lilac}20` }}>
                          <textarea value={chapterNotes} onChange={e => setChapterNotes(e.target.value)}
                            placeholder="Notes for AI? (e.g. 'Add more tension', 'Keep scenes 5s', 'Focus on dialogue'…)"
                            rows={2} style={{ ...inputSt, width: "100%", padding: "8px 10px", fontSize: 11, resize: "none", marginBottom: 8, boxSizing: "border-box" }} />
                          <button onClick={() => expandChapter(ch)} disabled={expandingChapter !== ch.id || expanding}
                            style={{ ...gradBtn, padding: "7px 16px", opacity: expanding ? 0.5 : 1 }}>
                            Expand Chapter
                          </button>
                        </div>
                      )}

                      {/* Scenes */}
                      {!isCollapsed && (
                        <div style={{ padding: "0 16px 14px" }}>
                          {ch.scenes.sort((a, b) => a.orderIndex - b.orderIndex).map((sc, si) => (
                            <div key={sc.id} style={{ background: ds.color.paper, borderRadius: ds.radius.sm, border: `1px solid ${ds.color.line}`, padding: 12, marginBottom: 6 }}>
                              {editingScene === sc.id ? (
                                <SceneEditor scene={sc} onSave={saveScene} onCancel={() => setEditingScene(null)} />
                              ) : (
                                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                  <div style={{ flexShrink: 0, background: `${ds.color.gold}15`, border: `1px solid ${ds.color.gold}30`, borderRadius: ds.radius.sm, padding: "6px 10px", textAlign: "center", minWidth: 44 }}>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: ds.color.gold, margin: 0, fontFamily: ds.font.mono }}>{sc.durationSeconds}s</p>
                                    <p style={{ fontSize: 8, color: ds.color.mute, margin: 0, fontFamily: ds.font.mono }}>CLIP</p>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.ink, margin: "0 0 4px" }}>
                                      {si + 1}. {sc.title || "Untitled scene"}
                                    </p>
                                    <p style={{ fontSize: 11, color: ds.color.ink2, margin: 0, lineHeight: 1.5 }}>
                                      {sc.description || <span style={{ color: ds.color.mute }}>No description yet</span>}
                                    </p>
                                    {sc.notes && <p style={{ fontSize: 10, color: ds.color.lilac, margin: "4px 0 0" }}>{sc.notes}</p>}
                                  </div>
                                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                    <button onClick={() => setEditingScene(sc.id)}
                                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 10, cursor: "pointer" }}>Edit</button>
                                    <button onClick={() => deleteScene(sc.id)}
                                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #4a1a1a", background: "transparent", color: "#f87171", fontSize: 10, cursor: "pointer" }}>✕</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          <button onClick={() => addScene(ch.id, ch.scenes)}
                            style={{ width: "100%", padding: "8px 0", borderRadius: ds.radius.sm, border: `1px dashed ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 11, cursor: "pointer", marginTop: 4 }}>
                            + Add Scene
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button onClick={addChapter}
                  style={{ width: "100%", padding: "12px 0", borderRadius: ds.radius.md, border: `1px dashed ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
                  + Add Chapter
                </button>

                {/* Duration summary */}
                {active.chapters.length > 0 && (
                  <div style={{ background: ds.color.card, borderRadius: ds.radius.md, padding: 14, border: `1px solid ${ds.color.line2}`, marginBottom: 20, display: "flex", gap: 20 }}>
                    {[
                      { value: `${activeDur}s`, label: "TOTAL ASSEMBLED", color: ds.color.gold },
                      { value: `${active.targetDurationSeconds}s`, label: "TARGET", color: activeDur <= active.targetDurationSeconds ? ds.color.mint : "#ef4444" },
                      { value: active.chapters.flatMap(c => c.scenes).length, label: "TOTAL SCENES", color: ds.color.ink },
                      { value: active.chapters.length, label: "CHAPTERS", color: ds.color.ink },
                    ].map(({ value, label, color }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, fontFamily: ds.font.mono }}>{value}</p>
                        <p style={{ fontSize: 9, color: ds.color.mute, margin: 0, fontFamily: ds.font.mono, letterSpacing: "0.1em" }}>{label}</p>
                      </div>
                    ))}
                    {saving && <p style={{ fontSize: 11, color: ds.color.mute, alignSelf: "center" }}>Saving…</p>}
                  </div>
                )}
              </>
            )}

            {!active && !showNew && (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 8 }}>Your Story Development Studio</p>
                <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
                  Write your story idea, let AI expand into chapters and scenes, each scene gets a duration, then send to Hybrid Planner to produce the video.
                </p>
                <button onClick={() => setShowNew(true)} style={gradBtn}>
                  + Create Your First Story
                </button>
              </div>
            )}
          </div>

          {/* BRAINSTORM PANEL */}
          {showChat && (
            <div style={{ width: 320, background: ds.color.card, borderLeft: `1px solid ${ds.color.line2}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${ds.color.line2}` }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: ds.color.lilac, margin: 0 }}>AI Brainstorm</p>
                <p style={{ fontSize: 10, color: ds.color.mute, margin: "2px 0 0" }}>Ask anything about your story. Low cost — local AI.</p>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {chatMsgs.length === 0 && (
                  <p style={{ fontSize: 11, color: ds.color.mute, textAlign: "center", paddingTop: 20 }}>
                    Ask me anything — plot holes, character ideas, scene suggestions, pacing…
                  </p>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{
                    padding: "8px 10px", borderRadius: ds.radius.sm, fontSize: 11, lineHeight: 1.5,
                    background: m.role === "user" ? `${ds.color.lilac}20` : ds.color.paper,
                    color: m.role === "user" ? ds.color.ink : ds.color.ink2,
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%",
                    border: `1px solid ${m.role === "user" ? `${ds.color.lilac}30` : ds.color.line}`,
                  }}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ padding: "8px 10px", borderRadius: ds.radius.sm, fontSize: 11, color: ds.color.mute, background: ds.color.paper, border: `1px solid ${ds.color.line}` }}>
                    Thinking…
                  </div>
                )}
                <div ref={chatBottom} />
              </div>
              <div style={{ padding: 10, borderTop: `1px solid ${ds.color.line2}`, display: "flex", gap: 6 }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }}}
                  placeholder="Ask AI…" rows={2}
                  style={{ ...inputSt, flex: 1, padding: "8px 10px", fontSize: 11, resize: "none" }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                  style={{ ...gradBtn, padding: "8px 12px", alignSelf: "flex-end", opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}>
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
  const inp: React.CSSProperties = {
    background: ds.color.paper, border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.sm, color: ds.color.ink, outline: "none", fontFamily: ds.font.sans,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input value={s.title || ""} onChange={e => setS(p => ({ ...p, title: e.target.value }))} placeholder="Scene title"
        style={{ ...inp, padding: "7px 10px", fontSize: 12 }} />
      <textarea value={s.description} onChange={e => setS(p => ({ ...p, description: e.target.value }))} placeholder="What the camera sees…"
        rows={3} style={{ ...inp, padding: "7px 10px", fontSize: 12, resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: ds.color.mute }}>Duration:</span>
        {[5, 8, 10, 15, 20, 30].map(d => (
          <button key={d} onClick={() => setS(p => ({ ...p, durationSeconds: d }))}
            style={{
              padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${s.durationSeconds === d ? ds.color.mint : ds.color.line2}`,
              background: s.durationSeconds === d ? `${ds.color.mint}20` : "transparent",
              color: s.durationSeconds === d ? ds.color.mint : ds.color.mute,
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: ds.font.mono,
            }}>
            {d}s
          </button>
        ))}
        <input type="number" value={s.durationSeconds} onChange={e => setS(p => ({ ...p, durationSeconds: Number(e.target.value) }))} min={1} max={120}
          style={{ ...inp, padding: "4px 8px", fontSize: 11, width: 60 }} />
      </div>
      <input value={s.notes || ""} onChange={e => setS(p => ({ ...p, notes: e.target.value }))} placeholder="Director note (optional)"
        style={{ ...inp, padding: "7px 10px", fontSize: 11 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onSave(s)}
          style={{
            padding: "7px 18px", borderRadius: ds.radius.sm, border: "none",
            background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
            backgroundSize: "300% 100%",
            color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: ds.font.sans,
          }}>
          Save
        </button>
        <button onClick={onCancel}
          style={{ padding: "7px 12px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 11, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
