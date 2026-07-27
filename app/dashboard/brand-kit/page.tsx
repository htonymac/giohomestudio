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
  bgColor: string;
  bgOpacity: number;
  businessName: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
}

// "#RRGGBB" + 0..1 opacity -> "rgba(r,g,b,a)" for the live preview background.
function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
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

  // ── Logo watermark (the AnDio-style stamp burned onto videos) ──
  interface WmSettings { logoPath: string | null; position: string; scale: number; opacity: number; enabled: boolean }
  const [wm, setWm] = useState<WmSettings | null>(null);
  const [wmUploading, setWmUploading] = useState(false);
  const [wmSaving, setWmSaving] = useState(false);
  const [wmMsg, setWmMsg] = useState("");
  const wmLogoPreview = wm?.logoPath ? `/api/media/${wm.logoPath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}` : null;

  useEffect(() => {
    fetch("/api/brand-kit").then(r => r.json()).then(d => setKit(d.brandKit)).catch(() => setMsg("Could not load brand kit"));
    fetch("/api/watermark").then(r => r.json()).then(setWm).catch(() => { /* logo section optional */ });
  }, []);

  async function uploadWmLogo(file: File) {
    setWmUploading(true); setWmMsg("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const d = await res.json();
      if (res.ok && d.filePath) setWm(p => ({ ...(p ?? { position: "bottom-right", scale: 0.12, opacity: 0.9, enabled: false }), logoPath: d.filePath }));
      else setWmMsg(d.error || "Logo upload failed");
    } catch { setWmMsg("Logo upload failed"); }
    setWmUploading(false);
  }

  async function saveWm() {
    if (!wm) return;
    setWmSaving(true); setWmMsg("");
    try {
      const res = await fetch("/api/watermark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wm) });
      const d = await res.json();
      if (res.ok) { setWm(d); setWmMsg(d.enabled ? "Saved — new commercials will be auto-stamped with your logo." : "Saved — auto-stamp is OFF (you can still add the logo manually per video)."); }
      else setWmMsg(d.error || "Save failed");
    } catch { setWmMsg("Network error"); }
    setWmSaving(false);
  }

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
            <span style={{ display: "block", marginTop: 6, fontSize: 15, fontFamily: previewFont, color: ds.color.ink2 }}>
              AaBbCc 123 — Your headline
            </span>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div>
              <label style={label}>Background</label>
              <input type="color" value={kit.bgColor} onChange={e => set("bgColor", e.target.value)}
                style={{ width: "100%", height: 38, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.sm, background: ds.color.card, cursor: "pointer" }} />
            </div>
            <div>
              <label style={label}>Background opacity ({Math.round(kit.bgOpacity * 100)}%)</label>
              <input type="range" min={0} max={1} step={0.05} value={kit.bgOpacity}
                onChange={e => set("bgOpacity", Number(e.target.value))}
                style={{ width: "100%", marginTop: 9 }} />
            </div>
          </div>

          {msg && <p style={{ fontSize: 12, color: msg.includes("saved") ? ds.color.mint : ds.color.coral, marginBottom: 10 }}>{msg}</p>}
          <ButtonPrimary onClick={save} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Brand Kit"}
          </ButtonPrimary>
        </Card>

        {/* Live preview */}
        <Card radius={12} padding={0} style={{ overflow: "hidden" }}>
          <div style={{
            background: `linear-gradient(${hexToRgba(kit.bgColor, kit.bgOpacity)}, ${hexToRgba(kit.bgColor, kit.bgOpacity)}), #111`,
            padding: "30px 18px", minHeight: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center",
          }}>
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

      {/* Business / Contact — saved once here, callable anywhere (editors, outros) */}
      <Card radius={12} padding={20} style={{ marginTop: 20 }}>
        <label style={{ ...label, fontSize: 11, marginBottom: 14 }}>Business / Contact</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={label}>Business name</label>
            <input type="text" maxLength={120} value={kit.businessName} onChange={e => set("businessName", e.target.value)} style={inputSt} placeholder="Gio Home Studio" />
          </div>
          <div>
            <label style={label}>Phone</label>
            <input type="tel" maxLength={120} value={kit.phone} onChange={e => set("phone", e.target.value)} style={inputSt} placeholder="0902 000 0000" />
          </div>
          <div>
            <label style={label}>WhatsApp</label>
            <input type="tel" maxLength={120} value={kit.whatsapp} onChange={e => set("whatsapp", e.target.value)} style={inputSt} placeholder="0902 000 0000" />
          </div>
          <div>
            <label style={label}>Email</label>
            <input type="email" maxLength={120} value={kit.email} onChange={e => set("email", e.target.value)} style={inputSt} placeholder="hello@giohomestudio.com" />
          </div>
          <div>
            <label style={label}>Website</label>
            <input type="url" maxLength={120} value={kit.website} onChange={e => set("website", e.target.value)} style={inputSt} placeholder="https://giohomestudio.com" />
          </div>
          <div>
            <label style={label}>Address</label>
            <input type="text" maxLength={200} value={kit.address} onChange={e => set("address", e.target.value)} style={inputSt} placeholder="Street, City, State" />
          </div>
        </div>
        <p style={{ fontSize: 10, color: ds.color.mute2, marginTop: 12, fontFamily: ds.font.mono }}>
          Saved here once — insertable in editors and outros wherever contact info is needed.
        </p>
      </Card>

      {/* Logo watermark — the stamp burned onto videos */}
      <Card radius={12} padding={20} style={{ marginTop: 20 }}>
        <label style={{ ...label, fontSize: 11, marginBottom: 6 }}>Logo Watermark (Stamp)</label>
        <p style={{ fontSize: 11, color: ds.color.mute2, marginBottom: 14 }}>
          Upload your logo once. Turn on auto-stamp and every new commercial comes out with your logo in the corner (like an AI generator&apos;s badge). You can also add it manually on any finished video.
        </p>
        {wm ? (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <label style={{ ...inputSt, width: "auto", display: "inline-flex", alignItems: "center", gap: 8, cursor: wmUploading ? "not-allowed" : "pointer" }}>
                {wmUploading ? "Uploading…" : wm.logoPath ? "Change logo" : "Upload logo (PNG)"}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={wmUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadWmLogo(f); e.currentTarget.value = ""; }} />
              </label>
              {wmLogoPreview && (
                <span style={{ padding: 6, borderRadius: 8, border: `1px solid ${ds.color.line2}`, background: "#222" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wmLogoPreview} alt="logo" style={{ height: 40, display: "block", objectFit: "contain" }} />
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={label}>Position</label>
                <select value={wm.position} onChange={e => setWm({ ...wm, position: e.target.value })} style={inputSt}>
                  <option value="bottom-right">Bottom-Right (recommended)</option>
                  <option value="bottom-left">Bottom-Left</option>
                  <option value="top-right">Top-Right</option>
                  <option value="top-left">Top-Left</option>
                  <option value="center">Center</option>
                </select>
              </div>
              <div>
                <label style={label}>Size ({Math.round(wm.scale * 100)}%)</label>
                <input type="range" min={0.05} max={0.4} step={0.01} value={wm.scale} onChange={e => setWm({ ...wm, scale: Number(e.target.value) })} style={{ width: "100%", marginTop: 10 }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>Opacity ({Math.round(wm.opacity * 100)}%)</label>
              <input type="range" min={0.2} max={1} step={0.05} value={wm.opacity} onChange={e => setWm({ ...wm, opacity: Number(e.target.value) })} style={{ width: "100%", marginTop: 6 }} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: ds.color.ink2, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={wm.enabled} onChange={e => setWm({ ...wm, enabled: e.target.checked })} />
              Auto-stamp every new commercial with this logo
            </label>

            {wmMsg && <p style={{ fontSize: 12, color: wmMsg.includes("Saved") ? ds.color.mint : ds.color.coral, marginBottom: 10 }}>{wmMsg}</p>}
            <ButtonPrimary onClick={saveWm} disabled={wmSaving || !wm.logoPath} style={{ width: "100%" }}>
              {wmSaving ? "Saving…" : "Save Logo Settings"}
            </ButtonPrimary>
          </>
        ) : (
          <p style={{ fontSize: 12, color: ds.color.mute }}>Loading…</p>
        )}
      </Card>
    </div>
  );
}
