"use client";

import { useEffect, useState } from "react";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

interface BudgetData {
  totalEstimated: number;
  totalItems: number;
  costPerItem: number;
  byProvider: { provider: string; count: number; estimatedCost: number }[];
  monthly: { month: string; count: number; cost: number }[];
}

const cardStyle: React.CSSProperties = {
  background: ds.color.card,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.md,
  padding: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: ds.font.mono,
  fontWeight: 700,
  color: ds.color.mute,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 6,
};

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/budget")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <p style={{ color: ds.color.mute, textAlign: "center", padding: "48px 0", fontFamily: ds.font.mono, fontSize: 12 }}>
      Loading budget data…
    </p>
  );
  if (!data) return (
    <p style={{ color: "#ef4444", textAlign: "center", padding: "48px 0", fontFamily: ds.font.sans, fontSize: 13 }}>
      Failed to load budget data.
    </p>
  );

  return (
    <div style={{ maxWidth: 860, fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Cost Tracking" title="Budget" italic="Overview" sub="Generation costs and provider usage at a glance" />

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={cardStyle}>
          <p style={labelStyle}>Estimated Total Spend</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: ds.color.ink, margin: "4px 0 2px", fontFamily: ds.font.mono }}>${data.totalEstimated.toFixed(2)}</p>
          <p style={{ fontSize: 10, color: ds.color.mute2 }}>Based on per-use estimates</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>Total Items</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: ds.color.lilac, margin: "4px 0 2px", fontFamily: ds.font.mono }}>{data.totalItems}</p>
        </div>
        <div style={cardStyle}>
          <p style={labelStyle}>Avg Cost / Item</p>
          <p style={{ fontSize: 26, fontWeight: 900, color: ds.color.magenta, margin: "4px 0 2px", fontFamily: ds.font.mono }}>${data.costPerItem.toFixed(2)}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Provider breakdown */}
        <div style={cardStyle}>
          <p style={{ ...labelStyle, color: ds.color.lilac, marginBottom: 12 }}>Cost by Provider</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.byProvider.map(p => (
              <div key={p.provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: p.estimatedCost > 0 ? ds.color.gold : ds.color.mint,
                    display: "inline-block", flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: ds.color.ink2 }}>{p.provider}</span>
                  <span style={{ fontSize: 10, color: ds.color.mute2, fontFamily: ds.font.mono }}>({p.count} uses)</span>
                </div>
                <span style={{ fontSize: 12, fontFamily: ds.font.mono, color: p.estimatedCost > 0 ? ds.color.gold : ds.color.mint }}>
                  ${p.estimatedCost.toFixed(2)}
                </span>
              </div>
            ))}
            {data.byProvider.length === 0 && (
              <p style={{ fontSize: 12, color: ds.color.mute2, textAlign: "center", padding: "16px 0" }}>No provider data yet</p>
            )}
          </div>
        </div>

        {/* Monthly breakdown */}
        <div style={cardStyle}>
          <p style={{ ...labelStyle, color: ds.color.lilac, marginBottom: 12 }}>Monthly Spend</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.monthly.map(m => {
              const maxCost = Math.max(1, ...data.monthly.map(x => x.cost));
              const pct = (m.cost / maxCost) * 100;
              return (
                <div key={m.month}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: ds.color.mute }}>{m.month}</span>
                    <span style={{ fontSize: 11, color: ds.color.ink2, fontFamily: ds.font.mono }}>${m.cost.toFixed(2)} ({m.count} items)</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: ds.color.paper, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: `linear-gradient(90deg,${ds.color.btnA},${ds.color.btnB})`,
                      borderRadius: 999,
                      width: `${pct}%`,
                    }} />
                  </div>
                </div>
              );
            })}
            {data.monthly.length === 0 && (
              <p style={{ fontSize: 12, color: ds.color.mute2, textAlign: "center", padding: "16px 0" }}>No monthly data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Cost savings note */}
      <div style={cardStyle}>
        <p style={{ ...labelStyle, color: ds.color.lilac, marginBottom: 6 }}>Cost Savings</p>
        <p style={{ fontSize: 12, color: ds.color.mute }}>
          Free providers used:{" "}
          <span style={{ color: ds.color.mint, fontWeight: 700, fontFamily: ds.font.mono }}>
            {data.byProvider.filter(p => p.estimatedCost === 0).length}
          </span>{" "}
          providers at $0. Piper TTS and mock providers save you money every render.
        </p>
      </div>
    </div>
  );
}
