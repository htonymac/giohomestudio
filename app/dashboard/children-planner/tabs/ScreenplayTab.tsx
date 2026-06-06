"use client";

// Screenplay tab — generates / displays formatted story script, with credits
// row, parse-to-segments, send-to-narration, and styled printable preview.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 2.4, 2026-06-05).

import * as React from "react";
import * as Icon from "../../../components/icons";

export interface ScreenplayScriptSeg { type: "narration" | "dialogue"; speaker?: string; text: string }

export interface ScreenplayTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  childAccent: string;
  childSafe: string;
  // Credits
  writtenBy: string;
  setWrittenBy: (s: string) => void;
  madeBy: string;
  setMadeBy: (s: string) => void;
  ideaFrom: string;
  setIdeaFrom: (s: string) => void;
  // Story state
  textContent: string;
  expandedContent: string;
  // Screenplay
  screenplay: string;
  setScreenplay: (s: string) => void;
  generatingScreenplay: boolean;
  screenplayError: string | null;
  generateScreenplay: () => void | Promise<void>;
  parsingScript: boolean;
  parseScript: () => void | Promise<void>;
  sendingToScenes: boolean;
  sendScreenplayToContent: () => void | Promise<void>;
  sendToScenesResult: string | null;
  // Script review
  showScriptReview: boolean;
  setShowScriptReview: (v: boolean) => void;
  scriptSegments: ScreenplayScriptSeg[];
  // Print preview meta
  studioName: string;
  projectTitle: string;
  contentParam: string;
  ageGroup: string;
  AGE_AUDIENCE: Record<string, string>;
  // Nav
  setActiveTab: (t: "content" | "style") => void;
}

