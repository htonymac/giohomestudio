"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import SFXPicker from "../../components/SFXPicker";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import ButtonPrimary from "../../components/ui/ButtonPrimary";

interface StockTrack {
  filename: string;
  label: string;
  mood: string;
}

export default function MusicStudioPage() {
  const [tab, setTab] = useState<"generate" | "library" | "sfx" | "dj" | "upload">("generate");
  // DJ Tools state
  const [djTrack, setDjTrack] = useState("");
  const [djStart, setDjStart] = useState(0);
  const [djEnd, setDjEnd] = useState(10);
  const [djFadeIn, setDjFadeIn] = useState(0.5);
  const [djFadeOut, setDjFadeOut] = useState(0.5);
  const [djVolume, setDjVolume] = useState(1);
  const [djLoop, setDjLoop] = useState(false);
  const [djLoopCount, setDjLoopCount] = useState(2);
  const [djProcessing, setDjProcessing] = useState(false);
  const [djResult, setDjResult] = useState<{ outputPath?: string; error?: string } | null>(null);
  const [tracks, setTracks] = useState<StockTrack[]>([]);
  const [loading, setLoading] = useState(false);

  // AI Generate state
  const [genPrompt, setGenPrompt] = useState("");
  const [genGenre, setGenGenre] = useState("");
  const [genMood, setGenMood] = useState("");
  const [genDuration, setGenDuration] = useState(60);
  const [genInstrumental, setGenInstrumental] = useState(false);
  const [genTier, setGenTier] = useState<"standard" | "premium">("standard");
  const [aiTier, setAiTier] = useState<AITier>("pro");
  const [genTitle, setGenTitle] = useState("");
  const [genLyrics, setGenLyrics] = useState("");
  const [genResult, setGenResult] = useState<{ musicPath?: string; audioUrl?: string; source?: string; provider?: string; providerKey?: string; tier?: string; error?: string; note?: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genHistory, setGenHistory] = useState<Array<{ prompt: string; musicPath: string; provider: string; tier: string }>>([]);
  // Music Provider selector (persisted in localStorage)
  const [musicProvider, setMusicProvider] = useState<"auto" | "kie" | "mubert" | "stable_audio" | "stock">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ghs_music_provider") as "auto" | "kie" | "mubert" | "stable_audio" | "stock") ?? "auto";
    }
    return "auto";
  });

  // SFX state
  const [sfxPrompt, setSfxPrompt] = useState("");
  const [sfxResult, setSfxResult] = useState<{ sfxPath?: string; error?: string; matched?: string } | null>(null);
  const [sfxGenerating, setSfxGenerating] = useState(false);

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/music/library").then(r => r.json()).then(d => setTracks(d.tracks ?? []));
  }, []);

  function playTrack(path: string) {
    if (playing === path) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      setPlaying(path);
    }
  }

  async function handleGenerate() {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: genPrompt,
          genre: genGenre || undefined,
          mood: genMood || undefined,
          durationSeconds: genDuration,
          hasLyrics: !genInstrumental,
          providerKey: musicProvider,
          // Legacy fields kept for backward compat
          instrumental: genInstrumental,
          tier: genTier,
          title: genTitle || undefined,
          lyrics: genLyrics || undefined,
        }),
      });
      const result = await res.json();
      setGenResult(result);
      const trackUrl = result.audioUrl ?? result.musicPath;
      if (trackUrl) {
        setGenHistory(prev => [{ prompt: genPrompt, musicPath: trackUrl, provider: result.providerKey ?? result.provider ?? musicProvider, tier: result.tier || genTier }, ...prev.slice(0, 9)]);
      }
    } catch { setGenResult({ error: "Network error" }); }
    setGenerating(false);
  }

  async function handleSfxGenerate() {
    if (!sfxPrompt.trim()) return;
    setSfxGenerating(true);
    setSfxResult(null);
    try {
      const res = await fetch("/api/sfx/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: sfxPrompt }),
      });
      setSfxResult(await res.json());
    } catch { setSfxResult({ error: "Network error" }); }
    setSfxGenerating(false);
  }

  const MOODS = [...new Set(tracks.map(t => t.mood))];

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: ds.radius.sm,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: ds.font.mono,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: active ? ds.color.ink : ds.color.mute,
    borderBottom: active ? `2px solid ${ds.color.lilac}` : "2px solid transparent",
    transition: "all .18s",
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <HeroTitle kicker="Audio Studio" title="Music &" italic="Sound" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${ds.color.line}` }}>
        {[
          { id: "generate" as const, label: "AI Generate" },
          { id: "library" as const, label: "Stock Library" },
          { id: "sfx" as const, label: "Sound FX" },
          { id: "dj" as const, label: "DJ Tools" },
          { id: "upload" as const, label: "Upload" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Hidden audio player */}
      {playing && (
        <audio ref={audioRef} src={`/api/media/${playing.replace(/\\/g, "/").replace(/^storage\//, "")}`} autoPlay onEnded={() => setPlaying(null)} />
      )}

      {/* AI Generate Tab */}
      {tab === "generate" && (
        <div className="space-y-4">
          {/* AI LLM tier + Music engine selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>AI Intelligence</p>
              <AITierSelector value={aiTier} onChange={setAiTier} compact />
            </div>
            <div>
              <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Music Engine</p>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "standard" as const, label: "MiniMax", color: ds.color.mint },
                  { id: "premium" as const, label: "Suno V5", color: ds.color.gold },
                ].map(t => (
                  <button key={t.id} onClick={() => setGenTier(t.id)} style={{
                    flex: 1, padding: "8px 10px", borderRadius: ds.radius.sm, border: `1px solid ${genTier === t.id ? t.color + "60" : ds.color.line2}`,
                    background: genTier === t.id ? t.color + "20" : ds.color.card,
                    color: genTier === t.id ? t.color : ds.color.mute, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>{t.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Music Provider selector */}
          <div>
            <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Provider</p>
            <select
              value={musicProvider}
              onChange={e => {
                const v = e.target.value as typeof musicProvider;
                setMusicProvider(v);
                if (typeof window !== "undefined") localStorage.setItem("ghs_music_provider", v);
              }}
              style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 11, borderRadius: ds.radius.sm, padding: "6px 10px" }}
            >
              <option value="auto">Auto (smart routing)</option>
              <option value="kie">Kie.ai (Suno V5 — lyrical)</option>
              <option value="mubert">Mubert (ambient — instrumental)</option>
              <option value="stable_audio">Stable Audio (cinematic ≤47s)</option>
              <option value="stock">Stock Library (free, offline)</option>
            </select>
          </div>

          <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 4 }}>AI Music Generator</h2>
              <p style={{ fontSize: 10, color: ds.color.mute }}>Describe the vibe — AI composes an original track for your content.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Genre</label>
                <select value={genGenre} onChange={e => setGenGenre(e.target.value)} style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 11, borderRadius: ds.radius.sm, padding: "6px 10px" }}>
                  <option value="">Auto-detect</option>
                  {["Afrobeats", "Afropop", "Afro Gospel", "Highlife", "Pop", "Hip-Hop", "R&B", "Gospel", "Jazz", "Classical", "Electronic", "Ambient", "Cinematic", "Drill", "Reggae", "Dancehall", "Trap", "Soul", "Country", "Rock"].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Mood</label>
                <select value={genMood} onChange={e => setGenMood(e.target.value)} style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 11, borderRadius: ds.radius.sm, padding: "6px 10px" }}>
                  <option value="">Auto-detect</option>
                  {["Upbeat", "Calm", "Emotional", "Epic", "Dramatic", "Romantic", "Dark", "Joyful", "Suspenseful", "Motivational", "Worshipful", "Festive", "Melancholic", "Energetic", "Peaceful"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Describe the track</label>
              <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)}
                placeholder="e.g. Afrobeats party anthem, heavy bass, 60 seconds, perfect for real estate reel..."
                rows={3} style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 13, borderRadius: ds.radius.sm, padding: "10px 14px", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Duration: {genDuration}s</label>
                <input type="range" min={10} max={240} step={5} value={genDuration} onChange={e => setGenDuration(Number(e.target.value))} style={{ width: "100%", accentColor: ds.color.lilac }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: ds.color.mute }}><span>10s</span><span>240s</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: ds.color.mute, cursor: "pointer" }}>
                  <input type="checkbox" checked={genInstrumental} onChange={e => setGenInstrumental(e.target.checked)} style={{ accentColor: ds.color.lilac }} />
                  Instrumental only (no vocals)
                </label>
                {genTier === "premium" && (
                  <input value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="Song title (optional)"
                    style={{ background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 11, borderRadius: ds.radius.sm, padding: "6px 10px", outline: "none" }} />
                )}
              </div>
            </div>

            {genTier === "premium" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Lyrics (optional — for vocal songs)</label>
                <textarea value={genLyrics} onChange={e => setGenLyrics(e.target.value)}
                  placeholder="Paste your lyrics here — Suno will sing them..."
                  rows={4} style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 11, borderRadius: ds.radius.sm, padding: "10px 14px", resize: "none", outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <ButtonPrimary disabled={generating || !genPrompt.trim()} onClick={handleGenerate} size="md">
                {generating ? "Composing..." : `Generate ${genTier === "premium" ? "(Suno V5)" : "(MiniMax)"}`}
              </ButtonPrimary>
              {generating && <span style={{ fontSize: 11, color: ds.color.mute }}>{genTier === "premium" ? "Suno V5 takes ~90 seconds..." : "MiniMax composing..."}</span>}
            </div>

            {genResult && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: ds.radius.sm, border: `1px solid ${genResult.error ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.2)"}`, background: genResult.error ? "rgba(239,68,68,0.06)" : "rgba(74,222,128,0.06)", fontSize: 11 }}>
                {genResult.error ? (
                  <p style={{ color: "#f87171" }}>{genResult.error}</p>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ color: ds.color.mint, fontWeight: 700 }}>Track generated</p>
                      <span style={{ fontSize: 9, background: ds.color.alert, padding: "2px 6px", borderRadius: 4, color: ds.color.lilac }}>{genResult.providerKey ?? genResult.provider}</span>
                    </div>
                    <p style={{ color: ds.color.mute, marginBottom: 8 }}>{(genResult.audioUrl ?? genResult.musicPath)?.split(/[\\/]/).pop()}</p>
                    {(genResult.audioUrl ?? genResult.musicPath) && (
                      <button onClick={() => playTrack((genResult.audioUrl ?? genResult.musicPath)!)}
                        style={{ padding: "6px 14px", borderRadius: ds.radius.sm, color: ds.color.ink, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: playing === (genResult.audioUrl ?? genResult.musicPath) ? ds.color.mute2 : ds.color.lilac }}>
                        {playing === (genResult.audioUrl ?? genResult.musicPath) ? "Stop" : "Play"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* History */}
          {genHistory.length > 0 && (
            <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 16 }}>
              <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>This session ({genHistory.length} generated)</p>
              <div>
                {genHistory.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, paddingBlock: 8, borderBottom: `1px solid ${ds.color.line}` }}>
                    <button onClick={() => playTrack(h.musicPath)}
                      style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, border: "none", cursor: "pointer",
                        background: playing === h.musicPath ? ds.color.lilac : ds.color.alert, color: ds.color.ink }}>
                      {playing === h.musicPath ? "II" : ">"}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: ds.color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.prompt.slice(0, 60)}</p>
                      <p style={{ fontSize: 9, color: ds.color.mute }}>{h.provider} · {h.tier}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stock Library Tab */}
      {tab === "library" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: ds.color.mute }}>Filter:</span>
            {MOODS.map(m => (
              <button key={m} style={{ fontSize: 10, background: ds.color.alert, color: ds.color.mute, padding: "4px 10px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, cursor: "pointer", textTransform: "capitalize" }}>
                {m}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 8 }}>
            {tracks.map(t => (
              <div key={t.filename} style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.sm, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => playTrack(`storage/music/stock/${t.filename}`)}
                  style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: `${ds.color.lilac}25`, color: ds.color.lilac, border: "none", cursor: "pointer", flexShrink: 0, fontSize: 12 }}
                >
                  {playing === `storage/music/stock/${t.filename}` ? "II" : ">"}
                </button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 11, color: ds.color.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</p>
                  <p style={{ fontSize: 9, color: ds.color.mute, textTransform: "capitalize" }}>{t.mood}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SFX Tab */}
      {tab === "sfx" && (
        <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 4 }}>Sound Effects</h2>
            <p style={{ fontSize: 11, color: ds.color.mute }}>Describe the sound you need — AI finds or generates it.</p>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={sfxPrompt}
              onChange={e => setSfxPrompt(e.target.value)}
              placeholder="e.g. crowd applause, door slam, car horn, rain..."
              style={{ flex: 1, background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 13, borderRadius: ds.radius.sm, padding: "8px 14px", outline: "none" }}
            />
            <ButtonPrimary disabled={sfxGenerating || !sfxPrompt.trim()} onClick={handleSfxGenerate} size="md">
              {sfxGenerating ? "..." : "Find SFX"}
            </ButtonPrimary>
          </div>
          {sfxResult && (
            <div style={{ padding: "10px 12px", borderRadius: ds.radius.xs, fontSize: 11, marginBottom: 16, background: sfxResult.error ? "rgba(239,68,68,0.06)" : "rgba(74,222,128,0.06)", color: sfxResult.error ? "#f87171" : ds.color.mint, border: `1px solid ${sfxResult.error ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)"}` }}>
              {sfxResult.error ?? `Found: ${sfxResult.matched}`}
              {sfxResult.sfxPath && (
                <button onClick={() => playTrack(sfxResult.sfxPath!)} style={{ marginLeft: 12, color: ds.color.lilac, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>
                  {playing === sfxResult.sfxPath ? "Stop" : "Preview"}
                </button>
              )}
            </div>
          )}

          {/* Full SFX Library */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${ds.color.line}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.lilac, marginBottom: 12 }}>Full SFX Library (48 effects — click to preview)</p>
            <SFXPicker onSelect={(event, path) => { playTrack(path); }} />
          </div>
        </div>
      )}

      {/* DJ Tools Tab */}
      {tab === "dj" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Trimmer */}
          <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 4 }}>Audio Trimmer & Editor</h2>
              <p style={{ fontSize: 11, color: ds.color.mute }}>Set start/end points, add fades, adjust volume, loop sections.</p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Select track</label>
              <select value={djTrack} onChange={e => setDjTrack(e.target.value)} style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 12, borderRadius: ds.radius.sm, padding: "8px 10px" }}>
                <option value="">Choose a stock track...</option>
                {tracks.map(t => (
                  <option key={t.filename} value={`storage/music/stock/${t.filename}`}>{t.label} ({t.mood})</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Start (sec)", value: djStart, set: setDjStart, min: 0 },
                { label: "End (sec)", value: djEnd, set: setDjEnd, min: 0.1 },
                { label: "Fade In (sec)", value: djFadeIn, set: setDjFadeIn, min: 0 },
                { label: "Fade Out (sec)", value: djFadeOut, set: setDjFadeOut, min: 0 },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type="number" min={f.min} step={0.1} value={f.value} onChange={e => f.set(Number(e.target.value))} style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 12, borderRadius: ds.radius.xs, padding: "6px 8px", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Volume: {(djVolume * 100).toFixed(0)}%</label>
                <input type="range" min={0} max={2} step={0.05} value={djVolume} onChange={e => setDjVolume(Number(e.target.value))} style={{ width: "100%", accentColor: ds.color.lilac }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: ds.color.mute }}>
                  <input type="checkbox" checked={djLoop} onChange={e => setDjLoop(e.target.checked)} style={{ accentColor: ds.color.lilac }} />
                  Loop
                </label>
                {djLoop && (
                  <input type="number" min={2} max={10} value={djLoopCount} onChange={e => setDjLoopCount(Number(e.target.value))} style={{ width: 56, background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 11, borderRadius: ds.radius.xs, padding: "4px 8px" }} />
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <ButtonPrimary
                disabled={!djTrack || djProcessing}
                onClick={async () => {
                  setDjProcessing(true);
                  setDjResult(null);
                  try {
                    const res = await fetch("/api/music/trim", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ inputPath: djTrack, startSec: djStart, endSec: djEnd, fadeInSec: djFadeIn, fadeOutSec: djFadeOut, volume: djVolume, loop: djLoop, loopCount: djLoopCount }),
                    });
                    setDjResult(await res.json());
                  } catch { setDjResult({ error: "Network error" }); }
                  setDjProcessing(false);
                }}
                size="md"
              >
                {djProcessing ? "Processing..." : "Trim & Export"}
              </ButtonPrimary>
              {djTrack && (
                <button onClick={() => playTrack(djTrack)} style={{ padding: "8px 16px", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink2, borderRadius: ds.radius.sm, fontSize: 13, cursor: "pointer" }}>
                  {playing === djTrack ? "Stop" : "Preview"}
                </button>
              )}
            </div>

            {djResult && (
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: ds.radius.xs, fontSize: 11, background: djResult.error ? "rgba(239,68,68,0.06)" : "rgba(74,222,128,0.06)", color: djResult.error ? "#f87171" : ds.color.mint, border: `1px solid ${djResult.error ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)"}` }}>
                {djResult.error ?? `Exported: ${djResult.outputPath}`}
                {djResult.outputPath && (
                  <button onClick={() => playTrack(djResult.outputPath!)} style={{ marginLeft: 12, color: ds.color.lilac, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>
                    {playing === djResult.outputPath ? "Stop" : "Preview result"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Waveform & Beat Visualizer */}
          <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 4 }}>Waveform & Beat Visualizer</h2>
              <p style={{ fontSize: 11, color: ds.color.mute }}>Visual waveform with beat detection — select a track above to visualize.</p>
            </div>
            <WaveformVisualizer trackPath={djTrack} playing={playing} />
          </div>

          {/* Mixer — Live Preview */}
          <LiveMixer tracks={tracks} />
        </div>
      )}

      {/* Upload Tab */}
      {tab === "upload" && (
        <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 16 }}>Upload Your Own Music</h2>

          <div style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: ds.radius.md, padding: 32, textAlign: "center", cursor: "pointer", marginBottom: 16 }}>
            <p style={{ color: ds.color.mute, fontSize: 13, marginBottom: 6 }}>Drag & drop audio files here</p>
            <p style={{ color: ds.color.mute2, fontSize: 11 }}>Supports MP3, WAV, AAC</p>
          </div>

          {/* Legal disclaimer */}
          <div style={{ background: ds.color.wallet, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.sm, padding: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: ds.color.coral, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Music & Audio Upload Policy</p>
            <div style={{ fontSize: 9, color: ds.color.mute2, lineHeight: 1.6 }}>
              <p>By uploading audio to GioHomeStudio, you confirm that:</p>
              <p style={{ color: `${ds.color.mint}aa` }}>You own the rights to this music, OR</p>
              <p style={{ color: `${ds.color.mint}aa` }}>You have a valid license to use it commercially, OR</p>
              <p style={{ color: `${ds.color.mint}aa` }}>The music is royalty-free or in the public domain</p>
              <p style={{ marginTop: 8 }}>GioHomeStudio does not allow:</p>
              <p style={{ color: "rgba(248,113,113,0.7)" }}>Copyrighted songs from Spotify, Apple Music, YouTube, or any commercial platform</p>
              <p style={{ color: "rgba(248,113,113,0.7)" }}>Music owned by record labels or publishers without a valid sync and master license</p>
              <p style={{ color: "rgba(248,113,113,0.7)" }}>Any audio you do not have rights to use commercially</p>
              <p style={{ marginTop: 8, color: ds.color.mute }}>
                GioHomeStudio is not responsible for copyright violations resulting from music uploaded by users. Users are solely responsible for ensuring they have the necessary rights to all audio they upload and use on this platform.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Waveform & Beat Visualizer ───────────────────────────────────────────────

function WaveformVisualizer({ trackPath, playing }: { trackPath: string; playing: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [beats, setBeats] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const animRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const analyzeTrack = useCallback(async (path: string) => {
    if (!path) return;
    setLoading(true);
    try {
      const url = `/api/media/${path.replace(/\\/g, "/").replace(/^storage\//, "")}`;
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const audio = await ctx.decodeAudioData(buf);
      const channel = audio.getChannelData(0);
      setDuration(audio.duration);

      // Downsample to ~800 points for waveform display
      const samples = 800;
      const blockSize = Math.floor(channel.length / samples);
      const wave = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channel[start + j] ?? 0);
        }
        wave[i] = sum / blockSize;
      }
      setWaveform(wave);

      // Simple beat detection: find energy peaks
      const beatBlockSize = Math.floor(audio.sampleRate * 0.02); // 20ms blocks
      const energyBlocks: number[] = [];
      for (let i = 0; i < channel.length; i += beatBlockSize) {
        let energy = 0;
        for (let j = 0; j < beatBlockSize && i + j < channel.length; j++) {
          energy += channel[i + j] * channel[i + j];
        }
        energyBlocks.push(energy / beatBlockSize);
      }

      // Find local maxima above average energy * 1.5
      const avgEnergy = energyBlocks.reduce((a, b) => a + b, 0) / energyBlocks.length;
      const threshold = avgEnergy * 1.5;
      const detectedBeats: number[] = [];
      let lastBeat = -10;
      for (let i = 1; i < energyBlocks.length - 1; i++) {
        if (energyBlocks[i] > threshold &&
            energyBlocks[i] > energyBlocks[i - 1] &&
            energyBlocks[i] > energyBlocks[i + 1] &&
            i - lastBeat > 10) { // min 200ms between beats
          detectedBeats.push((i * beatBlockSize) / audio.sampleRate);
          lastBeat = i;
        }
      }
      setBeats(detectedBeats);
      ctx.close();
    } catch { /* ignore decode errors */ }
    setLoading(false);
  }, []);

  useEffect(() => { analyzeTrack(trackPath); }, [trackPath, analyzeTrack]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    function draw() {
      if (!ctx || !waveform) return;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += h / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Beat markers
      ctx.strokeStyle = "#7c5cfc40";
      ctx.lineWidth = 1;
      for (const beat of beats) {
        const x = (beat / duration) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        // Beat dot
        ctx.fillStyle = "#7c5cfc";
        ctx.beginPath();
        ctx.arc(x, 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Waveform bars
      const barWidth = w / waveform.length;
      const maxVal = Math.max(...Array.from(waveform)) || 1;
      for (let i = 0; i < waveform.length; i++) {
        const val = waveform[i] / maxVal;
        const barH = val * (h * 0.8);
        const x = i * barWidth;

        // Gradient color based on amplitude
        const intensity = Math.floor(val * 255);
        ctx.fillStyle = `rgb(${100 + intensity * 0.3}, ${80 + intensity * 0.2}, ${252})`;
        ctx.fillRect(x, mid - barH / 2, Math.max(barWidth - 0.5, 0.5), barH);
      }

      // Playback position indicator (if this track is playing)
      if (playing === trackPath) {
        const elapsed = (performance.now() / 1000) % duration;
        const px = (elapsed / duration) * w;
        ctx.strokeStyle = "#00ddb5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [waveform, beats, duration, playing, trackPath]);

  if (!trackPath) {
    return (
      <div style={{ height: 128, display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${ds.color.line2}`, borderRadius: ds.radius.sm }}>
        <p style={{ fontSize: 11, color: ds.color.mute2 }}>Select a track above to see its waveform</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: 128, display: "flex", alignItems: "center", justifyContent: "center", background: ds.color.wallet, borderRadius: ds.radius.sm }}>
        <p style={{ fontSize: 11, color: ds.color.mute }}>Analyzing waveform...</p>
      </div>
    );
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        style={{ width: "100%", borderRadius: ds.radius.xs, background: ds.color.wallet, border: `1px solid ${ds.color.line}` }}
      />
      {beats.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <span style={{ fontSize: 10, color: ds.color.mute }}>{beats.length} beats detected</span>
          <span style={{ fontSize: 10, color: ds.color.mute2 }}>|</span>
          <span style={{ fontSize: 10, color: ds.color.mute }}>~{duration > 0 ? Math.round(beats.length / (duration / 60)) : 0} BPM</span>
          <span style={{ fontSize: 10, color: ds.color.mute2 }}>|</span>
          <span style={{ fontSize: 10, color: ds.color.mute }}>{duration.toFixed(1)}s duration</span>
          {/* Beat pattern indicator */}
          <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
            {beats.slice(0, 32).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 5, height: 12, borderRadius: 2,
                  background: i % 4 === 0 ? ds.color.lilac : i % 2 === 0 ? `${ds.color.lilac}50` : `${ds.color.lilac}25`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live Mixer ───────────────────────────────────────────────────────────────

interface MixerLayer { track: string; volume: number; pan: number; audio: HTMLAudioElement | null; }

function LiveMixer({ tracks }: { tracks: { filename: string; label: string; mood: string }[] }) {
  const [layers, setLayers] = useState<MixerLayer[]>([
    { track: "", volume: 1, pan: 0, audio: null },
    { track: "", volume: 1, pan: 0, audio: null },
    { track: "", volume: 1, pan: 0, audio: null },
  ]);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mixExporting, setMixExporting] = useState(false);
  const [mixResult, setMixResult] = useState<{ outputPath?: string; error?: string } | null>(null);
  const LABELS = ["Layer 1 — Music", "Layer 2 — SFX / Ambience", "Layer 3 — Voice / Riser"];

  function updateMix(i: number, patch: Partial<MixerLayer>) {
    setLayers(prev => { const n = [...prev]; n[i] = { ...n[i], ...patch }; return n; });
  }
  function pickTrack(i: number, tp: string) {
    if (layers[i].audio) { layers[i].audio!.pause(); layers[i].audio!.src = ""; }
    if (!tp) { updateMix(i, { track: "", audio: null }); return; }
    const a = new Audio(`/api/media/${tp.replace(/\\/g, "/").replace(/^storage\//, "")}`);
    a.loop = true; a.volume = layers[i].volume;
    if (isPlaying) a.play();
    updateMix(i, { track: tp, audio: a });
  }
  function togglePlay() {
    if (isPlaying) { layers.forEach(l => l.audio?.pause()); setIsPlaying(false); }
    else { layers.forEach(l => { if (l.audio && l.track) { l.audio.volume = Math.min(1, l.volume); l.audio.play(); } }); setIsPlaying(true); }
  }
  function stopAll() { layers.forEach(l => { if (l.audio) { l.audio.pause(); l.audio.currentTime = 0; } }); setIsPlaying(false); }
  async function doExport() {
    const active = layers.filter(l => l.track);
    if (!active.length) return;
    setMixExporting(true); setMixResult(null);
    try {
      const r = await fetch("/api/music/layer", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: active.map(l => ({ path: l.track, volume: l.volume, pan: l.pan })), eq: { bass, mid, treble } }) });
      setMixResult(await r.json());
    } catch { setMixResult({ error: "Network error" }); }
    setMixExporting(false);
  }

  return (
    <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.md, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, marginBottom: 4 }}>Sound Layering (Mini DJ)</h2>
          <p style={{ fontSize: 11, color: ds.color.mute }}>Mix up to 3 tracks — hear changes live as you adjust volume and layers.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={togglePlay} style={{ padding: "8px 14px", borderRadius: ds.radius.sm, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: isPlaying ? ds.color.coral : ds.color.lilac, color: ds.color.ink }}>
            {isPlaying ? "Pause" : "Preview Mix"}
          </button>
          {isPlaying && <button onClick={stopAll} style={{ padding: "8px 12px", borderRadius: ds.radius.sm, fontSize: 13, background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink2, cursor: "pointer" }}>Stop</button>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {LABELS.map((label, i) => (
          <div key={i} style={{ background: ds.color.wallet, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.sm, padding: 12 }}>
            <p style={{ fontSize: 10, color: ds.color.lilac, fontWeight: 700, marginBottom: 8 }}>{label}</p>
            <select value={layers[i].track} onChange={e => pickTrack(i, e.target.value)}
              style={{ width: "100%", background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.mute, fontSize: 10, borderRadius: ds.radius.xs, padding: "5px 6px", marginBottom: 8 }}>
              <option value="">Select track...</option>
              {tracks.map(t => <option key={t.filename} value={`storage/music/stock/${t.filename}`}>{t.label} ({t.mood})</option>)}
            </select>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: ds.color.mute2, width: 20 }}>Vol</span>
                <input type="range" min={0} max={2} step={0.05} value={layers[i].volume}
                  onChange={e => { const v = Number(e.target.value); updateMix(i, { volume: v }); if (layers[i].audio) layers[i].audio!.volume = Math.min(1, v); }}
                  style={{ flex: 1, accentColor: ds.color.lilac, height: 4 }} />
                <span style={{ fontSize: 8, color: ds.color.mute2, width: 28, textAlign: "right" }}>{Math.round(layers[i].volume * 100)}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: ds.color.mute2, width: 20 }}>Pan</span>
                <input type="range" min={-1} max={1} step={0.1} value={layers[i].pan} onChange={e => updateMix(i, { pan: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: ds.color.lilac, height: 4 }} />
                <span style={{ fontSize: 8, color: ds.color.mute2, width: 28, textAlign: "right" }}>{layers[i].pan === 0 ? "C" : layers[i].pan < 0 ? `L${Math.abs(Math.round(layers[i].pan * 100))}` : `R${Math.round(layers[i].pan * 100)}`}</span>
              </div>
            </div>
            {layers[i].track && (
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <button onClick={() => { if (layers[i].audio) { if (layers[i].audio!.paused) layers[i].audio!.play(); else layers[i].audio!.pause(); } }} style={{ fontSize: 9, color: ds.color.lilac, background: "none", border: "none", cursor: "pointer" }}>Solo</button>
                <button onClick={() => { if (layers[i].audio) layers[i].audio!.volume = 0; }} style={{ fontSize: 9, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>Mute</button>
                <button onClick={() => { if (layers[i].audio) layers[i].audio!.volume = Math.min(1, layers[i].volume); }} style={{ fontSize: 9, color: ds.color.mint, background: "none", border: "none", cursor: "pointer" }}>Unmute</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ds.color.line}` }}>
        <p style={{ fontSize: 10, color: ds.color.mute, fontWeight: 700, marginBottom: 8 }}>Master EQ (applied on export)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[{ l: "Bass (100Hz)", v: bass, s: setBass }, { l: "Mid (1kHz)", v: mid, s: setMid }, { l: "Treble (8kHz)", v: treble, s: setTreble }].map(eq => (
            <div key={eq.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: ds.color.mute2, width: 56 }}>{eq.l}</span>
              <input type="range" min={-10} max={10} step={1} value={eq.v} onChange={e => eq.s(Number(e.target.value))} style={{ flex: 1, accentColor: ds.color.lilac, height: 4 }} />
              <span style={{ fontSize: 8, color: ds.color.mute2, width: 20, textAlign: "right" }}>{eq.v > 0 ? "+" : ""}{eq.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <ButtonPrimary onClick={doExport} disabled={mixExporting || layers.every(l => !l.track)} size="md">
          {mixExporting ? "Mixing..." : "Mix & Export"}
        </ButtonPrimary>
      </div>
      {mixResult && (
        <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: ds.radius.xs, fontSize: 11, background: mixResult.error ? "rgba(239,68,68,0.06)" : "rgba(74,222,128,0.06)", color: mixResult.error ? "#f87171" : ds.color.mint, border: `1px solid ${mixResult.error ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)"}` }}>
          {mixResult.error ?? `Mixed: ${mixResult.outputPath}`}
        </div>
      )}
    </div>
  );
}
