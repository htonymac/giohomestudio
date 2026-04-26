"use client";

import { useEffect, useState } from "react";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

interface ABVariant {
  id: string;
  label: string;
  title: string | null;
  caption: string | null;
  views: number;
  clicks: number;
  engagement: number;
  isWinner: boolean;
  platform: string | null;
  postUrl: string | null;
}

interface ABTest {
  id: string;
  name: string;
  contentItemId: string;
  status: string;
  winnerVariantId: string | null;
  createdAt: string;
  variants: ABVariant[];
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: ds.color.paper,
  border: `1px solid ${ds.color.line}`,
  borderRadius: ds.radius.sm,
  padding: "10px 12px",
  color: ds.color.ink,
  fontSize: 13,
  outline: "none",
  fontFamily: ds.font.sans,
  boxSizing: "border-box",
};

export default function ABTestingPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", contentItemId: "", variantA: { title: "", caption: "" }, variantB: { title: "", caption: "" } });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/ab-test");
    const data = await res.json();
    setTests(data.tests ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.name || !form.contentItemId) return;
    await fetch("/api/ab-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        contentItemId: form.contentItemId,
        variants: [
          { label: "A", title: form.variantA.title || undefined, caption: form.variantA.caption || undefined },
          { label: "B", title: form.variantB.title || undefined, caption: form.variantB.caption || undefined },
        ],
      }),
    });
    setShowCreate(false);
    setForm({ name: "", contentItemId: "", variantA: { title: "", caption: "" }, variantB: { title: "", caption: "" } });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this A/B test?")) return;
    await fetch(`/api/ab-test/${id}`, { method: "DELETE" });
    load();
  }

  async function declareWinner(testId: string, variantId: string) {
    await fetch(`/api/ab-test/${testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", winnerVariantId: variantId, variantId, isWinner: true }),
    });
    load();
  }

  const cardStyle: React.CSSProperties = {
    background: ds.color.card,
    border: `1px solid ${ds.color.line}`,
    borderRadius: ds.radius.lg,
    padding: 20,
  };

  const statusColor = (status: string) => {
    if (status === "completed") return ds.color.mint;
    if (status === "paused") return ds.color.gold;
    return ds.color.sky;
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: ds.font.sans }}>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <HeroTitle
          kicker="Optimization"
          title="A/B"
          italic="Testing"
          sub="Test different titles, captions, and thumbnails to find what performs best."
        />
        <button
          onClick={() => setShowCreate(true)}
          style={{
            marginTop: 24, padding: "10px 18px", borderRadius: ds.radius.md, border: "none", cursor: "pointer",
            background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
            color: "#fff", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
          }}>
          + New Test
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: ds.color.ink, marginBottom: 16 }}>Create A/B Test</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Test name (e.g. Homepage reel — title test)"
              style={inputStyle}
            />
            <input
              value={form.contentItemId}
              onChange={e => setForm(f => ({ ...f, contentItemId: e.target.value }))}
              placeholder="Content Item ID (from registry)"
              style={{ ...inputStyle, fontFamily: ds.font.mono }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.lilac, fontFamily: ds.font.mono, letterSpacing: "0.1em", textTransform: "uppercase" }}>Variant A</p>
                <input
                  value={form.variantA.title}
                  onChange={e => setForm(f => ({ ...f, variantA: { ...f.variantA, title: e.target.value } }))}
                  placeholder="Title A"
                  style={inputStyle}
                />
                <textarea
                  value={form.variantA.caption}
                  onChange={e => setForm(f => ({ ...f, variantA: { ...f.variantA, caption: e.target.value } }))}
                  placeholder="Caption A"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.gold, fontFamily: ds.font.mono, letterSpacing: "0.1em", textTransform: "uppercase" }}>Variant B</p>
                <input
                  value={form.variantB.title}
                  onChange={e => setForm(f => ({ ...f, variantB: { ...f.variantB, title: e.target.value } }))}
                  placeholder="Title B"
                  style={inputStyle}
                />
                <textarea
                  value={form.variantB.caption}
                  onChange={e => setForm(f => ({ ...f, variantB: { ...f.variantB, caption: e.target.value } }))}
                  placeholder="Caption B"
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleCreate}
                style={{ padding: "10px 18px", borderRadius: ds.radius.sm, border: "none", background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Create Test
              </button>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: "10px 18px", borderRadius: ds.radius.sm, border: `1px solid ${ds.color.line}`, background: "transparent", color: ds.color.mute, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ color: ds.color.mute, textAlign: "center", padding: "32px 0" }}>Loading...</p>}

      {!loading && tests.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", border: `1px dashed ${ds.color.line2}`, borderRadius: ds.radius.lg }}>
          <p style={{ color: ds.color.mute }}>No A/B tests yet. Create one to start testing.</p>
        </div>
      )}

      {/* Test list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tests.map(test => (
          <div key={test.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: ds.color.ink, marginBottom: 2 }}>{test.name}</h3>
                <p style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>
                  {test.status === "completed" ? "Completed" : test.status === "paused" ? "Paused" : "Active"}
                  {" · "}{test.variants.length} variants · Created {new Date(test.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontSize: 9, padding: "3px 10px", borderRadius: 100, fontWeight: 700,
                  background: `${statusColor(test.status)}18`, color: statusColor(test.status),
                  border: `1px solid ${statusColor(test.status)}30`, fontFamily: ds.font.mono, textTransform: "uppercase",
                }}>{test.status}</span>
                <button
                  onClick={() => handleDelete(test.id)}
                  style={{ fontSize: 10, color: "#ef444480", background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Variants */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {test.variants.map(v => {
                const totalVariantViews = Math.max(1, test.variants.reduce((a, x) => a + x.views, 0));
                const viewShare = ((v.views / totalVariantViews) * 100).toFixed(0);
                const varColor = v.label === "A" ? ds.color.lilac : ds.color.gold;
                return (
                  <div key={v.id} style={{
                    borderRadius: ds.radius.sm, padding: 14,
                    border: `1px solid ${v.isWinner ? "rgba(122,224,195,0.4)" : ds.color.line}`,
                    background: v.isWinner ? "rgba(122,224,195,0.06)" : ds.color.paper,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: varColor, fontFamily: ds.font.mono }}>Variant {v.label}</span>
                      {v.isWinner && (
                        <span style={{ fontSize: 9, background: "rgba(122,224,195,0.15)", color: ds.color.mint, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>Winner</span>
                      )}
                    </div>
                    {v.title && <p style={{ fontSize: 12, color: ds.color.ink, marginBottom: 4, fontWeight: 500 }}>{v.title}</p>}
                    {v.caption && <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 10, lineHeight: 1.5 }}>{v.caption}</p>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 900, color: ds.color.ink, fontFamily: ds.font.sans }}>{v.views}</p>
                        <p style={{ fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase" }}>Views</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 900, color: ds.color.ink }}>{v.clicks}</p>
                        <p style={{ fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase" }}>Clicks</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 900, color: ds.color.ink }}>{v.engagement.toFixed(1)}%</p>
                        <p style={{ fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase" }}>Engage</p>
                      </div>
                    </div>
                    <div style={{ width: "100%", height: 4, background: ds.color.line, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: varColor, width: `${viewShare}%` }} />
                    </div>
                    {test.status === "active" && !v.isWinner && (
                      <button
                        onClick={() => declareWinner(test.id, v.id)}
                        style={{ width: "100%", padding: "6px 0", borderRadius: 6, fontSize: 10, background: "rgba(122,224,195,0.1)", color: ds.color.mint, border: `1px solid rgba(122,224,195,0.3)`, cursor: "pointer", fontWeight: 600 }}>
                        Declare Winner
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
