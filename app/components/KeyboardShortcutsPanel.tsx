"use client";

import { useState, useEffect } from "react";

const s1 = "#0b0e18";
const border = "#1e2a35";
const text = "#dde4f0";
const muted = "#4e6080";
const purple = "#a855f7";

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string[]; desc: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Playback",
    shortcuts: [
      { keys: ["Space"], desc: "Play / Pause" },
      { keys: ["K"], desc: "Pause" },
      { keys: ["J"], desc: "Rewind 10s" },
      { keys: ["L"], desc: "Forward 10s" },
      { keys: ["←"], desc: "Seek -5s" },
      { keys: ["→"], desc: "Seek +5s" },
      { keys: ["Shift", "←"], desc: "Seek -1s" },
      { keys: ["Shift", "→"], desc: "Seek +1s" },
      { keys: ["Home"], desc: "Go to start" },
      { keys: ["End"], desc: "Go to end" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: ["I"], desc: "Set in-point" },
      { keys: ["O"], desc: "Set out-point" },
      { keys: ["S"], desc: "Split at playhead" },
      { keys: ["["], desc: "Previous segment" },
      { keys: ["]"], desc: "Next segment" },
      { keys: ["Delete"], desc: "Delete selected" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["?"], desc: "Toggle this panel" },
      { keys: ["+"], desc: "Zoom timeline in" },
      { keys: ["-"], desc: "Zoom timeline out" },
    ],
  },
];

export default function KeyboardShortcutsPanel({ onClose }: { onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(6,8,16,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: s1, borderRadius: 16, border: `1px solid ${border}`,
          padding: 24, maxWidth: 520, width: "90%", maxHeight: "80vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0 }}>Keyboard Shortcuts</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: muted, fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <p style={{ fontSize: 10, fontWeight: 700, color: purple, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{group.title}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {group.shortcuts.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: text }}>{s.desc}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {s.keys.map((k, j) => (
                        <span key={j}>
                          <kbd style={{
                            padding: "2px 8px", borderRadius: 4,
                            background: "#1a1f2e", border: `1px solid ${border}`,
                            fontSize: 10, fontFamily: "monospace", color: muted,
                          }}>{k}</kbd>
                          {j < s.keys.length - 1 && <span style={{ color: muted, fontSize: 9, margin: "0 2px" }}>+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 9, color: muted, marginTop: 16, textAlign: "center" }}>Press <kbd style={{ padding: "1px 4px", borderRadius: 3, background: "#1a1f2e", border: `1px solid ${border}`, fontSize: 9, fontFamily: "monospace" }}>?</kbd> or <kbd style={{ padding: "1px 4px", borderRadius: 3, background: "#1a1f2e", border: `1px solid ${border}`, fontSize: 9, fontFamily: "monospace" }}>Esc</kbd> to close</p>
      </div>
    </div>
  );
}
