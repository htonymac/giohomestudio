"use client";

// Story / content tab — learning mode selector, story textarea, era+culture
// lock, AI expand/modify/devocarize toolbar, reference image upload, energy
// tone, scene preview after expandStory, proceed-to-script CTA.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 2.3, 2026-06-05).

import * as React from "react";

export type StoryModifyKind = "intense" | "playful" | "funny" | "adventure" | "emotional"
  | "educational" | "magical" | "cozy" | "diverse" | "musical";

export interface StoryLearningMode { id: string; label: string; desc: string }
export interface StorySceneIntel { environmentType: string; timeOfDay: string; energyLevel: string; ambienceSounds: string[]; sfxEvents: string[] }
export interface StoryChildScene { scene: number; title: string; visualDescription?: string }

export interface StoryTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  childAccent: string;
  childSafe: string;
  // Learning mode
  LEARNING_MODES: ReadonlyArray<StoryLearningMode>;
  learningMode: string;
  setLearningMode: (id: string) => void;
  // URL params
  topicParam: string;
  charactersParam: string;
  contentParam: string;
  langParam: string;
  lang2Param: string;
  isBilingual: boolean;
  // Story input
  textContent: string;
  setTextContent: (s: string) => void;
  // Era + culture
  storyEra: string;
  setStoryEra: (s: string) => void;
  storyCulture: string;
  setStoryCulture: (s: string) => void;
  // AI actions
  expandContent: () => void | Promise<void>;
  // TODO #13 Phase 2: when a deterministic teaching type is selected (counting/
  // spelling/abc/concept) the content is built from the time-budget brain, so the
  // Expand button works WITHOUT typed text — the content type is the input.
  deterministicBuild?: boolean;
  expandingContent: boolean;
  expandStory: () => void | Promise<void>;
  expanding: boolean;
  modifyPrompt: (kind: StoryModifyKind) => void | Promise<void>;
  modifyingPrompt: string | null;
  prefillPrompt: () => void | Promise<void>;
  prefillingPrompt: boolean;
  devocarize: (age: number) => void | Promise<void>;
  devocarizing: number | null;
  extractChildCharacters: () => void | Promise<void>;
  extractingChars: "idle" | "extracting" | "building";
  // Story AI provider picker
  storyAiProvider: string;
  setStoryAiProvider: (s: string) => void;
  // Expanded + scenes preview
  expandedContent: string;
  childScenes: StoryChildScene[];
  runningIntelligence: boolean;
  runSceneIntelligence: () => void | Promise<void>;
  sceneIntelligence: Record<string, StorySceneIntel>;
  SCENE_ENERGY_COLOR: Record<string, string>;
  autoSfx: boolean;
  // Reference image
  contentImage: string | null;
  setContentImage: (s: string | null) => void;
  // Energy
  tone: string;
  setTone: (s: string) => void;
  // Nav + actions
  setLastAction: (s: string) => void;
  setActiveTab: (t: "review1" | "script") => void;
}

