"use client";
// /dashboard/account — Live account panel: API connections, balances, local usage, media counts

import { useEffect, useState, useCallback } from "react";
import { ds } from "../../../lib/designSystem";

// ── v14 tokens ──────────────────────────────────────────────────────────────
const bg     = ds.color.paper;
const s1     = ds.color.wallet;
const s2     = ds.color.card;
const border = ds.color.line;
const muted  = ds.color.mute;
const accent = ds.color.sky;
const purple = ds.color.lilac;
const gold   = ds.color.gold;
const green  = ds.color.mint;
const red    = ds.color.coral;

interface ProviderStatus {
  id: string;
  name: string;
  dashboardUrl: string;
  configured: boolean;
  reachable: boolean;
  balance: string | null;
  error?: string;
  models: string[];
  color: string;
  note?: string;
}

interface UsageStat {
  provider: string;
  count: number;
  estimatedCost: number;
}

interface MediaCounts {
  images: number;
  videos: number;
  merged: number;
  music: number;
  thumbnails: number;
}

interface StatusData {
  providers: ProviderStatus[];
  localUsage: UsageStat[];
  mediaCounts: MediaCounts;
  totalEstimatedSpend: number;
  checkedAt: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 9, height: 9, borderRadius: "50%",
      background: ok ? green : red,
      boxShadow: ok ? `0 0 6px ${green}88` : `0 0 6px ${red}88`,
      flexShrink: 0,
    }} />
  );
}

function ProviderCard({ p }: { p: ProviderStatus }) {
  // Abbrev for icon tile
  const abbr = p.name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      background: s2, border: `1px solid ${p.configured && p.reachable ? p.color + "35" : border}`,
      borderRadius: ds.radius.md, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10,
      opacity: p.configured ? 1 : 0.55,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: ds.radius.sm,
            background: p.configured && p.reachable ? `${p.color}22` : ds.color.alert,
            border: `1px solid ${p.configured && p.reachable ? p.color + "40" : border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: ds.font.mono, fontSize: 11, fontWeight: 700,
            color: p.configured && p.reachable ? p.color : muted,
          }}>
            {abbr}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: ds.color.ink, margin: 0 }}>{p.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <StatusDot ok={p.configured && p.reachable} />
              <span style={{ fontSize: 11, color: muted }}>
                {!p.configured ? "No API key" : p.reachable ? "Connected" : p.error || "Unreachable"}
              </span>
            </div>
          </div>
        </div>
        <a href={p.dashboardUrl} target="_blank" rel="noreferrer"
          style={{ fontSize: 10, color: p.color, textDecoration: "none", padding: "4px 10px", borderRadius: ds.radius.xs, border: `1px solid ${p.color}40`, whiteSpace: "nowrap" }}>
          Open Dashboard
        </a>
      </div>

      {/* Balance */}
      <div style={{ background: s1, borderRadius: ds.radius.xs, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: muted }}>Balance / Status</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: p.balance ? p.color : muted }}>
          {p.balance ?? (p.configured ? "See dashboard" : "—")}
        </span>
      </div>

      {/* Models */}
      <div>
        <p style={{ fontSize: 10, color: muted, marginBottom: 5 }}>Models available</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {p.models.map(m => (
            <span key={m} style={{ fontSize: 10, padding: "2px 7px", borderRadius: ds.radius.xs, background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}25` }}>
              {m}
            </span>
          ))}
        </div>
      </div>

      {p.note && (
        <p style={{ fontSize: 10, color: gold, borderTop: `1px solid ${border}`, paddingTop: 8, margin: 0 }}>
          {p.note}
        </p>
      )}
    </div>
  );
}

