"use client";

// /admin — single-page maintainer dashboard.
//
// Asks for ADMIN_TOKEN once (stores in localStorage), then renders:
//   - Feature flags with toggle switches (click → flip via POST)
//   - LLM cache stats + top 10 most-hit prompts
//   - Daily spend today + last 7 days bar chart
//   - Circuit breaker state per gateway
//   - "Fire Sentry test" button
//
// Lives at https://andiostudio.com/admin. Site-wide cookie lock still applies
// (visit /unlock first). Token is required for the underlying /api/admin/*
// calls and never appears in the URL or logs.
//
// Built 2026-06-05 (12-hour run extension).

import { useEffect, useState } from "react";

const LS_TOKEN_KEY = "ghs_admin_token";

interface Flag {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

interface CostSnapshot {
  llmCache: {
    rows: number;
    totalHits: number;
    topHits: Array<{ hashKey: string; hits: number; prompt: string; createdAt: string }>;
  };
  dailySpend: {
    today: {
      totalCents: number;
      activeUsers: number;
      topSpenders: Array<{ userKey: string; cents: number }>;
    };
    last7Days: Array<{ day: string; totalCents: number; activeUsers: number }>;
  };
  circuitBreakers: Record<string, { state: string; failures: number }>;
  flags: Array<{ key: string; enabled: boolean; updatedAt: string }>;
}

export default function AdminDashboard() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [cost, setCost] = useState<CostSnapshot | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sentryStatus, setSentryStatus] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LS_TOKEN_KEY) || "";
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refresh() {
    setErr(null);
    try {
      const [c, f] = await Promise.all([
        fetch("/api/admin/cost", { headers: { "X-Admin-Token": token } }).then(r => {
          if (r.status === 401) throw new Error("unauthorized — wrong token?");
          return r.json();
        }),
        fetch("/api/admin/flags", { headers: { "X-Admin-Token": token } }).then(r => r.json()),
      ]);
      setCost(c as CostSnapshot);
      setFlags((f as { flags: Flag[] }).flags);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleFlag(key: string, next: boolean) {
    setErr(null);
    try {
      await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ key, enabled: next, by: "admin-ui" }),
      });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function fireSentryTest() {
    setSentryStatus("firing...");
    try {
      const r = await fetch("/api/admin/sentry-test?kind=capture", {
        headers: { "X-Admin-Token": token },
      });
      const j = (await r.json()) as { eventId?: string; error?: string };
      setSentryStatus(j.eventId ? `✓ event ${j.eventId.slice(0, 12)}… — check sentry.io within 30s` : `✗ ${j.error}`);
    } catch (e) {
      setSentryStatus(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function logout() {
    window.localStorage.removeItem(LS_TOKEN_KEY);
    setToken("");
    setTokenInput("");
    setCost(null);
    setFlags(null);
  }

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 24, width: 420 }}>
          <h1 style={{ fontSize: 20, marginBottom: 6 }}>Admin Dashboard</h1>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
            Paste your <code style={{ color: "#a855f7" }}>ADMIN_TOKEN</code>. Stored in localStorage, never sent in URL.
          </p>
          <input
            type="password"
            autoFocus
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && tokenInput.trim()) { window.localStorage.setItem(LS_TOKEN_KEY, tokenInput.trim()); setToken(tokenInput.trim()); } }}
            placeholder="64-hex token"
            style={{ width: "100%", padding: "10px 12px", background: "#0a0a14", border: "1px solid #222", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "monospace", outline: "none" }}
          />
          <button
            onClick={() => { if (tokenInput.trim()) { window.localStorage.setItem(LS_TOKEN_KEY, tokenInput.trim()); setToken(tokenInput.trim()); } }}
            style={{ marginTop: 12, width: "100%", padding: "10px 16px", background: "#a855f7", border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────
  const maxDayCents = Math.max(1, ...(cost?.dailySpend.last7Days.map(d => d.totalCents) ?? [0]));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>GHS Admin · andiostudio.com</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh} style={{ padding: "6px 12px", background: "#222", border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer" }}>↻ Refresh</button>
          <button onClick={logout} style={{ padding: "6px 12px", background: "#222", border: "1px solid #333", borderRadius: 6, color: "#aaa", fontSize: 12, cursor: "pointer" }}>Logout</button>
        </div>
      </header>

      {err && <div style={{ background: "#3a0a0a", border: "1px solid #5a1a1a", color: "#fca", padding: 10, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>

        {/* Feature Flags */}
        <section style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "#a855f7" }}>FEATURE FLAGS — kill switches</h2>
          {!flags ? <p style={{ color: "#666" }}>loading…</p> : flags.map(f => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontFamily: "monospace", color: f.enabled ? "#22c55e" : "#ef4444" }}>{f.key}</p>
                <p style={{ fontSize: 10, color: "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>{f.description ?? ""}</p>
              </div>
              <button
                onClick={() => toggleFlag(f.key, !f.enabled)}
                style={{ marginLeft: 12, padding: "4px 10px", borderRadius: 12, border: "none", background: f.enabled ? "#22c55e" : "#ef4444", color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", width: 60 }}
              >
                {f.enabled ? "ON" : "OFF"}
              </button>
            </div>
          ))}
        </section>

        {/* Cost — daily spend */}
        <section style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "#00d4ff" }}>DAILY SPEND</h2>
          {!cost ? <p style={{ color: "#666" }}>loading…</p> : <>
            <p style={{ fontSize: 24, fontWeight: 700 }}>${(cost.dailySpend.today.totalCents / 100).toFixed(2)}<span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>today · {cost.dailySpend.today.activeUsers} users</span></p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, marginTop: 16 }}>
              {cost.dailySpend.last7Days.length === 0 ? <p style={{ color: "#666", fontSize: 11 }}>no spend in last 7 days</p> :
                cost.dailySpend.last7Days.map(d => (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: "100%", background: "#00d4ff", borderRadius: 2, height: `${(d.totalCents / maxDayCents) * 70}px`, minHeight: 2 }} title={`$${(d.totalCents/100).toFixed(2)}`} />
                    <span style={{ fontSize: 8, color: "#666" }}>{d.day.slice(5)}</span>
                  </div>
                ))}
            </div>
            {cost.dailySpend.today.topSpenders.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #222" }}>
                <p style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>TOP SPENDERS TODAY</p>
                {cost.dailySpend.today.topSpenders.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "2px 0" }}>
                    <code style={{ color: "#aaa" }}>{s.userKey}</code>
                    <span style={{ color: "#00d4ff" }}>${(s.cents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>}
        </section>

        {/* LLM Cache */}
        <section style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "#22c55e" }}>LLM CACHE</h2>
          {!cost ? <p style={{ color: "#666" }}>loading…</p> : <>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{cost.llmCache.totalHits.toLocaleString()}<span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>hits · {cost.llmCache.rows} unique prompts</span></p>
            {cost.llmCache.topHits.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #222" }}>
                <p style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>TOP HITS</p>
                {cost.llmCache.topHits.slice(0, 5).map(h => (
                  <div key={h.hashKey} style={{ fontSize: 10, padding: "3px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <span style={{ color: "#22c55e", marginRight: 6 }}>×{h.hits}</span>
                    <span style={{ color: "#aaa" }}>{h.prompt.slice(0, 60)}…</span>
                  </div>
                ))}
              </div>
            )}
          </>}
        </section>

        {/* Circuit Breakers */}
        <section style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "#f59e0b" }}>CIRCUIT BREAKERS</h2>
          {!cost ? <p style={{ color: "#666" }}>loading…</p> : Object.entries(cost.circuitBreakers).map(([name, s]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a1a" }}>
              <code style={{ color: "#aaa", fontSize: 11 }}>{name}</code>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 12, background: s.state === "closed" ? "#22c55e22" : s.state === "open" ? "#ef444422" : "#f59e0b22", color: s.state === "closed" ? "#22c55e" : s.state === "open" ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>
                {s.state.toUpperCase()} · {s.failures} failures
              </span>
            </div>
          ))}
        </section>

        {/* Sentry test */}
        <section style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: "#ef4444" }}>SENTRY HEALTH</h2>
          <p style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Fire a controlled error to confirm Sentry capture round-trip.</p>
          <button onClick={fireSentryTest} style={{ padding: "8px 16px", background: "#ef4444", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Fire test event
          </button>
          {sentryStatus && <p style={{ marginTop: 10, fontSize: 11, color: sentryStatus.startsWith("✓") ? "#22c55e" : sentryStatus.startsWith("✗") ? "#ef4444" : "#aaa" }}>{sentryStatus}</p>}
        </section>
      </div>
    </div>
  );
}