export default function StoryTab(props: StoryTabProps) {
  const {
    cardStyle, labelStyle, s2, border, muted, childAccent, childSafe,
    LEARNING_MODES, learningMode, setLearningMode,
    topicParam, charactersParam, contentParam, langParam, lang2Param, isBilingual,
    textContent, setTextContent,
    storyEra, setStoryEra, storyCulture, setStoryCulture,
    expandContent, expandingContent, expandStory, expanding, deterministicBuild,
    modifyPrompt, modifyingPrompt, prefillPrompt, prefillingPrompt,
    devocarize, devocarizing, extractChildCharacters, extractingChars,
    storyAiProvider, setStoryAiProvider,
    expandedContent, childScenes, runningIntelligence, runSceneIntelligence, sceneIntelligence, SCENE_ENERGY_COLOR, autoSfx,
    contentImage, setContentImage,
    tone, setTone,
    setLastAction, setActiveTab,
  } = props;

  return (
    <div style={{ ...cardStyle, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Enter Your Content</h2>

      {/* Learning Mode Selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={labelStyle}>Learning Mode</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {LEARNING_MODES.map(mode => {
            const isActive = learningMode === mode.id;
            return (
              <button key={mode.id} onClick={() => { setLearningMode(mode.id); setLastAction(`Mode: ${mode.label}`); }}
                style={{
                  padding: "12px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: `2px solid ${isActive ? childAccent : border}`,
                  background: isActive ? `${childAccent}10` : "transparent",
                  transition: "all 0.15s",
                }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: isActive ? childAccent : "#fff", marginBottom: 2 }}>{mode.label}</p>
                <p style={{ fontSize: 9, color: muted, lineHeight: 1.3 }}>{mode.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {topicParam && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <p style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>Topic: {topicParam}</p>
          <p style={{ fontSize: 9, color: muted, marginTop: 2 }}>Pre-filled from curriculum suggestion. Edit below to customise, or use as-is.</p>
        </div>
      )}

      {charactersParam && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <p style={{ fontSize: 11, color: childAccent, fontWeight: 600 }}>Characters: {charactersParam.split(",").filter(Boolean).length} imported</p>
          <p style={{ fontSize: 9, color: muted }}>Characters from your library will be used in this content.</p>
        </div>
      )}

      <textarea value={textContent} onChange={e => { setTextContent(e.target.value); setLastAction("Content updated"); }} rows={6}
        placeholder={contentParam === "3letter" ? "Enter words (one per line):\ncat\nsat\nram\njam\nran" :
          contentParam === "abc" ? "Enter the letters to cover (or leave empty for full A-Z)" :
          contentParam === "poem" ? "Enter your children's poem:\nTwinkle twinkle little star\nHow I wonder what you are" :
          contentParam === "storybook" ? "Write your children's story:\nOnce upon a time, there was a little cat named Sam. Sam loved to play in the garden..." :
          "Enter your content here..."}
        style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }} />

      {/* Era & Culture Lock */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
        <div>
          <label style={{ fontSize: 9, color: "#fb923c", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>Story Era / Year</label>
          <input value={storyEra} onChange={e => setStoryEra(e.target.value)}
            placeholder="e.g. Today, 1819, 899 AD, 300 BC"
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", color: "#fff", fontSize: 10, outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 9, color: "#fb923c", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>Story Culture / Setting</label>
          <input value={storyCulture} onChange={e => setStoryCulture(e.target.value)}
            placeholder="e.g. Contemporary Lagos, Victorian England"
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 10px", color: "#fff", fontSize: 10, outline: "none" }} />
        </div>
      </div>
      {(storyEra || storyCulture) && (
        <p style={{ fontSize: 8, color: "#fb923c", marginTop: 4, fontWeight: 600 }}>
          Era lock active: {[storyEra, storyCulture].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* AI Content Expansion + Modify buttons */}
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
        {(() => {
          const canBuild = !!deterministicBuild || !!textContent.trim();
          const off = expandingContent || !canBuild;
          return (
            <button onClick={expandContent} disabled={off}
              style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childAccent}`, background: expandingContent ? `${childAccent}10` : `${childAccent}20`, color: off ? muted : childAccent, fontSize: 12, fontWeight: 600, cursor: off ? "not-allowed" : "pointer" }}>
              {expandingContent ? "Building..." : (deterministicBuild && !textContent.trim() ? "Build cards by time" : "Expand with AI")}
            </button>
          );
        })()}
        <button onClick={expandStory} disabled={expanding || !textContent.trim()}
          style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: expanding ? `${childSafe}10` : `${childSafe}20`, color: (expanding || !textContent.trim()) ? muted : childSafe, fontSize: 12, fontWeight: 700, cursor: (expanding || !textContent.trim()) ? "not-allowed" : "pointer" }}>
          {expanding ? "Building..." : "Build Story with AI"}
        </button>
        {([
          { kind: "intense"     as const, label: "🔥 Intensify",        col: "#ef4444" },
          { kind: "playful"     as const, label: "🎈 Make Playful",     col: "#f472b6" },
          { kind: "funny"       as const, label: "😄 Make Fun",         col: "#fbbf24" },
          { kind: "educational" as const, label: "📚 Educational",      col: "#06b6d4" },
          { kind: "adventure"   as const, label: "🗺 Adventure",        col: "#10b981" },
          { kind: "magical"     as const, label: "✨ Magical",          col: "#a78bfa" },
          { kind: "cozy"        as const, label: "🤗 Cozy",             col: "#fb923c" },
          { kind: "diverse"     as const, label: "🌍 Diverse",          col: "#34d399" },
          { kind: "musical"     as const, label: "🎵 Musical",          col: "#c084fc" },
          { kind: "emotional"   as const, label: "💝 Heartwarming",     col: "#ec4899" },
        ]).map(({ kind, label, col }) => {
          const busy = modifyingPrompt === kind;
          const disabled = !textContent.trim() || modifyingPrompt !== null || prefillingPrompt;
          return (
            <button key={kind} onClick={() => modifyPrompt(kind)} disabled={disabled}
              title={`Rewrite the story idea — ${label.replace(/^\S+\s/, "").toLowerCase()}`}
              style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${col}55`, background: busy ? `${col}25` : `${col}12`, color: disabled ? muted : col, fontSize: 9, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}>
              {busy ? "…" : label}
            </button>
          );
        })}
        <button
          onClick={() => {
            if (!textContent.trim()) { setLastAction("Add story text first"); return; }
            const raw = window.prompt("Rewrite story for which age? (5-12)", "5");
            if (raw === null) return;
            const age = parseInt(raw.trim(), 10);
            if (!Number.isFinite(age) || age < 5 || age > 12) {
              setLastAction("Age must be a number between 5 and 12");
              return;
            }
            void devocarize(age);
          }}
          disabled={!!devocarizing || !textContent.trim() || modifyingPrompt !== null || prefillingPrompt}
          title="Rewrite story for a target reading age — simpler words, shorter sentences"
          style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${childAccent}55`, background: devocarizing ? `${childAccent}25` : `${childAccent}12`, color: (!!devocarizing || !textContent.trim()) ? muted : childAccent, fontSize: 9, fontWeight: 700, cursor: (!!devocarizing || !textContent.trim()) ? "not-allowed" : "pointer", opacity: (!!devocarizing || !textContent.trim()) ? 0.55 : 1 }}>
          {devocarizing ? `Age ${devocarizing}…` : "📖 De-vocabularize"}
        </button>
        {prefillingPrompt && (
          <span style={{ fontSize: 9, color: childAccent, fontWeight: 700, padding: "5px 9px" }}>
            ✨ AI suggesting a unique story idea…
          </span>
        )}
        <button onClick={() => prefillPrompt()} disabled={prefillingPrompt || modifyingPrompt !== null}
          title="Generate a fresh unique story idea from the current selections + a new random seed"
          style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${childSafe}55`, background: prefillingPrompt ? `${childSafe}25` : `${childSafe}12`, color: (prefillingPrompt || modifyingPrompt !== null) ? muted : childSafe, fontSize: 9, fontWeight: 700, cursor: (prefillingPrompt || modifyingPrompt !== null) ? "not-allowed" : "pointer", opacity: (prefillingPrompt || modifyingPrompt !== null) ? 0.55 : 1 }}>
          {prefillingPrompt ? "…" : "✨ Re-suggest"}
        </button>
        <select value={storyAiProvider} onChange={e => setStoryAiProvider(e.target.value)}
          title="Active LLM for prefill + modify buttons"
          style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${childAccent}55`, background: "#151518", color: childAccent, fontSize: 9, fontWeight: 700, cursor: "pointer", outline: "none" }}>
          <option value="ollama"                              style={{ background: "#151518" }}>🧠 Ollama (local, free)</option>
          <option value="claude:claude-haiku-4-5-20251001"    style={{ background: "#151518" }}>⚡ Claude Haiku 4.5</option>
          <option value="claude:claude-sonnet-4-6"            style={{ background: "#151518" }}>✨ Claude Sonnet 4.6 (rec)</option>
          <option value="claude:claude-opus-4-7"              style={{ background: "#151518" }}>🌟 Claude Opus 4.7</option>
          <option value="openai:gpt-4o-mini"                  style={{ background: "#151518" }}>🔸 GPT-4o Mini</option>
          <option value="openai:gpt-4o"                       style={{ background: "#151518" }}>🔶 GPT-4o</option>
          <option value="openai:o1-mini"                      style={{ background: "#151518" }}>🧩 o1-mini (reasoning)</option>
        </select>
        {expandedContent && (
          <button onClick={extractChildCharacters} disabled={extractingChars !== "idle"}
            style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${childSafe}`, background: `${childSafe}15`, color: extractingChars !== "idle" ? muted : childSafe, fontSize: 12, fontWeight: 600, cursor: extractingChars !== "idle" ? "not-allowed" : "pointer" }}>
            {extractingChars === "building" ? "Building Characters..." : extractingChars === "extracting" ? "Extracting..." : "Extract Characters from Story"}
          </button>
        )}
      </div>

      {/* Show planned scenes after expandStory */}
      {childScenes.length > 0 && (
        <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: `${childSafe}08`, border: `1px solid ${childSafe}25` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: childSafe, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>
              Story Built — {childScenes.length} Scenes Planned
            </p>
            <button disabled={runningIntelligence || childScenes.length === 0} onClick={runSceneIntelligence}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #4ade8030", background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}>
              {runningIntelligence ? "Detecting..." : "Story Scenes"}
            </button>
          </div>
          {runningIntelligence && (
            <p style={{ fontSize: 10, color: "#4ade80", margin: "4px 0" }}>Scene Intelligence running — detecting environments and ambient sounds...</p>
          )}
          {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
            <p style={{ fontSize: 10, color: "#666", margin: "4px 0" }}>
              {Object.keys(sceneIntelligence).length} scenes have sound environment data
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {childScenes.map(s => {
              const sceneKey = `child_sc${String(s.scene).padStart(2, "0")}`;
              const intel = sceneIntelligence[sceneKey];
              return (
                <div key={s.scene} style={{ padding: "8px 12px", borderRadius: 8, background: s2, border: `1px solid ${border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, color: childAccent, fontWeight: 700, flexShrink: 0, minWidth: 28 }}>SC{String(s.scene).padStart(2, "0")}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{s.title}</p>
                    <p style={{ fontSize: 9, color: muted, lineHeight: 1.4 }}>{(s.visualDescription ?? "").substring(0, 100)}{(s.visualDescription ?? "").length > 100 ? "..." : ""}</p>
                    {intel && (() => {
                      const energyColor = SCENE_ENERGY_COLOR[intel.energyLevel] || "#888";
                      return (
                        <div style={{ margin: "8px 0", padding: "6px 8px", borderRadius: 8, background: "#ffffff05", border: "1px solid #ffffff0a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{intel.environmentType.replace(/-/g, " ")}</span>
                            <span style={{ fontSize: 8, color: "#666" }}>•</span>
                            <span style={{ fontSize: 8, color: "#666", textTransform: "capitalize" }}>{intel.timeOfDay}</span>
                            <span style={{ marginLeft: "auto", fontSize: 7, padding: "1px 5px", borderRadius: 4, background: `${energyColor}20`, color: energyColor, fontWeight: 700, textTransform: "uppercase" }}>{intel.energyLevel}</span>
                          </div>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                            {intel.ambienceSounds.slice(0, 4).map((sound, i) => (
                              <span key={i} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#1a2a1a", color: "#4ade80", border: "1px solid #4ade8030" }}>{sound}</span>
                            ))}
                            {intel.sfxEvents.length > 0 && (
                              <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#2a1a1a", color: "#eab308", border: "1px solid #eab30830" }}>{intel.sfxEvents[0]}</span>
                            )}
                            {autoSfx && intel.sfxEvents.length > 0 && (
                              <span style={{ fontSize: 6, padding: "2px 5px", borderRadius: 20, background: "#1a1a2a", color: "#818cf8", border: "1px solid #818cf830" }}>Auto SFX</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => setActiveTab("review1")} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Proceed to Review →
          </button>
        </div>
      )}

      {/* Show expanded content if available */}
      {expandedContent && (
        <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: `${childAccent}08`, border: `1px solid ${childAccent}25` }}>
          <p style={{ fontSize: 10, color: childAccent, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>AI Expanded Story</p>
          <p style={{ fontSize: 12, color: "#e0e0f0", lineHeight: 1.6, whiteSpace: "pre-wrap" as const }}>{expandedContent}</p>
          <button onClick={() => { setTextContent(expandedContent); setLastAction("Used expanded content"); }}
            style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Use This Text
          </button>
        </div>
      )}

      {/* Upload Reference Image */}
      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 10, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Upload Reference Image</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Choose Image
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const formData = new FormData();
              formData.append("file", file);
              try {
                const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
                const data = await res.json();
                if (data.url) { setContentImage(data.url); setLastAction("Reference image uploaded"); }
              } catch { /* ignore */ }
            }} />
          </label>
          {contentImage && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={contentImage} alt="Reference" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: `1px solid ${border}` }} />
              <button onClick={() => { setContentImage(null); setLastAction("Reference image removed"); }}
                style={{ fontSize: 9, padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {isBilingual && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <p style={{ fontSize: 11, color: "#f59e0b" }}>
            Bilingual mode active — each word/sentence will be shown in {langParam.toUpperCase()} and {lang2Param.toUpperCase()} with dual narration.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: muted, marginBottom: 6 }}>Energy Level</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setTone("soft"); setLastAction("Energy set to Soft"); }}
              style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tone === "soft" ? childSafe : border}`, background: tone === "soft" ? `${childSafe}10` : "transparent", cursor: "pointer", textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: tone === "soft" ? childSafe : "#fff" }}>Soft</p>
              <p style={{ fontSize: 8, color: muted }}>Calm, bedtime, gentle</p>
            </button>
            <button onClick={() => { setTone("active"); setLastAction("Energy set to Active"); }}
              style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${tone === "active" ? "#f59e0b" : border}`, background: tone === "active" ? "rgba(245,158,11,0.1)" : "transparent", cursor: "pointer", textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: tone === "active" ? "#f59e0b" : "#fff" }}>Active</p>
              <p style={{ fontSize: 8, color: muted }}>Playful, energetic, fun</p>
            </button>
          </div>
        </div>
      </div>

      {textContent && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => setActiveTab("script")}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Next: Script & Story Plan
          </button>
        </div>
      )}
    </div>
  );
}
