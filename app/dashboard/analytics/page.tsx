"use client";

import { useEffect, useState } from "react";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

interface Analytics {
  summary: {
    totalCount: number;
    commercialCount: number;
    freeCount: number;
    successCount: number;
    failedCount: number;
    successRate: number;
    avgDurationSec: number;
  };
  byStatus: { status: string; count: number }[];
  byMode: { mode: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  daily: { date: string; total: number; success: number; failed: number }[];
  recentItems: { id: string; status: string; mode: string; createdAt: string; durationSeconds: number | null; videoProvider: string | null; voiceProvider: string | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  IN_REVIEW:        ds.color.gold,
  APPROVED:         ds.color.mint,
  FAILED:           "#ef4444",
  PENDING:          ds.color.mute2,
  PUBLISHED:        ds.color.sky,
  REJECTED:         "#dc2626",
  GENERATING_VIDEO: ds.color.magenta,
  GENERATING_VOICE: ds.color.lilac,
  GENERATING_MUSIC: ds.color.pink,
  MERGING:          ds.color.gold,
  ENHANCING:        ds.color.sky,
  ARCHIVED:         ds.color.mute2,
};

const cardStyle: React.CSSProperties = {
  background: ds.color.card,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.md,
  padding: 16,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700,
  color: ds.color.lilac, marginBottom: 12,
  fontFamily: ds.font.mono, textTransform: "uppercase",
  letterSpacing: "0.08em",
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 10, color: ds.color.mute, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: ds.font.mono, fontWeight: 700, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 900, color: color ?? ds.color.ink, margin: "0 0 2px", fontFamily: ds.font.mono }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: ds.color.mute2 }}>{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, colorFn }: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  colorFn?: (label: string) => string;
}) {
  const max = Math.max(1, ...data.map(d => (d[valueKey] as number) || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => {
        const label = String(d[labelKey] ?? "");
        const value = (d[valueKey] as number) || 0;
        const pct = (value / max) * 100;
        const color = colorFn?.(label) ?? ds.color.lilac;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: ds.color.mute, width: 112, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: ds.font.mono }}>{label}</span>
            <div style={{ flex: 1, height: 18, background: ds.color.paper, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 999, transition: "width 0.5s", width: `${pct}%`, background: color }} />
            </div>
            <span style={{ fontSize: 11, color: ds.color.ink, fontFamily: ds.font.mono, width: 28, textAlign: "right" }}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; total: number; success: number; failed: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.total));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
      {data.map((d, i) => {
        const h = (d.total / max) * 100;
        const successH = d.total > 0 ? (d.success / d.total) * h : 0;
        const failH = d.total > 0 ? (d.failed / d.total) * h : 0;
        const otherH = h - successH - failH;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
            title={`${d.date}: ${d.total} items (${d.success} ok, ${d.failed} failed)`}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", borderRadius: "3px 3px 0 0", overflow: "hidden", height: `${h}%`, minHeight: d.total > 0 ? 4 : 0 }}>
              {successH > 0 && <div style={{ flex: successH, background: ds.color.mint }} />}
              {otherH > 0 && <div style={{ flex: otherH, background: ds.color.lilac }} />}
              {failH > 0 && <div style={{ flex: failH, background: "#ef4444" }} />}
            </div>
            <span style={{ fontSize: 7, color: ds.color.mute2, transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap", fontFamily: ds.font.mono }}>
              {d.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <p style={{ color: ds.color.mute, textAlign: "center", padding: "48px 0", fontFamily: ds.font.mono, fontSize: 12 }}>
      Loading analytics…
    </p>
  );
  if (!data) return (
    <p style={{ color: "#ef4444", textAlign: "center", padding: "48px 0", fontFamily: ds.font.sans, fontSize: 13 }}>
      Failed to load analytics.
    </p>
  );

  const s = data.summary;

  return (
    <div style={{ maxWidth: 960, fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Performance" title="Analytics" italic="Dashboard" sub="Content performance and generation statistics" />

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <StatCard label="Total Items" value={s.totalCount} />
          <StatCard
            label="Success Rate"
            value={`${s.successRate}%`}
            color={s.successRate >= 70 ? ds.color.mint : s.successRate >= 40 ? ds.color.gold : "#ef4444"}
          />
          <StatCard label="Free Mode" value={s.freeCount} sub={`${s.commercialCount} commercial`} color={ds.color.sky} />
          <StatCard label="Avg Duration" value={`${s.avgDurationSec}s`} color={ds.color.magenta} />
        </div>

        {/* Daily activity inline */}
        {data.daily.length > 0 && (
          <div style={cardStyle}>
            <p style={sectionLabel}>Daily Activity (last 14 days)</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: ds.color.mint, display: "inline-block" }} /> Success
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: ds.color.lilac, display: "inline-block" }} /> In Progress
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} /> Failed
              </span>
            </div>
            <DailyChart data={data.daily} />
          </div>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <p style={sectionLabel}>Items by Status</p>
          <BarChart data={data.byStatus} labelKey="status" valueKey="count" colorFn={s => STATUS_COLORS[s] ?? ds.color.lilac} />
        </div>

        <div style={cardStyle}>
          <p style={sectionLabel}>Video Provider Usage</p>
          {data.byProvider.length > 0 ? (
            <BarChart data={data.byProvider} labelKey="provider" valueKey="count" />
          ) : (
            <p style={{ fontSize: 12, color: ds.color.mute2, textAlign: "center", padding: "24px 0" }}>No provider data yet</p>
          )}
        </div>
      </div>

      {/* Recent items */}
      <div style={cardStyle}>
        <p style={sectionLabel}>Recent Items</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {data.recentItems.slice(0, 15).map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${ds.color.line}` }}>
              <span style={{
                padding: "2px 6px", borderRadius: ds.radius.xs, fontSize: 9, fontWeight: 700,
                fontFamily: ds.font.mono,
                background: item.mode === "COMMERCIAL" ? `${ds.color.gold}20` : `${ds.color.sky}18`,
                color: item.mode === "COMMERCIAL" ? ds.color.gold : ds.color.sky,
              }}>
                {item.mode}
              </span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[item.status] ?? ds.color.mute2, display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: ds.color.mute, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{item.status}</span>
              <span style={{ color: ds.color.mute2, fontSize: 10, fontFamily: ds.font.mono }}>{item.videoProvider ?? "-"} / {item.voiceProvider ?? "-"}</span>
              <span style={{ color: ds.color.mute2, fontSize: 10, fontFamily: ds.font.mono, whiteSpace: "nowrap" }}>{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
