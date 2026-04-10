"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Character {
  name: string;
  role: string;
  description: string;
  voiceId: string;
  traits: string;
}

interface Episode {
  number: number;
  title: string;
  synopsis: string;
  status: "draft" | "scripted" | "generated" | "reviewed" | "published";
  contentItemId?: string;
}

interface SeriesConfig {
  title: string;
  genre: string;
  tone: string;
  targetAudience: string;
  platform: string;
  aspectRatio: string;
  episodeDurationSec: number;
  visualStyle: string;
  characters: Character[];
  episodes: Episode[];
  storyBible: string;
}

// ── Steps ────────────────────────────────────────────────────────────────────

type Step = "basics" | "characters" | "bible" | "episodes" | "review";

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: "basics", label: "Series Basics", icon: "1" },
  { id: "characters", label: "Characters", icon: "2" },
  { id: "bible", label: "Story Bible", icon: "3" },
  { id: "episodes", label: "Episodes", icon: "4" },
  { id: "review", label: "Review & Launch", icon: "5" },
];

const GENRES = ["Drama", "Comedy", "Action", "Horror", "Sci-Fi", "Fantasy", "Romance", "Thriller", "Documentary", "Educational", "Motivational", "Kids"];
const TONES = ["Serious", "Light-hearted", "Dark", "Inspirational", "Satirical", "Mysterious", "Epic", "Casual"];
const PLATFORMS = ["YouTube", "Instagram", "TikTok", "Facebook", "Multi-platform"];
const VISUAL_STYLES = ["Cinematic", "Animated", "Comic-style", "Photorealistic", "Artistic", "Minimal", "Retro"];

// ── Shared styles ────────────────────────────────────────────────────────────

const inputCls = "w-full bg-[#1a1a2e] border border-[#2a2a40] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#7c5cfc]";
const labelCls = "block text-[10px] text-[#6060a0] uppercase tracking-wider mb-1.5 font-semibold";
const cardCls = "bg-[#12121e] border border-[#2a2a40] rounded-xl p-5";

// ── Component ────────────────────────────────────────────────────────────────

