"use client";

import { useEffect, useState } from "react";

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
  IN_REVIEW: "#f59e0b",
  APPROVED: "#22c55e",
  FAILED: "#ef4444",
  PENDING: "#6b7280",
  PUBLISHED: "#14b8a6",
  REJECTED: "#dc2626",
  GENERATING_VIDEO: "#a855f7",
  GENERATING_VOICE: "#6366f1",
  GENERATING_MUSIC: "#ec4899",
  MERGING: "#eab308",
  ENHANCING: "#3b82f6",
  ARCHIVED: "#4b5563",
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
      <p className="text-[10px] text-[#6060a0] uppercase tracking-wider font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color ?? "#fff" }}>{value}</p>
      {sub && <p className="text-[10px] text-[#4040600] mt-0.5">{sub}</p>}
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
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const label = String(d[labelKey] ?? "");
        const value = (d[valueKey] as number) || 0;
        const pct = (value / max) * 100;
        const color = colorFn?.(label) ?? "#7c5cfc";
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-[#6060a0] w-28 truncate text-right">{label}</span>
            <div className="flex-1 h-5 bg-[#1a1a2e] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[11px] text-white font-mono w-8 text-right">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; total: number; success: number; failed: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.total));
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => {
        const h = (d.total / max) * 100;
        const successH = d.total > 0 ? (d.success / d.total) * h : 0;
        const failH = d.total > 0 ? (d.failed / d.total) * h : 0;
        const otherH = h - successH - failH;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.total} items (${d.success} ok, ${d.failed} failed)`}>
            <div className="w-full flex flex-col rounded-t overflow-hidden" style={{ height: `${h}%`, minHeight: d.total > 0 ? 4 : 0 }}>
              {successH > 0 && <div style={{ flex: successH, background: "#22c55e" }} />}
              {otherH > 0 && <div style={{ flex: otherH, background: "#7c5cfc" }} />}
              {failH > 0 && <div style={{ flex: failH, background: "#ef4444" }} />}
            </div>
            <span className="text-[8px] text-[#4040600] rotate-[-45deg] origin-center whitespace-nowrap">
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

  if (loading) return <p className="text-[#6060a0] text-center py-12">Loading analytics...</p>;
  if (!data) return <p className="text-red-400 text-center py-12">Failed to load analytics.</p>;

  const s = data.summary;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Items" value={s.totalCount} />
        <StatCard label="Success Rate" value={`${s.successRate}%`} color={s.successRate >= 70 ? "#22c55e" : s.successRate >= 40 ? "#f59e0b" : "#ef4444"} />
        <StatCard label="Free Mode" value={s.freeCount} sub={`${s.commercialCount} commercial`} color="#6366f1" />
        <StatCard label="Avg Duration" value={`${s.avgDurationSec}s`} color="#a855f7" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* By Status */}
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#b090ff] mb-3">Items by Status</p>
          <BarChart
            data={data.byStatus}
            labelKey="status"
            valueKey="count"
            colorFn={s => STATUS_COLORS[s] ?? "#7c5cfc"}
          />
        </div>

        {/* By Provider */}
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#b090ff] mb-3">Video Provider Usage</p>
          {data.byProvider.length > 0 ? (
            <BarChart data={data.byProvider} labelKey="provider" valueKey="count" />
          ) : (
            <p className="text-[#404060] text-xs text-center py-6">No provider data yet</p>
          )}
        </div>
      </div>

      {/* Daily activity */}
      {data.daily.length > 0 && (
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-[#b090ff] mb-3">Daily Activity (last 14 days)</p>
          <div className="flex items-center gap-4 mb-2">
            <span className="flex items-center gap-1 text-[9px] text-[#6060a0]"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Success</span>
            <span className="flex items-center gap-1 text-[9px] text-[#6060a0]"><span className="w-2 h-2 rounded-full bg-[#7c5cfc] inline-block" /> In Progress</span>
            <span className="flex items-center gap-1 text-[9px] text-[#6060a0]"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Failed</span>
          </div>
          <DailyChart data={data.daily} />
        </div>
      )}

      {/* Recent items */}
      <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#b090ff] mb-3">Recent Items</p>
        <div className="space-y-1">
          {data.recentItems.slice(0, 15).map(item => (
            <div key={item.id} className="flex items-center gap-3 py-1.5 text-xs">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${item.mode === "COMMERCIAL" ? "bg-amber-900/40 text-amber-400" : "bg-indigo-900/40 text-indigo-400"}`}>
                {item.mode}
              </span>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[item.status] ?? "#6b7280" }} />
              <span className="text-gray-400 flex-1 truncate">{item.status}</span>
              <span className="text-gray-600">{item.videoProvider ?? "-"} / {item.voiceProvider ?? "-"}</span>
              <span className="text-gray-600 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