export default function AccountPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/status");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const connectedCount = data?.providers.filter(p => p.configured && p.reachable).length ?? 0;
  const configuredCount = data?.providers.filter(p => p.configured).length ?? 0;

  return (
    <div style={{ background: bg, color: ds.color.ink, padding: "0 0 40px", fontFamily: ds.font.sans }}>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: purple, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: ds.font.mono, marginBottom: 4 }}>
            Dashboard
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: ds.color.ink, letterSpacing: "-0.03em", margin: 0 }}>Account Panel</h1>
              <p style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                Live status of all connected AI providers
                {lastRefresh && <> · Last updated {lastRefresh.toLocaleTimeString()}</>}
              </p>
            </div>
            <button onClick={load} disabled={loading}
              style={{ padding: "9px 18px", borderRadius: ds.radius.sm, border: `1px solid ${border}`, background: loading ? s2 : s1, color: loading ? muted : ds.color.ink, fontSize: 12, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: ds.font.sans }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Summary cards row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Providers Connected", value: loading ? "—" : `${connectedCount} / ${data?.providers.length ?? 0}`, color: green },
            { label: "Keys Configured",     value: loading ? "—" : `${configuredCount}`,                                color: accent },
            { label: "Est. Total Spent",    value: loading ? "—" : `$${data?.totalEstimatedSpend.toFixed(2) ?? "0.00"}`, color: gold  },
            { label: "Media Files",         value: loading ? "—" : `${(data?.mediaCounts.images ?? 0) + (data?.mediaCounts.videos ?? 0) + (data?.mediaCounts.merged ?? 0)}`, color: purple },
          ].map(s => (
            <div key={s.label} style={{ background: s2, border: `1px solid ${border}`, borderRadius: ds.radius.md, padding: "16px 18px" }}>
              <p style={{ fontSize: 11, color: muted, marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0, fontFamily: ds.font.mono }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Provider cards grid */}
        <h2 style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 14, fontFamily: ds.font.mono }}>Provider Accounts</h2>
        {loading && !data ? (
          <div style={{ padding: 40, textAlign: "center", color: muted }}>Checking connections...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, marginBottom: 32 }}>
            {data?.providers.map(p => <ProviderCard key={p.id} p={p} />)}
          </div>
        )}

        {/* Local usage breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
          {/* Usage by provider */}
          <div style={{ background: s2, border: `1px solid ${border}`, borderRadius: ds.radius.md, padding: "18px 20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, margin: "0 0 14px" }}>Local Usage Estimate</h3>
            <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Based on generated assets in your library. Estimates only.</p>
            {data?.localUsage.length === 0 && (
              <p style={{ fontSize: 12, color: muted }}>No tracked generations yet.</p>
            )}
            {data?.localUsage.map(u => (
              <div key={u.provider} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${border}` }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ds.color.ink, textTransform: "capitalize" }}>{u.provider}</span>
                  <span style={{ fontSize: 10, color: muted, marginLeft: 8 }}>{u.count} generation{u.count !== 1 ? "s" : ""}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: gold, fontFamily: ds.font.mono }}>~${u.estimatedCost.toFixed(2)}</span>
              </div>
            ))}
            {(data?.localUsage.length ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: muted }}>Total Estimated</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: gold, fontFamily: ds.font.mono }}>${data?.totalEstimatedSpend.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Media file counts */}
          <div style={{ background: s2, border: `1px solid ${border}`, borderRadius: ds.radius.md, padding: "18px 20px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, margin: "0 0 14px" }}>Storage Media Files</h3>
            <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Files on disk in your storage folder.</p>
            {[
              { label: "Scene Images",      value: data?.mediaCounts.images ?? 0,     abbr: "IMG", color: accent },
              { label: "Scene Videos",      value: data?.mediaCounts.videos ?? 0,     abbr: "VID", color: purple },
              { label: "Merged/Rendered",   value: data?.mediaCounts.merged ?? 0,     abbr: "MRG", color: gold  },
              { label: "Music Tracks",      value: data?.mediaCounts.music ?? 0,      abbr: "MUS", color: green },
              { label: "Thumbnails Cached", value: data?.mediaCounts.thumbnails ?? 0, abbr: "THB", color: muted },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: ds.font.mono, fontSize: 9, fontWeight: 700, color: item.color }}>{item.abbr}</span>
                  <span style={{ fontSize: 12, color: muted }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: ds.font.mono }}>{loading ? "—" : item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model & Provider Map */}
        <h2 style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 14, fontFamily: ds.font.mono }}>Model & Provider Map</h2>
        <div style={{ background: s2, border: `1px solid ${border}`, borderRadius: ds.radius.md, padding: "18px 20px", marginBottom: 24, overflowX: "auto" }}>
          <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Every model in GioHomeStudio, which provider handles it, the cost per 5s clip, and what it is best for.</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                {["Model", "Name", "Primary Provider", "Fallback", "Cost / 5s", "Best For"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 12px", color: muted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", fontFamily: ds.font.mono }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: "wan25",         name: "Wan 2.5",          primary: "FAL",       fallback: "—",   cost: "$0.25",  best: "Budget animation, drafts",       color: ds.color.blue    },
                { id: "wan25-pro",     name: "Wan 2.5 Pro",      primary: "FAL",       fallback: "—",   cost: "$0.35",  best: "Balanced quality / cost",         color: ds.color.blue    },
                { id: "kling2",        name: "Kling 2.1",        primary: "KIE",       fallback: "FAL", cost: "$0.125", best: "Standard, affordable",            color: ds.color.gold    },
                { id: "kling25-turbo", name: "Kling 2.5 Turbo",  primary: "FAL",       fallback: "—",   cost: "$0.35",  best: "Fast music videos",               color: ds.color.gold    },
                { id: "kling3-pro",    name: "Kling 3.0 Pro",    primary: "FAL",       fallback: "KIE", cost: "$0.50",  best: "Cinematic, realistic humans",     color: ds.color.gold    },
                { id: "kling-direct",  name: "Kling Direct",     primary: "Kling API", fallback: "—",   cost: "$0.20",  best: "Direct Kling API",                color: ds.color.gold    },
                { id: "seedance",      name: "SeeDance 2.0",     primary: "MuAPI",     fallback: "FAL", cost: "$0.20",  best: "Dance, motion, native audio",     color: ds.color.mint    },
                { id: "hailuo-fast",   name: "Hailuo 2.3 Fast",  primary: "FAL",       fallback: "—",   cost: "$0.28",  best: "Quick previews",                  color: ds.color.blue    },
                { id: "hailuo-pro",    name: "Hailuo 2.3 Pro",   primary: "FAL",       fallback: "—",   cost: "$0.49",  best: "High-res visuals",                color: ds.color.blue    },
                { id: "runway",        name: "Runway Gen-3",     primary: "Runway",    fallback: "—",   cost: "$0.25",  best: "Smooth motion, transitions",      color: ds.color.lilac   },
              ].map((row, i) => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${border}`, background: i % 2 === 0 ? "transparent" : `${s1}80` }}>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: ds.radius.xs, background: `${row.color}18`, color: row.color, border: `1px solid ${row.color}25`, fontFamily: ds.font.mono }}>{row.id}</span>
                  </td>
                  <td style={{ padding: "9px 12px", color: ds.color.ink, fontWeight: 600 }}>{row.name}</td>
                  <td style={{ padding: "9px 12px", color: row.color, fontWeight: 700 }}>{row.primary}</td>
                  <td style={{ padding: "9px 12px", color: muted }}>{row.fallback}</td>
                  <td style={{ padding: "9px 12px", color: gold, fontWeight: 700, fontFamily: ds.font.mono }}>{row.cost}</td>
                  <td style={{ padding: "9px 12px", color: muted, fontSize: 11 }}>{row.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Important notes */}
        <div style={{ background: `${gold}0a`, border: `1px solid ${gold}25`, borderRadius: ds.radius.md, padding: "14px 18px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: gold, margin: "0 0 6px" }}>About Live Balances</p>
          <p style={{ fontSize: 11, color: muted, margin: 0, lineHeight: 1.6 }}>
            FAL, MuAPI, and Segmind do not expose live balance via their public APIs — open their dashboards directly for real-time balance.
            Kling Direct shows credits when available. Estimated spend is calculated from your local asset library at approximate per-generation costs and is not billing-accurate.
          </p>
        </div>
      </div>
    </div>
  );
}