export default function SeriesWizardPage() {
  const [step, setStep] = useState<Step>("basics");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [config, setConfig] = useState<SeriesConfig>({
    title: "",
    genre: "Drama",
    tone: "Serious",
    targetAudience: "",
    platform: "YouTube",
    aspectRatio: "9:16",
    episodeDurationSec: 60,
    visualStyle: "Cinematic",
    characters: [],
    episodes: [],
    storyBible: "",
  });

  function patch(p: Partial<SeriesConfig>) {
    setConfig(prev => ({ ...prev, ...p }));
  }

  function addCharacter() {
    patch({ characters: [...config.characters, { name: "", role: "protagonist", description: "", voiceId: "", traits: "" }] });
  }

  function updateCharacter(i: number, p: Partial<Character>) {
    const chars = [...config.characters];
    chars[i] = { ...chars[i], ...p };
    patch({ characters: chars });
  }

  function removeCharacter(i: number) {
    patch({ characters: config.characters.filter((_, idx) => idx !== i) });
  }

  function addEpisode() {
    const num = config.episodes.length + 1;
    patch({ episodes: [...config.episodes, { number: num, title: "", synopsis: "", status: "draft" }] });
  }

  function updateEpisode(i: number, p: Partial<Episode>) {
    const eps = [...config.episodes];
    eps[i] = { ...eps[i], ...p };
    patch({ episodes: eps });
  }

  function removeEpisode(i: number) {
    const eps = config.episodes.filter((_, idx) => idx !== i).map((ep, idx) => ({ ...ep, number: idx + 1 }));
    patch({ episodes: eps });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) setSaved(true);
    } catch { /* ignore */ }
    setSaving(false);
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const canNext = stepIndex < STEPS.length - 1;
  const canPrev = stepIndex > 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Series Planner</h1>
        <p className="text-xs mt-0.5 text-[#6060a0]">
          Plan episodic content with consistent characters, story bibles, and episode tracking
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all flex-1"
            style={{
              background: step === s.id ? "rgba(124,92,252,0.15)" : "rgba(18,18,30,0.8)",
              border: `1px solid ${step === s.id ? "#7c5cfc" : "#2a2a40"}`,
              color: step === s.id ? "#a080ff" : i < stepIndex ? "#4ade80" : "#5060a0",
            }}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: i < stepIndex ? "#166534" : step === s.id ? "#7c5cfc" : "#2a2a40", color: "white" }}>
              {i < stepIndex ? "✓" : s.icon}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === "basics" && (
        <div className={cardCls + " space-y-5"}>
          <div>
            <label className={labelCls}>Series Title</label>
            <input value={config.title} onChange={e => patch({ title: e.target.value })} className={inputCls} placeholder="e.g. The Last Guardian" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Genre</label>
              <select value={config.genre} onChange={e => patch({ genre: e.target.value })} className={inputCls}>
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tone</label>
              <select value={config.tone} onChange={e => patch({ tone: e.target.value })} className={inputCls}>
                {TONES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Target Audience</label>
            <input value={config.targetAudience} onChange={e => patch({ targetAudience: e.target.value })} className={inputCls} placeholder="e.g. Young adults 18-35 interested in fantasy and mythology" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Platform</label>
              <select value={config.platform} onChange={e => patch({ platform: e.target.value })} className={inputCls}>
                {PLATFORMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Aspect Ratio</label>
              <select value={config.aspectRatio} onChange={e => patch({ aspectRatio: e.target.value })} className={inputCls}>
                <option value="9:16">9:16 (Vertical)</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Episode Duration</label>
              <select value={config.episodeDurationSec} onChange={e => patch({ episodeDurationSec: Number(e.target.value) })} className={inputCls}>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Visual Style</label>
            <div className="flex gap-2 flex-wrap">
              {VISUAL_STYLES.map(vs => (
                <button key={vs} onClick={() => patch({ visualStyle: vs })}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: config.visualStyle === vs ? "rgba(124,92,252,0.2)" : "#1a1a2e",
                    border: `1px solid ${config.visualStyle === vs ? "#7c5cfc" : "#2a2a40"}`,
                    color: config.visualStyle === vs ? "#a080ff" : "#6060a0",
                  }}>
                  {vs}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Characters */}
      {step === "characters" && (
        <div className="space-y-4">
          {config.characters.map((char, i) => (
            <div key={i} className={cardCls + " space-y-3"}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Character {i + 1}</span>
                <button onClick={() => removeCharacter(i)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input value={char.name} onChange={e => updateCharacter(i, { name: e.target.value })} className={inputCls} placeholder="Character name" />
                </div>
                <div>
                  <label className={labelCls}>Role</label>
                  <select value={char.role} onChange={e => updateCharacter(i, { role: e.target.value })} className={inputCls}>
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="supporting">Supporting</option>
                    <option value="narrator">Narrator</option>
                    <option value="comic_relief">Comic Relief</option>
                    <option value="mentor">Mentor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Description (appearance, age, personality)</label>
                <textarea value={char.description} onChange={e => updateCharacter(i, { description: e.target.value })} className={inputCls} rows={2} placeholder="Young woman, braided hair, fierce eyes, traditional warrior outfit..." />
              </div>
              <div>
                <label className={labelCls}>Key Traits</label>
                <input value={char.traits} onChange={e => updateCharacter(i, { traits: e.target.value })} className={inputCls} placeholder="Brave, loyal, sarcastic, quick-tempered" />
              </div>
            </div>
          ))}

          <button onClick={addCharacter}
            className="w-full py-3 rounded-xl text-sm font-medium border-2 border-dashed border-[#2a2a40] text-[#6060a0] hover:border-[#7c5cfc] hover:text-[#a080ff] transition-all">
            + Add Character
          </button>

          {config.characters.length === 0 && (
            <div className="text-center py-8 text-[#404060] text-xs">
              No characters yet. Add at least one character for your series.
            </div>
          )}
        </div>
      )}

      {/* Step 3: Story Bible */}
      {step === "bible" && (
        <div className={cardCls + " space-y-4"}>
          <div>
            <label className={labelCls}>Story Universe / Series Bible</label>
            <p className="text-[10px] text-[#404060] mb-3">
              Define the world, rules, locations, lore, major events, and timeline. This keeps episodes consistent.
            </p>
            <textarea
              value={config.storyBible}
              onChange={e => patch({ storyBible: e.target.value })}
              className={inputCls}
              rows={12}
              placeholder={`World: A mythical African kingdom where technology and ancient magic coexist.

Timeline: Present day, but the kingdom has existed for 3000 years.

Rules:
- Magic users draw power from ancestral spirits
- Technology is powered by crystal energy, not electricity
- The barrier between the kingdom and the outside world is weakening

Key Locations:
- The Crystal Palace — seat of the ruling council
- The Spirit Forest — where ancestors communicate
- The Outer Wall — boundary between kingdom and modern world

Major Events:
- The Great Silence (1000 years ago) — when the ancestors stopped speaking
- The Awakening — when the protagonist discovers their power`}
            />
          </div>

          <div className="flex gap-3 items-center">
            <span className="text-[10px] text-[#404060]">{config.storyBible.length} characters</span>
            {config.storyBible.length > 100 && (
              <span className="text-[10px] text-green-500">Good foundation</span>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Episodes */}
      {step === "episodes" && (
        <div className="space-y-3">
          {config.episodes.map((ep, i) => (
            <div key={i} className={cardCls + " flex gap-4 items-start"}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: ep.status === "draft" ? "#1a1a2e" : ep.status === "scripted" ? "rgba(59,130,246,0.15)" : ep.status === "generated" ? "rgba(124,92,252,0.15)" : "rgba(74,222,128,0.15)",
                  color: ep.status === "draft" ? "#6060a0" : ep.status === "scripted" ? "#60a5fa" : ep.status === "generated" ? "#a080ff" : "#4ade80",
                  border: `1px solid ${ep.status === "draft" ? "#2a2a40" : ep.status === "scripted" ? "#1e40af" : ep.status === "generated" ? "#7c5cfc" : "#166534"}`,
                }}>
                {ep.number}
              </div>
              <div className="flex-1 space-y-2">
                <input value={ep.title} onChange={e => updateEpisode(i, { title: e.target.value })} className={inputCls} placeholder={`Episode ${ep.number} title`} />
                <textarea value={ep.synopsis} onChange={e => updateEpisode(i, { synopsis: e.target.value })} className={inputCls} rows={2} placeholder="Brief synopsis — what happens in this episode..." />
              </div>
              <button onClick={() => removeEpisode(i)} className="text-red-400 hover:text-red-300 text-xs mt-2">x</button>
            </div>
          ))}

          <button onClick={addEpisode}
            className="w-full py-3 rounded-xl text-sm font-medium border-2 border-dashed border-[#2a2a40] text-[#6060a0] hover:border-[#7c5cfc] hover:text-[#a080ff] transition-all">
            + Add Episode
          </button>

          {config.episodes.length === 0 && (
            <div className="text-center py-8 text-[#404060] text-xs">
              Plan your episodes here. You can generate them one by one after saving.
            </div>
          )}
        </div>
      )}

      {/* Step 5: Review & Launch */}
      {step === "review" && (
        <div className="space-y-4">
          <div className={cardCls}>
            <h3 className="text-white font-semibold text-sm mb-4">Series Summary</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <div><span className="text-[#6060a0]">Title:</span> <span className="text-white ml-2">{config.title || "—"}</span></div>
              <div><span className="text-[#6060a0]">Genre:</span> <span className="text-white ml-2">{config.genre}</span></div>
              <div><span className="text-[#6060a0]">Tone:</span> <span className="text-white ml-2">{config.tone}</span></div>
              <div><span className="text-[#6060a0]">Platform:</span> <span className="text-white ml-2">{config.platform}</span></div>
              <div><span className="text-[#6060a0]">Visual Style:</span> <span className="text-white ml-2">{config.visualStyle}</span></div>
              <div><span className="text-[#6060a0]">Format:</span> <span className="text-white ml-2">{config.aspectRatio}, {config.episodeDurationSec}s/ep</span></div>
              <div><span className="text-[#6060a0]">Characters:</span> <span className="text-white ml-2">{config.characters.length}</span></div>
              <div><span className="text-[#6060a0]">Episodes:</span> <span className="text-white ml-2">{config.episodes.length}</span></div>
            </div>

            {config.characters.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#2a2a40]">
                <p className="text-[10px] text-[#6060a0] uppercase tracking-wider mb-2 font-semibold">Cast</p>
                <div className="flex gap-2 flex-wrap">
                  {config.characters.map((c, i) => (
                    <span key={i} className="text-[10px] bg-[#1a1a2e] text-[#a080ff] border border-[#2a2a40] px-2 py-1 rounded">
                      {c.name || `Character ${i + 1}`} — {c.role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {config.episodes.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#2a2a40]">
                <p className="text-[10px] text-[#6060a0] uppercase tracking-wider mb-2 font-semibold">Episode Plan</p>
                {config.episodes.map((ep, i) => (
                  <div key={i} className="flex gap-2 items-baseline mb-1.5">
                    <span className="text-[10px] text-[#404060] w-5">{ep.number}.</span>
                    <span className="text-xs text-white">{ep.title || "Untitled"}</span>
                    {ep.synopsis && <span className="text-[10px] text-[#404060] truncate flex-1">— {ep.synopsis}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {saved ? (
            <div className="bg-green-950/30 border border-green-800 rounded-xl p-5 text-center">
              <p className="text-green-400 font-semibold text-sm mb-2">Series saved!</p>
              <p className="text-green-500/60 text-xs mb-4">Your series is ready. Generate episodes from the dashboard using Hybrid mode.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/dashboard?mode=hybrid" className="px-5 py-2 bg-[#7c5cfc] text-white text-xs font-semibold rounded-lg" style={{ textDecoration: "none" }}>
                  Generate Episode 1
                </Link>
                <Link href="/dashboard/story-bank" className="px-5 py-2 bg-[#1a1a2e] text-[#a080ff] text-xs font-semibold rounded-lg border border-[#2a2a40]" style={{ textDecoration: "none" }}>
                  Story Bank
                </Link>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !config.title.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #7c5cfc, #a06ef8)", color: "white" }}
            >
              {saving ? "Saving..." : "Save Series & Start Production"}
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => canPrev && setStep(STEPS[stepIndex - 1].id)}
          disabled={!canPrev}
          className="px-5 py-2 rounded-lg text-xs font-medium disabled:opacity-30 transition-colors"
          style={{ background: "#1a1a2e", color: "#6060a0", border: "1px solid #2a2a40" }}
        >
          Back
        </button>
        <button
          onClick={() => canNext && setStep(STEPS[stepIndex + 1].id)}
          disabled={!canNext}
          className="px-5 py-2 rounded-lg text-xs font-medium disabled:opacity-30 transition-colors"
          style={{ background: "#7c5cfc", color: "white" }}
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
