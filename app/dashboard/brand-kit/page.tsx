"use client";

// Brand Kit editor — one saved text style (font + colours + sizes) that every
// editor and the outro pull from, so brand text is consistent everywhere.
// Henry 2026-07-17: "make writing, font and text colour one file callable via API."

import { useState, useEffect } from "react";
import { ds } from "../../../lib/designSystem";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { HeroTitle } from "../../components/hero/HeroTitle";

interface BrandKit {
  fontFamily: string;
  headlineColor: string;
  bodyColor: string;
  accentColor: string;
  headlineSize: number;
  bodySize: number;
  bold: boolean;
  outline: boolean;
  headlineText: string;
  sublineText: string;
  accentText: string;
}

const FONTS = [
  { group: "Modern (social)", opts: ["Poppins", "Montserrat", "Bebas Neue", "Anton"] },
  { group: "Classic", opts: ["Arial", "Georgia", "Impact", "Verdana", "Trebuchet MS"] },
];

const label: React.CSSProperties = {
  fontSize: 10, fontFamily: ds.font.mono, fontWeight: 700, letterSpacing: "0.16em",
  textTransform: "uppercase", color: ds.color.mute, display: "block", marginBottom: 6,
};
const inputSt: React.CSSProperties = {
  background: ds.color.card, color: ds.color.ink, border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm, padding: "9px 12px", fontSize: 13, width: "100%",
};

export default function BrandKitPage() {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/brand-kit").then(r => r.json()).then(d => setKit(d.brandKit)).catch(() => setMsg("Could not load brand kit"));
  }, []);

  function set<K extends keyof BrandKit>(k: K, v: BrandKit[K]) {
    setKit(prev => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!kit) return;
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/brand-kit", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kit),
      });
      const d = await res.json();
      if (res.ok) { setKit(d.brandKit); setMsg("Brand kit saved — every editor + outro now uses it."); }
      else setMsg(d.error || "Save failed");
    } catch { setMsg("Network error"); }
    setSaving(false);
  }

  if (!kit) return <div style={{ padding: 40, color: ds.color.mute }}>Loading brand kit…</div>;

  const previewFont =
    kit.fontFamily === "Bebas Neue" ? "'Bebas Neue', Impact, sans-serif" :
    kit.fontFamily === "Anton" ? "Anton, Impact, sans-serif" :
    `${kit.fontFamily}, Arial, sans-serif`;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px", color: ds.color.ink, fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Studio / Brand" title="Brand" italic="Kit" sub="One saved text style — font, colours, sizes — used across every editor and your video outros." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <Card radius={12} padding={20}>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Headline text</label>
            <input type="text" maxLength={120} value={kit.headlineText} onChange={e => set("headlineText", e.target.value)} style={inputSt} placeholder="Call Now 0902 000 0000" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Sub-text</label>
            <input type="text" maxLength={120} value={kit.sublineText} onChange={e => set("sublineText", e.target.value)} style={inputSt} placeholder="Location . Location . Location" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Accent / price</label>
            <input type="text" maxLength={120} value={kit.accentText} onChange={e => set("accentText", e.target.value)} style={inputSt} placeholder="₦0 / night" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={label}>Font</label>
            <select value={kit.fontFamily} onChange={e => set("fontFamily", e.target.value)} style={inputSt}>
              {FONTS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.opts.map(f => <option key={f} value={f}>{f}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {([["headlineColor", "Headline"], ["bodyColor", "Sub-text"], ["accentColor", "Accent"]] as const).map(([k, l]) => (
              <div key={k}>
                <label style={label}>{l}</label>
                <input type="color" value={kit[k]} onChange={e => set(k, e.target.value)}
                  style={{ width: "100%", height: 38, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, background: ds.color.card, cursor: "pointer" }} />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={label}>Headline size</label>
              <input type="number" min={12} max={200} value={kit.headlineSize} onChange={e => set("headlineSize", Number(e.target.value))} style={inputSt} />
            </div>
            <div>
              <label style={label}>Sub-text size</label>
              <input type="number" min={10} max={160} value={kit.bodySize} onChange={e => set("bodySize", Number(e.target.value))} style={inputSt} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ds.color.ink2, cursor: "pointer" }}>
              <input type="checkbox" checked={kit.bold} onChange={e => set("bold", e.target.checked)} /> Bold
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ds.color.ink2, cursor: "pointer" }}>
              <input type="checkbox" checked={kit.outline} onChange={e => set("outline", e.target.checked)} /> Outline
            </label>
          </div>

          {msg && <p style={{ fontSize: 12, color: msg.includes("saved") ? ds.color.mint : ds.color.coral, marginBottom: 10 }}>{msg}</p>}
          <ButtonPrimary onClick={save} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Brand Kit"}
          </ButtonPrimary>
        </Card>

        {/* Live preview */}
        <Card radius={12} padding={0} style={{ overflow: "hidden" }}>
          <div style={{ background: "#111", padding: "30px 18px", minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
            <span style={{
              fontFamily: previewFont, fontWeight: kit.bold ? 800 : 500, color: kit.headlineColor,
              fontSize: Math.min(46, kit.headlineSize * 0.55), lineHeight: 1.1,
              WebkitTextStroke: kit.outline ? "1px rgba(0,0,0,0.85)" : undefined,
              maxWidth: "100%", overflowWrap: "break-word",
            }}>{kit.headlineText}</span>
            <span style={{ fontFamily: previewFont, fontWeight: kit.bold ? 700 : 400, color: kit.bodyColor, fontSize: Math.min(28, kit.bodySize * 0.6), maxWidth: "100%", overflowWrap: "break-word" }}>
              {kit.sublineText}
            </span>
            <span style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "#000", background: kit.accentColor, padding: "5px 12px", borderRadius: 6, maxWidth: "100%", overflowWrap: "break-word" }}>
              {kit.accentText}
            </span>
          </div>
          <p style={{ fontSize: 10, color: ds.color.mute2, padding: "10px 14px", fontFamily: ds.font.mono }}>
            Preview approximates the burned result. The final video uses the exact font file.
          </p>
        </Card>
      </div>
    </div>
  );
}
