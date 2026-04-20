"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
}

const TYPE_ICONS: Record<string, string> = {
  content: "🎬", commercial: "📣", character: "🎭", asset: "📦", story: "💡",
};

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside — no full-screen overlay, so rest of UI stays clickable
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative" style={{ width: "100%", maxWidth: 400 }}>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search everything... (Ctrl+K)"
          style={{
            width: "100%",
            background: "var(--surface3)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "7px 12px 7px 32px",
            color: "var(--text)",
            fontSize: 12,
            fontFamily: "'Outfit', sans-serif",
            outline: "none",
          }}
        />
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text3)", pointerEvents: "none" }}>
          🔍
        </span>
        {loading && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text3)" }}>...</span>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0, right: 0,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: 10,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
            zIndex: 100,
            maxHeight: 320,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {results.map(r => (
            <button
              key={`${r.type}_${r.id}`}
              onClick={() => { router.push(r.href); setOpen(false); setQuery(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "8px 10px", borderRadius: 6,
                background: "transparent", border: "none",
                color: "var(--text)", fontSize: 12, textAlign: "left",
                cursor: "pointer", fontFamily: "'Outfit', sans-serif",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface3)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 14 }}>{TYPE_ICONS[r.type] ?? "📄"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{r.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
