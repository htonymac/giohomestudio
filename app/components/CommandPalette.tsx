"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Command {
  id: string;
  label: string;
  icon: string;
  href?: string;
  action?: () => void;
  shortcut?: string;
  category: string;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    // Navigation
    { id: "home",       label: "Go to Home + Studio",    icon: "🏠", href: "/dashboard",              category: "Navigate", shortcut: "G H" },
    { id: "commercial", label: "Open Commercial Maker",   icon: "📣", href: "/dashboard/commercial",   category: "Navigate" },
    { id: "review",     label: "Open Review Queue",       icon: "📋", href: "/dashboard/review",       category: "Navigate", shortcut: "G R" },
    { id: "registry",   label: "Open All Content",        icon: "📁", href: "/dashboard/registry",     category: "Navigate" },
    { id: "assets",     label: "Open Asset Library",      icon: "📦", href: "/dashboard/assets",       category: "Navigate" },
    { id: "models",     label: "Open AI Models",          icon: "🤖", href: "/dashboard/models",       category: "Navigate" },
    { id: "music",      label: "Open Music Studio",       icon: "🎵", href: "/dashboard/music-studio", category: "Navigate" },
    { id: "chars",      label: "Open Characters",         icon: "🎭", href: "/dashboard/character-voices", category: "Navigate" },
    { id: "sfx",        label: "Open SFX Library",        icon: "💥", href: "/dashboard/sfx-library",  category: "Navigate" },
    { id: "analytics",  label: "Open Analytics",          icon: "📊", href: "/dashboard/analytics",    category: "Navigate" },
    { id: "settings",   label: "Open Settings",           icon: "⚙️", href: "/dashboard/settings",     category: "Navigate" },
    { id: "calendar",   label: "Open Calendar",           icon: "📅", href: "/dashboard/calendar",     category: "Navigate" },
    { id: "budget",     label: "Open Budget",             icon: "💰", href: "/dashboard/budget",       category: "Navigate" },
    { id: "stories",    label: "Open Story Bank",         icon: "💡", href: "/dashboard/story-bank",   category: "Navigate" },
    { id: "ab",         label: "Open A/B Testing",        icon: "⚖",  href: "/dashboard/ab-testing",   category: "Navigate" },
    // Actions
    { id: "new-video",  label: "New Video (Text → Video)", icon: "🎬", href: "/dashboard?mode=text_to_video",  category: "Create" },
    { id: "new-image",  label: "New Image (Text → Image)", icon: "🖼️", href: "/dashboard?mode=text_to_image",  category: "Create" },
    { id: "new-audio",  label: "New Audio (Text → Audio)", icon: "🎙", href: "/dashboard?mode=text_to_audio",  category: "Create" },
    { id: "new-i2v",    label: "Animate Image → Video",    icon: "🎭", href: "/dashboard?mode=image_to_video", category: "Create" },
    { id: "new-ad",     label: "New Commercial Ad",        icon: "📣", href: "/dashboard/commercial",          category: "Create" },
  ];

  const filtered = query.length > 0
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+P or Ctrl+P opens command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen(o => !o);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function execute(cmd: Command) {
    if (cmd.href) router.push(cmd.href);
    if (cmd.action) cmd.action();
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) { execute(filtered[selected]); }
  }

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }}>
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setOpen(false)} />

      {/* Palette */}
      <div style={{
        position: "relative", width: 500, maxHeight: 420,
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        overflow: "hidden",
        animation: "pageIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Input */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search... (↑↓ to navigate, Enter to select)"
            style={{
              width: "100%", background: "transparent", border: "none",
              color: "var(--text)", fontSize: 14, fontFamily: "'Outfit', sans-serif",
              outline: "none",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflowY: "auto", padding: 4 }}>
          {filtered.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              No commands match "{query}"
            </div>
          )}
          {(() => {
            let lastCat = "";
            return filtered.map((cmd, i) => {
              const showCat = cmd.category !== lastCat;
              lastCat = cmd.category;
              return (
                <div key={cmd.id}>
                  {showCat && (
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", padding: "8px 12px 4px" }}>
                      {cmd.category}
                    </div>
                  )}
                  <button
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setSelected(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "8px 12px", borderRadius: 6, border: "none",
                      background: i === selected ? "var(--surface3)" : "transparent",
                      color: "var(--text)", fontSize: 13, textAlign: "left",
                      cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{cmd.icon}</span>
                    <span style={{ flex: 1 }}>{cmd.label}</span>
                    {cmd.shortcut && (
                      <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "'IBM Plex Mono', monospace", background: "var(--surface4)", padding: "1px 6px", borderRadius: 4 }}>
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                </div>
              );
            });
          })()}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 12, justifyContent: "center" }}>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>↑↓ navigate</span>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>⏎ select</span>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>esc close</span>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>Ctrl+P toggle</span>
        </div>
      </div>
    </div>
  );
}
