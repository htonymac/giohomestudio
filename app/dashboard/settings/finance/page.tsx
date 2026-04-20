"use client";

import { useEffect, useMemo, useState } from "react";

// ── Design tokens (Dark Studio Precision) ─────────────────────────────
const BG = "#080810";
const SURFACE = "#13131f";
const SURFACE2 = "#18182a";
const SURFACE3 = "#1e1e30";
const BORDER = "rgba(255,255,255,0.06)";
const BORDER2 = "rgba(255,255,255,0.10)";
const TEXT = "#e8e8f4";
const TEXT2 = "#8888aa";
const TEXT3 = "#44445a";
const GOLD = "#d4a843";
const GOLD_SOFT = "rgba(212,168,67,0.08)";
const GOLD_GLOW = "rgba(212,168,67,0.15)";
const BLUE = "#3b82f6";
const GREEN = "#22d18a";
const RED = "#ff5757";
const PURPLE = "#8b5cf6";

// ── Credit math ─────────────────────────────────────────────────────
function credits(dollars: number) {
  return Math.round(dollars / 0.001);
}
function markupForType(type: string) {
  return type === "video" ? 2 : 3;
}

// ── Types ───────────────────────────────────────────────────────────
interface Model {
  id: string;
  display_name: string;
  provider_name: string;
  model_manufacturer: string;
  type: "image" | "image_edit" | "video";
  quality_tier: string;
  cost_to_henry: number;
  price_to_user: number;
  unit: string;
  resolution: string;
  is_active: boolean;
  has_override?: boolean;
  tags?: string[];
  best_for?: string;
}

interface Tier {
  id: "free" | "starter" | "pro" | "premium";
  name: string;
  monthlyPrice: number;
  monthlyCredits: number;
  enabledModels: string[];
  color: string;
}

interface ProviderSpend {
  count: number;
  estimatedCost: number;
}

interface BudgetData {
  providerCosts: Record<string, ProviderSpend>;
  totalEstimated: number;
  monthly?: Array<{ month: string; cost: number }>;
}