export default function ScreenplayTab(props: ScreenplayTabProps) {
  const {
    cardStyle, s2, border, muted, childAccent, childSafe,
    writtenBy, setWrittenBy, madeBy, setMadeBy, ideaFrom, setIdeaFrom,
    textContent, expandedContent,
    screenplay, setScreenplay, generatingScreenplay, screenplayError, generateScreenplay,
    parsingScript, parseScript, sendingToScenes, sendScreenplayToContent, sendToScenesResult,
    showScriptReview, setShowScriptReview, scriptSegments,
    studioName, projectTitle, contentParam, ageGroup, AGE_AUDIENCE,
    setActiveTab,
  } = props;

  return (
    <div>
      {/* Story Credits — always visible */}
      <div style={{ ...cardStyle, marginBottom: 16, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>Story Credits</p>
          <span style={{ fontSize: 9, color: muted }}>Saved on this device — fills Assembly too</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
              Written by {writtenBy && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
            </label>
            <input type="text" value={writtenBy} onChange={e => setWrittenBy(e.target.value)} placeholder="Your name"
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${writtenBy ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
              Made by {madeBy && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
            </label>
            <input type="text" value={madeBy} onChange={e => setMadeBy(e.target.value)} placeholder="Studio / creator"
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${madeBy ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: 1 }}>
              Idea from {ideaFrom && <span style={{ color: "#34d399", marginLeft: 4 }}>✓</span>}
            </label>
            <input type="text" value={ideaFrom} onChange={e => setIdeaFrom(e.target.value)} placeholder="Original idea by..."
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "6px 10px", background: s2, border: `1px solid ${ideaFrom ? "#34d39960" : border}`, borderRadius: 8, color: "#fff", fontSize: 11, outline: "none" }} />
          </div>
        </div>
      </div>

      {!screenplay && !generatingScreenplay && (
        <div style={{ ...cardStyle, borderColor: `${childAccent}20`, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Story Script</p>
          <p style={{ fontSize: 11, color: muted, marginBottom: 16 }}>Generate a formatted story script from your content, or paste your own and parse it into narrator/dialogue segments for audio generation.</p>
          {!textContent.trim() && !expandedContent.trim() ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Enter your story content first — go to the Content tab.</p>
              <button onClick={() => setActiveTab("content")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: childAccent, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Content</button>
            </div>
          ) : (
            <>
              {screenplayError && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{screenplayError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={generateScreenplay}
                  style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Generate Story Script
                </button>
                <button onClick={() => setScreenplay("FADE IN:\n\nINT. SCENE ONE - DAY\n\nPaste your story script here...\n\nFADE OUT.\n\nTHE END")}
                  style={{ padding: "10px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                  Paste My Own
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {generatingScreenplay && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Writing your story script...</p>
          <p style={{ fontSize: 11, color: muted }}>15–30 seconds</p>
        </div>
      )}

      {screenplay && !generatingScreenplay && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
              <span style={{ fontSize: 10, color: muted }}>Written by:</span>
              <input type="text" value={writtenBy} onChange={e => setWrittenBy(e.target.value)} placeholder="Author name"
                style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", width: 160 }} />
            </div>
            <button onClick={generateScreenplay}
              style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: "transparent", color: childAccent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              Regenerate
            </button>
            <button onClick={() => { const blob = new Blob([screenplay], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${contentParam || "story"}_script.txt`; a.click(); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Download .txt
            </button>
            <button onClick={parseScript} disabled={parsingScript}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: parsingScript ? "#2a2a40" : "#00d4ff", color: "#000", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer" }}>
              {parsingScript ? "Parsing..." : "Parse Script"}
            </button>
            <button onClick={sendScreenplayToContent} disabled={sendingToScenes}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${childSafe}60` : childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes ? "default" : "pointer" }}>
              {sendingToScenes ? "Sending..." : "Send to Narration →"}
            </button>
          </div>

          {sendToScenesResult && (
            <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${childAccent}10`, border: `1px solid ${childAccent}30`, display: "flex", alignItems: "center", gap: 10 }}>
              <Icon.Check style={{ width: 14, height: 14, color: childAccent, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: childAccent, flex: 1 }}>{sendToScenesResult}</p>
              <button onClick={() => setActiveTab("style")} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Go to Style & Voice</button>
            </div>
          )}

          {showScriptReview && scriptSegments.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Parsed Script — {scriptSegments.length} segments</p>
                <button onClick={() => setShowScriptReview(false)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>Hide</button>
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {scriptSegments.map((seg, i) => (
                  <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: seg.type === "dialogue" ? "rgba(0,212,255,0.1)" : `${childAccent}10`, borderLeft: `3px solid ${seg.type === "dialogue" ? "#00d4ff" : childAccent}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: seg.type === "dialogue" ? "#00d4ff" : childAccent, textTransform: "uppercase", marginRight: 8 }}>
                      {seg.type === "dialogue" ? (seg.speaker || "CHAR") : "NARR"}
                    </span>
                    <span style={{ fontSize: 10, color: "#ccc" }}>{seg.text.substring(0, 100)}{seg.text.length > 100 ? "..." : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea value={screenplay} onChange={e => setScreenplay(e.target.value)}
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "'Courier New', Courier, monospace", minHeight: 400, lineHeight: 1.8, resize: "vertical" as const, whiteSpace: "pre-wrap" }} />

          <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: "40px 40px", maxWidth: 780, margin: "16px auto 0", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>
            <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid #ddd" }}>
              <p style={{ fontSize: 9, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>{studioName || "GIO HOME AI STUDIO"}</p>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8, lineHeight: 1.2 }}>{(projectTitle || contentParam || "CHILDREN STORY").toUpperCase()}</h1>
              {(ageGroup) && <p style={{ fontSize: 11, color: "#777", marginBottom: 24, fontStyle: "italic" }}>For {AGE_AUDIENCE[ageGroup] || "children"}</p>}
              <p style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Written by</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#000", marginBottom: 20 }}>{writtenBy || "—"}</p>
              <p style={{ fontSize: 8, color: "#aaa", letterSpacing: 1 }}>AI Assets by {studioName || "GIO HOME AI STUDIO"} · © {new Date().getFullYear()}</p>
            </div>
            <div style={{ color: "#111", fontSize: 12, lineHeight: 2 }}>
              {screenplay.split("\n").map((line, i) => {
                const t = line.trim();
                if (!t) return <div key={i} style={{ height: 6 }} />;
                if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(t)) return <p key={i} style={{ fontWeight: 700, color: "#000", marginTop: 24, marginBottom: 2 }}>{t}</p>;
                if (/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:)/.test(t)) return <p key={i} style={{ fontStyle: "italic", color: "#555", marginTop: 12 }}>{t}</p>;
                if (t === "THE END") return <p key={i} style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginTop: 40, letterSpacing: 4 }}>THE END</p>;
                if (/^[A-Z][A-Z\s\-'().]+$/.test(t) && t.length < 40 && !t.startsWith("INT") && !t.startsWith("EXT") && !t.startsWith("FADE") && !t.startsWith("CUT")) return <p key={i} style={{ fontWeight: 700, marginTop: 16, paddingLeft: "38%" }}>{t}</p>;
                if (t.startsWith("(") && t.endsWith(")")) return <p key={i} style={{ fontStyle: "italic", color: "#555", paddingLeft: "30%" }}>{t}</p>;
                return <p key={i} style={{ color: "#333", marginBottom: 2 }}>{line}</p>;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