// ── Main page ───────────────────────────────────────────────────────
export default function FinancePage() {
  const [models, setModels] = useState<Model[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Filters
  const [filterProvider, setFilterProvider] = useState("");
  const [filterType, setFilterType] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  // Load data
  useEffect(() => {
    Promise.all([
      fetch("/api/settings/models").then(r => r.json()),
      fetch("/api/settings/tiers").then(r => r.json()),
      fetch("/api/budget").then(r => r.json()).catch(() => ({ providerCosts: {}, totalEstimated: 0 })),
    ]).then(([m, t, b]) => {
      setModels(m.models ?? []);
      setTiers(t.tiers ?? []);
      setBudget(b);
      setLoading(false);
    });
  }, []);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function saveModelPrice(modelId: string, field: "cost_to_henry" | "price_to_user", value: number) {
    const res = await fetch("/api/settings/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, [field]: value }),
    });
    if (res.ok) {
      setModels(prev => prev.map(m => (m.id === modelId ? { ...m, [field]: value, has_override: true } : m)));
      showToast("Saved");
    } else {
      showToast("Save failed", "err");
    }
  }

  async function saveTier(tier: Tier) {
    const res = await fetch("/api/settings/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    if (res.ok) {
      setTiers(prev => prev.map(t => (t.id === tier.id ? tier : t)));
      showToast(`${tier.name} saved`);
    } else {
      showToast("Save failed", "err");
    }
  }

  // Derived
  const providers = useMemo(() => Array.from(new Set(models.map(m => m.provider_name))).sort(), [models]);

  const filteredModels = useMemo(() => {
    return models.filter(m => {
      if (activeOnly && !m.is_active) return false;
      if (filterProvider && m.provider_name !== filterProvider) return false;
      if (filterType && m.type !== filterType) return false;
      return true;
    }).sort((a, b) => a.cost_to_henry - b.cost_to_henry);
  }, [models, filterProvider, filterType, activeOnly]);

  const spendThisMonth = budget?.totalEstimated ?? 0;
  const topProviders = useMemo(() => {
    if (!budget?.providerCosts) return [];
    return Object.entries(budget.providerCosts)
      .sort(([, a], [, b]) => b.estimatedCost - a.estimatedCost)
      .slice(0, 3);
  }, [budget]);

  const topModels = useMemo(() => {
    if (!budget?.providerCosts) return [];
    return Object.entries(budget.providerCosts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10);
  }, [budget]);

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: TEXT2, padding: 40, fontFamily: "'Space Grotesk', sans-serif" }}>
        Loading finance data…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Space Grotesk', -apple-system, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          background: toast.type === "ok" ? GREEN : RED, color: "#080810",
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 32px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div>
            <p className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: GOLD, textTransform: "uppercase", marginBottom: 6 }}>
              SETTINGS · FINANCE & GROWTH
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: "-0.01em" }}>
              GHS Financial Control Room
            </h1>
            <p style={{ fontSize: 13, color: TEXT2, marginTop: 6 }}>
              Hybrid pricing · 1 credit = $0.001 · Phase 1 (visibility only, no billing yet)
            </p>
          </div>
          <div className="mono" style={{ fontSize: 11, color: TEXT3 }}>
            {models.length} models · {tiers.length} tiers · {providers.length} providers
          </div>
        </div>

        {/* ── SECTION B: CURRENT SPEND ── */}
        <section style={{ marginBottom: 20 }}>
          <SectionHeader title="Current Spend" icon="💰" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <StatCard
              label="Henry API Spend (total)"
              value={`$${spendThisMonth.toFixed(2)}`}
              sub="estimated from /api/budget"
              accent={GOLD}
            />
            <StatCard
              label="Revenue"
              value="$0.00"
              sub="— billing not live yet (Phase 3)"
              accent={TEXT3}
            />
            <StatCard
              label="Profit Margin"
              value="—"
              sub="needs billing to compute"
              accent={TEXT3}
            />
            <StatCard
              label="Top Provider"
              value={topProviders[0]?.[0] ?? "—"}
              sub={topProviders[0] ? `$${topProviders[0][1].estimatedCost.toFixed(2)} · ${topProviders[0][1].count} calls` : "no data"}
              accent={BLUE}
            />
          </div>
        </section>

        {/* ── SECTION C: TIERS ── */}
        <section style={{ marginBottom: 20 }}>
          <SectionHeader title="Pricing Tiers" icon="🎟" sub="Edit monthly price and included credits. Model access is set per tier." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {tiers.map(tier => (
              <TierCard key={tier.id} tier={tier} models={models} onSave={saveTier} />
            ))}
          </div>
        </section>

        {/* ── SECTION A: PROVIDER TABLE ── */}
        <section style={{ marginBottom: 20 }}>
          <SectionHeader title="Provider Dashboard" icon="🗂" sub={`${filteredModels.length} of ${models.length} models`} />

          {/* Filters */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px", marginBottom: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: TEXT3, fontFamily: "'JetBrains Mono'", textTransform: "uppercase", letterSpacing: "0.1em" }}>Filter:</label>
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} style={selectStyle}>
              <option value="">All providers</option>
              {providers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
              <option value="">All types</option>
              <option value="image">image</option>
              <option value="image_edit">image_edit</option>
              <option value="video">video</option>
            </select>
            <label style={{ fontSize: 12, color: TEXT2, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} style={{ accentColor: GOLD }} />
              Active only
            </label>
          </div>

          {/* Table */}
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: SURFACE2 }}>
                    {["Provider", "Model", "Type", "Tier", "Henry Cost", "Markup", "User Price", "Credits", "Status"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map(m => {
                    const mk = markupForType(m.type);
                    const impliedUserPrice = m.cost_to_henry * mk;
                    return (
                      <tr key={m.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                        <td style={tdStyle}>
                          <span className="mono" style={{ fontSize: 10, color: TEXT2 }}>{m.provider_name}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 500, color: TEXT }}>{m.display_name}</div>
                          <div className="mono" style={{ fontSize: 9, color: TEXT3 }}>{m.id}</div>
                        </td>
                        <td style={tdStyle}>
                          <TypeBadge type={m.type} />
                        </td>
                        <td style={tdStyle}>
                          <QualityBadge tier={m.quality_tier} />
                        </td>
                        <td style={tdStyle}>
                          <EditableCell
                            value={m.cost_to_henry}
                            onSave={v => saveModelPrice(m.id, "cost_to_henry", v)}
                            prefix="$"
                          />
                        </td>
                        <td style={tdStyle}>
                          <span className="mono" style={{ fontSize: 11, color: TEXT3 }}>{mk}x</span>
                        </td>
                        <td style={tdStyle}>
                          <EditableCell
                            value={m.price_to_user}
                            onSave={v => saveModelPrice(m.id, "price_to_user", v)}
                            prefix="$"
                            hint={`default ${impliedUserPrice.toFixed(3)}`}
                          />
                        </td>
                        <td style={tdStyle}>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>
                            {credits(m.price_to_user)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <StatusDot active={m.is_active} overridden={m.has_override} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── SECTION D: GROWTH ── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader title="Growth Tracker" icon="📈" sub="Once billing is live, these will become real-time." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <p className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: TEXT3, textTransform: "uppercase", marginBottom: 14 }}>
                Users per tier
              </p>
              {tiers.map(t => (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: t.color, fontWeight: 600 }}>{t.name}</span>
                    <span className="mono" style={{ color: TEXT3 }}>0 users · $0 MRR</span>
                  </div>
                  <div style={{ height: 4, background: SURFACE3, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: "0%", background: t.color, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 10, color: TEXT3, marginTop: 12, fontStyle: "italic" }}>Waiting on Phase 3 billing to populate.</p>
            </div>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <p className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: TEXT3, textTransform: "uppercase", marginBottom: 14 }}>
                Top 10 most-used providers
              </p>
              {topModels.length === 0 ? (
                <p style={{ fontSize: 11, color: TEXT3, fontStyle: "italic" }}>No generation history yet.</p>
              ) : (
                topModels.map(([name, s], i) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                    <span><span style={{ color: TEXT3, marginRight: 8 }} className="mono">{String(i + 1).padStart(2, "0")}</span>{name}</span>
                    <span className="mono" style={{ color: GOLD }}>{s.count} calls · ${s.estimatedCost.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

          </div>
        </section>

        <div style={{ textAlign: "center", fontSize: 10, color: TEXT3, padding: "20px 0", borderTop: `1px solid ${BORDER}` }} className="mono">
          PHASE 1 / 5 · VISIBILITY COMPLETE · NEXT: CREDIT TRACKING + COST PREVIEW
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function SectionHeader({ title, icon, sub }: { title: string; icon: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{title}</h2>
      {sub && <span style={{ fontSize: 11, color: TEXT3 }}>· {sub}</span>}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <p className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: TEXT3, textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </p>
      <p className="mono" style={{ fontSize: 24, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: TEXT3, marginTop: 6 }}>{sub}</p>
    </div>
  );
}

function TierCard({ tier, models, onSave }: { tier: Tier; models: Model[]; onSave: (t: Tier) => void }) {
  const [draft, setDraft] = useState<Tier>(tier);
  const [open, setOpen] = useState(false);
  useEffect(() => { setDraft(tier); }, [tier]);

  const isPrimary = tier.id === "pro";
  const accent = tier.color;

  return (
    <div style={{
      background: isPrimary ? GOLD_SOFT : SURFACE,
      border: `1px solid ${isPrimary ? GOLD : BORDER}`,
      borderRadius: 12, padding: 18, position: "relative",
    }}>
      {isPrimary && (
        <span className="mono" style={{ position: "absolute", top: -9, right: 14, background: GOLD, color: "#080810", fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 999, letterSpacing: "0.1em" }}>
          MOST POPULAR
        </span>
      )}
      <p style={{ fontSize: 18, fontWeight: 700, color: accent, marginBottom: 2 }}>{tier.name}</p>
      <p className="mono" style={{ fontSize: 10, color: TEXT3, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>{tier.id}</p>

      <label style={labelStyle}>Monthly price (USD)</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span className="mono" style={{ color: TEXT3, fontSize: 14 }}>$</span>
        <input
          type="number" value={draft.monthlyPrice} min={0}
          onChange={e => setDraft({ ...draft, monthlyPrice: parseFloat(e.target.value) || 0 })}
          style={inputStyle}
        />
      </div>

      <label style={labelStyle}>Monthly credits included</label>
      <div style={{ marginBottom: 12 }}>
        <input
          type="number" value={draft.monthlyCredits} min={0} step={100}
          onChange={e => setDraft({ ...draft, monthlyCredits: parseInt(e.target.value) || 0 })}
          style={inputStyle}
        />
        <p className="mono" style={{ fontSize: 9, color: TEXT3, marginTop: 3 }}>
          ≈ ${(draft.monthlyCredits * 0.001).toFixed(2)} value
        </p>
      </div>

      <button onClick={() => setOpen(o => !o)} style={{ ...buttonStyle, background: SURFACE3, color: TEXT2, marginBottom: 8, fontSize: 10 }}>
        {open ? "hide" : "show"} model access ({draft.enabledModels.length})
      </button>

      {open && (
        <div style={{ maxHeight: 220, overflowY: "auto", background: SURFACE2, borderRadius: 6, padding: 6, marginBottom: 8 }}>
          {models.map(m => {
            const enabled = draft.enabledModels.includes(m.id);
            return (
              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: enabled ? TEXT : TEXT3, padding: "3px 4px", cursor: "pointer" }}>
                <input type="checkbox" checked={enabled} onChange={e => {
                  setDraft({ ...draft, enabledModels: e.target.checked ? [...draft.enabledModels, m.id] : draft.enabledModels.filter(x => x !== m.id) });
                }} style={{ accentColor: accent, flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.display_name}</span>
                <span className="mono" style={{ marginLeft: "auto", color: TEXT3, fontSize: 8 }}>{credits(m.price_to_user)}c</span>
              </label>
            );
          })}
        </div>
      )}

      <button
        onClick={() => onSave(draft)}
        disabled={JSON.stringify(draft) === JSON.stringify(tier)}
        style={{ ...buttonStyle, background: accent, color: "#080810", fontWeight: 700, width: "100%" }}
      >
        Save {tier.name}
      </button>
    </div>
  );
}

function EditableCell({ value, onSave, prefix, hint }: { value: number; onSave: (v: number) => void; prefix?: string; hint?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  if (editing) {
    return (
      <input
        type="number" value={draft} step={0.001} autoFocus
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseFloat(draft);
          if (!isNaN(v) && v !== value) onSave(v);
          setEditing(false);
        }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
        style={{
          width: 75, background: SURFACE2, border: `1px solid ${GOLD}`, borderRadius: 4,
          color: TEXT, padding: "3px 6px", fontSize: 11, fontFamily: "'JetBrains Mono'", outline: "none",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title={hint ? `Click to edit · ${hint}` : "Click to edit"}
      style={{
        cursor: "pointer", fontFamily: "'JetBrains Mono'", fontSize: 11, color: TEXT,
        borderBottom: `1px dashed ${TEXT3}`, padding: "1px 3px",
      }}
    >
      {prefix}{value.toFixed(3)}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { color: string; label: string }> = {
    image:      { color: BLUE,   label: "image" },
    image_edit: { color: PURPLE, label: "edit"  },
    video:      { color: GOLD,   label: "video" },
  };
  const c = map[type] ?? { color: TEXT3, label: type };
  return (
    <span className="mono" style={{
      display: "inline-block", fontSize: 9, fontWeight: 700, color: c.color,
      background: `${c.color}18`, border: `1px solid ${c.color}30`,
      padding: "2px 8px", borderRadius: 999, letterSpacing: "0.05em",
    }}>{c.label}</span>
  );
}

function QualityBadge({ tier }: { tier: string }) {
  return (
    <span className="mono" style={{ fontSize: 9, color: TEXT3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {tier}
    </span>
  );
}

function StatusDot({ active, overridden }: { active: boolean; overridden?: boolean }) {
  const color = !active ? RED : overridden ? PURPLE : GREEN;
  const label = !active ? "disabled" : overridden ? "overridden" : "active";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="mono" style={{ fontSize: 9, color: TEXT3 }}>{label}</span>
    </span>
  );
}

// ── Shared styles ──────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "10px 14px", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
  textTransform: "uppercase", color: TEXT3, textAlign: "left",
  borderBottom: `1px solid ${BORDER}`, fontFamily: "'JetBrains Mono'",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px", verticalAlign: "middle",
};

const selectStyle: React.CSSProperties = {
  background: SURFACE2, border: `1px solid ${BORDER2}`, color: TEXT,
  padding: "5px 10px", borderRadius: 6, fontSize: 11, outline: "none",
  fontFamily: "'Space Grotesk'",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
  color: TEXT3, textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono'",
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: SURFACE2, border: `1px solid ${BORDER2}`, color: TEXT,
  padding: "6px 10px", borderRadius: 6, fontSize: 13, outline: "none",
  fontFamily: "'JetBrains Mono'",
};

const buttonStyle: React.CSSProperties = {
  border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 11,
  fontFamily: "'Space Grotesk'", cursor: "pointer", fontWeight: 600,
};
