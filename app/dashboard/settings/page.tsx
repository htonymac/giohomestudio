"use client";

import { useState, useEffect } from "react";
import { ds } from "../../../lib/designSystem";
import ButtonPrimary from "../../components/ui/ButtonPrimary";
import Card from "../../components/ui/Card";

// ── Types ───────────────────────────────────────────────────────────────────

interface ProviderStatus {
  claude: "configured" | "not_configured";
  openai: "configured" | "not_configured";
  grok:   "configured" | "not_configured";
  ollama: "configured" | "not_configured";
}

interface RoleAssignments {
  fast:       string;
  quality:    string;
  creative:   string;
  assistant:  string;
  supervisor: string;
  vision:     string;
}

interface ServiceStatus {
  elevenlabs: "configured" | "not_configured";
  kling:      "configured" | "not_configured";
  runway:     "configured" | "not_configured";
}

interface SettingsData {
  status:          ProviderStatus;
  serviceStatus:   ServiceStatus;
  forced:          string | null;
  ollamaUrl:       string;
  maskedKeys:      { anthropic: string; openai: string; grok: string; elevenlabs: string; kling: string; runway: string };
  ollamaModels:    string[];
  roleAssignments: RoleAssignments;
}

// ── Shared style atoms ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: ds.color.card,
  border: `1px solid ${ds.color.line}`,
  borderRadius: ds.radius.sm,
  padding: "10px 12px",
  color: ds.color.ink,
  fontSize: 14,
  fontFamily: ds.font.sans,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: ds.color.card,
  border: `1px solid ${ds.color.line}`,
  borderRadius: ds.radius.sm,
  padding: "10px 12px",
  color: ds.color.ink,
  fontSize: 14,
  fontFamily: ds.font.sans,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: ds.color.mute,
  marginBottom: 4,
  fontFamily: ds.font.mono,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const PROVIDERS = [
  {
    id: "claude" as const,
    name: "Claude (Anthropic)",
    key: "ANTHROPIC_API_KEY" as const,
    placeholder: "sk-ant-api03-…",
    hint: "Get from console.anthropic.com",
    note: "Your Claude.ai Pro/Max subscription does NOT include API access. You need a separate key from the Anthropic console.",
    badge: "Recommended",
    badgeColor: { bg: `${ds.color.lilac}18`, text: ds.color.lilac, border: `${ds.color.lilac}40` },
    maskedField: "anthropic" as const,
  },
  {
    id: "openai" as const,
    name: "GPT (OpenAI)",
    key: "OPENAI_API_KEY" as const,
    placeholder: "sk-proj-…",
    hint: "Get from platform.openai.com",
    note: null,
    badge: "Secondary",
    badgeColor: { bg: `${ds.color.mint}18`, text: ds.color.mint, border: `${ds.color.mint}40` },
    maskedField: "openai" as const,
  },
  {
    id: "grok" as const,
    name: "Grok (xAI)",
    key: "XAI_API_KEY" as const,
    placeholder: "xai-…",
    hint: "Get from console.x.ai",
    note: null,
    badge: "Secondary",
    badgeColor: { bg: `${ds.color.mint}18`, text: ds.color.mint, border: `${ds.color.mint}40` },
    maskedField: "grok" as const,
  },
];

const ROLE_DEFS: { key: keyof RoleAssignments; label: string; description: string; defaultModel: string }[] = [
  { key: "fast",       label: "Fast tasks",       description: "Polish, quick suggestions, short rewrites",  defaultModel: "phi3:latest"    },
  { key: "quality",    label: "Quality tasks",    description: "Analysis, planning, structured output",       defaultModel: "qwen2.5:14b"    },
  { key: "creative",   label: "Creative tasks",   description: "Narration, scripts, storytelling",           defaultModel: "mistral:latest" },
  { key: "assistant",  label: "Assistant tasks",  description: "Errands, lookups, general help",             defaultModel: "llama3:latest"  },
  { key: "supervisor", label: "Supervisor",       description: "Orchestration, planning, auto mode",         defaultModel: "qwen2.5:14b"    },
  { key: "vision",     label: "Vision (images)",  description: "Read slide images — must be a vision model (llava, qwen2-vl, minicpm-v)", defaultModel: "llava:latest"   },
];

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      flexShrink: 0,
      background: ok ? ds.color.mint : ds.color.mute2,
      boxShadow: ok ? `0 0 6px ${ds.color.mint}88` : "none",
    }} />
  );
}

// ── Main settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState("");
  const [current, setCurrent]     = useState<SettingsData | null>(null);

  const [keys, setKeys] = useState({
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY:    "",
    XAI_API_KEY:       "",
    LLM_PROVIDER:      "" as "" | "claude" | "openai" | "grok" | "ollama",
    OLLAMA_BASE_URL:   "",
    ELEVENLABS_API_KEY: "",
    KLING_ACCESS_KEY:   "",
    KLING_SECRET_KEY:   "",
    RUNWAY_API_KEY:     "",
  });

  const [roles, setRoles] = useState<RoleAssignments>({
    fast:       "phi3:latest",
    quality:    "qwen2.5:14b",
    creative:   "mistral:latest",
    assistant:  "llama3:latest",
    supervisor: "qwen2.5:14b",
    vision:     "llava:latest",
  });

  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  async function refreshSettings() {
    const r = await fetch("/api/settings/llm");
    if (!r.ok) return;
    const data: SettingsData = await r.json();
    setCurrent(data);
    if (data.roleAssignments) setRoles(data.roleAssignments);
  }

  useEffect(() => {
    fetch("/api/settings/llm")
      .then(r => r.json())
      .then((data: SettingsData) => {
        setCurrent(data);
        setKeys(prev => ({
          ...prev,
          LLM_PROVIDER: (data.forced ?? "") as typeof keys.LLM_PROVIDER,
          OLLAMA_BASE_URL: data.ollamaUrl,
        }));
        if (data.roleAssignments) setRoles(data.roleAssignments);
      })
      .finally(() => setLoading(false));
  }, []);

  function setKey(field: keyof typeof keys, value: string) {
    setKeys(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setError("");
  }

  function setRole(field: keyof RoleAssignments, value: string) {
    setRoles(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(keys)) {
        if (v !== "") payload[k] = v;
      }
      payload["OLLAMA_MODEL_FAST"]       = roles.fast;
      payload["OLLAMA_MODEL_QUALITY"]    = roles.quality;
      payload["OLLAMA_MODEL_CREATIVE"]   = roles.creative;
      payload["OLLAMA_MODEL_ASSISTANT"]  = roles.assistant;
      payload["OLLAMA_MODEL_SUPERVISOR"] = roles.supervisor;
      payload["OLLAMA_MODEL_VISION"]     = roles.vision;
      if (keys.ELEVENLABS_API_KEY) payload["ELEVENLABS_API_KEY"] = keys.ELEVENLABS_API_KEY;
      if (keys.KLING_ACCESS_KEY)   payload["KLING_ACCESS_KEY"]   = keys.KLING_ACCESS_KEY;
      if (keys.KLING_SECRET_KEY)   payload["KLING_SECRET_KEY"]   = keys.KLING_SECRET_KEY;
      if (keys.RUNWAY_API_KEY)     payload["RUNWAY_API_KEY"]     = keys.RUNWAY_API_KEY;

      const res  = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      setSaved(true);
      await refreshSettings();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear(field: keyof typeof keys) {
    setKeys(prev => ({ ...prev, [field]: "" }));
    await fetch("/api/settings/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: "" }),
    });
    await refreshSettings();
  }

  async function handleClearMultiple(fields: (keyof typeof keys)[]) {
    const cleared = Object.fromEntries(fields.map(f => [f, ""]));
    setKeys(prev => ({ ...prev, ...cleared }));
    await fetch("/api/settings/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleared),
    });
    await refreshSettings();
  }

  const activeCount = current
    ? Object.values(current.status).filter(v => v === "configured").length
    : 0;

  const willUse = current?.forced
    || (current?.status.claude === "configured" ? "claude"
      : current?.status.openai === "configured" ? "openai"
      : current?.status.grok   === "configured" ? "grok"
      : "ollama (local)");

  const ollamaOnline = current ? current.ollamaModels.length > 0 : false;

  // ── Section header helper ────────────────────────────────────────────────
  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <h2 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, marginBottom: 12, fontFamily: ds.font.mono, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {children}
      </h2>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto", padding: 4, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.lilac, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: ds.font.mono, marginBottom: 4 }}>
          AI Studio
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: ds.color.ink, letterSpacing: "-0.03em", margin: 0 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: ds.color.ink2, marginTop: 4 }}>
          Configure AI providers, publishing connections, and service keys
        </p>
      </div>

      {/* Info banner */}
      <Card padding="12px 16px" radius={ds.radius.md} style={{ borderColor: `${ds.color.lilac}30` }}>
        <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: ds.color.ink }}>No .env editing needed for LLM settings.</span>{" "}
          Everything configured here is saved to{" "}
          <code style={{ fontFamily: ds.font.mono, color: ds.color.mute, fontSize: 11 }}>storage/llm-settings.json</code>{" "}
          and takes effect immediately — no restart needed.
        </p>
      </Card>

      {/* Status bar */}
      <Card padding="16px 18px" radius={ds.radius.md}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink, margin: 0 }}>Provider status</p>
            <p style={{ fontSize: 12, color: ds.color.mute, marginTop: 2 }}>
              {loading ? "Loading..." : activeCount === 0
                ? "No providers configured — LLM functions will fail"
                : `${activeCount} provider${activeCount !== 1 ? "s" : ""} configured · Active: ${willUse}`}
            </p>
          </div>
          {!loading && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: ds.radius.pill,
              fontFamily: ds.font.mono, letterSpacing: "0.1em", textTransform: "uppercase",
              background: activeCount > 0 ? `${ds.color.mint}18` : `${ds.color.coral}18`,
              color: activeCount > 0 ? ds.color.mint : ds.color.coral,
              border: `1px solid ${activeCount > 0 ? ds.color.mint : ds.color.coral}40`,
            }}>
              {activeCount > 0 ? "Ready" : "Not configured"}
            </span>
          )}
        </div>

        {current && (
          <div style={{ display: "flex", gap: 16, paddingTop: 12, marginTop: 12, borderTop: `1px solid ${ds.color.line}` }}>
            {[
              { label: "Claude",         ok: current.status.claude === "configured", masked: current.maskedKeys.anthropic },
              { label: "GPT",            ok: current.status.openai === "configured", masked: current.maskedKeys.openai },
              { label: "Grok",           ok: current.status.grok   === "configured", masked: current.maskedKeys.grok },
              { label: "Ollama (local)", ok: ollamaOnline,                           masked: current.ollamaUrl },
            ].map(p => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <StatusDot ok={p.ok} />
                <span style={{ fontSize: 11, color: ds.color.mute }}>{p.label}</span>
                {p.ok && p.masked && <span style={{ fontSize: 10, color: ds.color.mute2, fontFamily: ds.font.mono }}>{p.masked}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Section A: Cloud API Keys ── */}
      <div>
        <SectionLabel>Section A — Cloud API Keys</SectionLabel>

        {PROVIDERS.map(provider => {
          const isSet = current?.status[provider.id] === "configured";
          const masked = current?.maskedKeys[provider.maskedField];
          return (
            <Card key={provider.id} padding="16px 18px" radius={ds.radius.md} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusDot ok={isSet} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>{provider.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.pill,
                    fontFamily: ds.font.mono, letterSpacing: "0.08em",
                    background: provider.badgeColor.bg, color: provider.badgeColor.text, border: `1px solid ${provider.badgeColor.border}`,
                  }}>
                    {provider.badge}
                  </span>
                </div>
                {isSet && (
                  <button onClick={() => handleClear(provider.key)}
                    style={{ fontSize: 11, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}>
                    Clear
                  </button>
                )}
              </div>

              <div style={{ marginBottom: provider.note ? 12 : 0 }}>
                <label style={labelStyle}>API Key</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showKey[provider.key] ? "text" : "password"}
                    value={keys[provider.key]}
                    onChange={e => setKey(provider.key, e.target.value)}
                    placeholder={isSet ? masked : provider.placeholder}
                    style={{ ...inputStyle, paddingRight: 48, fontFamily: ds.font.mono }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(prev => ({ ...prev, [provider.key]: !prev[provider.key] }))}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: ds.color.mute, background: "none", border: "none", cursor: "pointer" }}
                  >
                    {showKey[provider.key] ? "hide" : "show"}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>{provider.hint}</p>
              </div>

              {provider.note && (
                <div style={{ background: `${ds.color.gold}0a`, border: `1px solid ${ds.color.gold}25`, borderRadius: ds.radius.sm, padding: "8px 12px" }}>
                  <p style={{ fontSize: 11, color: ds.color.gold, lineHeight: 1.6, margin: 0 }}>{provider.note}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Section B: Ollama Local Models ── */}
      <div>
        <SectionLabel>Section B — Ollama Local Models</SectionLabel>

        <Card padding="16px 18px" radius={ds.radius.md}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StatusDot ok={ollamaOnline} />
            <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>Ollama</span>
            {loading ? (
              <span style={{ fontSize: 12, color: ds.color.mute }}>Checking...</span>
            ) : ollamaOnline ? (
              <span style={{ fontSize: 12, color: ds.color.mint }}>{current?.ollamaModels.length} model{current?.ollamaModels.length !== 1 ? "s" : ""} detected</span>
            ) : (
              <span style={{ fontSize: 12, color: ds.color.coral }}>Ollama offline — start it to see models</span>
            )}
          </div>

          {ollamaOnline && current && current.ollamaModels.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {current.ollamaModels.map(m => (
                <span key={m} style={{ fontSize: 11, background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.mute, padding: "2px 8px", borderRadius: ds.radius.xs, fontFamily: ds.font.mono }}>
                  {m}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Assign Ollama models to roles:</p>
            {ROLE_DEFS.map(role => {
              const modelOptions = ollamaOnline && current
                ? current.ollamaModels
                : [roles[role.key]].filter(Boolean);
              const allOptions = Array.from(new Set([roles[role.key], role.defaultModel, ...modelOptions])).filter(Boolean);

              return (
                <div key={role.key}>
                  <label style={labelStyle}>
                    {role.label}{" "}
                    <span style={{ color: ds.color.mute2, fontWeight: 400 }}>— {role.description}</span>
                  </label>
                  {ollamaOnline && current && current.ollamaModels.length > 0 ? (
                    <select value={roles[role.key]} onChange={e => setRole(role.key, e.target.value)} style={selectStyle}>
                      {allOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={roles[role.key]}
                      onChange={e => setRole(role.key, e.target.value)}
                      placeholder={role.defaultModel}
                      style={{ ...inputStyle, fontFamily: ds.font.mono }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Provider force selector ── */}
      <Card padding="16px 18px" radius={ds.radius.md}>
        <p style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink, marginBottom: 4 }}>Force a specific provider</p>
        <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 14 }}>
          By default, GioHomeStudio tries Claude → GPT → Grok → Ollama in that order. Override here to always use one provider.
        </p>
        <div>
          <label style={labelStyle}>Always use</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["", "claude", "openai", "grok", "ollama"] as const).map(v => (
              <button
                key={v || "auto"}
                onClick={() => setKey("LLM_PROVIDER", v)}
                style={{
                  padding: "6px 14px", borderRadius: ds.radius.sm, fontSize: 12, fontWeight: 600,
                  fontFamily: ds.font.sans, cursor: "pointer",
                  background: keys.LLM_PROVIDER === v ? `${ds.color.lilac}18` : ds.color.card,
                  border: `1px solid ${keys.LLM_PROVIDER === v ? ds.color.lilac : ds.color.line2}`,
                  color: keys.LLM_PROVIDER === v ? ds.color.lilac : ds.color.mute,
                  transition: "all .15s",
                }}
              >
                {v === "" ? "Auto (recommended)" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Ollama base URL</label>
          <input
            type="text"
            value={keys.OLLAMA_BASE_URL}
            onChange={e => setKey("OLLAMA_BASE_URL", e.target.value)}
            placeholder="http://localhost:11434"
            style={{ ...inputStyle, fontFamily: ds.font.mono }}
          />
          <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>Only needed if Ollama is running on a different port or machine</p>
        </div>
      </Card>

      {/* ── Section C: Media Service Keys ── */}
      <div>
        <SectionLabel>Section C — Media Service Keys</SectionLabel>
        <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 14 }}>
          Voice generation, AI video, and music. Keys saved here override{" "}
          <code style={{ fontFamily: ds.font.mono, color: ds.color.mute2 }}>.env</code> values.
        </p>

        {/* ElevenLabs */}
        <Card padding="16px 18px" radius={ds.radius.md} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot ok={current?.serviceStatus?.elevenlabs === "configured"} />
              <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>ElevenLabs</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.pill, fontFamily: ds.font.mono, background: `${ds.color.lilac}18`, color: ds.color.lilac, border: `1px solid ${ds.color.lilac}40` }}>Voice</span>
            </div>
            {current?.serviceStatus?.elevenlabs === "configured" && (
              <button onClick={() => handleClear("ELEVENLABS_API_KEY")} style={{ fontSize: 11, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
            )}
          </div>
          <label style={labelStyle}>API Key</label>
          <div style={{ position: "relative" }}>
            <input
              type={showKey["ELEVENLABS_API_KEY"] ? "text" : "password"}
              value={keys.ELEVENLABS_API_KEY}
              onChange={e => { setKeys(p => ({ ...p, ELEVENLABS_API_KEY: e.target.value })); setSaved(false); }}
              placeholder={current?.serviceStatus?.elevenlabs === "configured" ? current.maskedKeys.elevenlabs : "sk_..."}
              style={{ ...inputStyle, paddingRight: 48, fontFamily: ds.font.mono }}
            />
            <button type="button" onClick={() => setShowKey(p => ({ ...p, ELEVENLABS_API_KEY: !p.ELEVENLABS_API_KEY }))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: ds.color.mute, background: "none", border: "none", cursor: "pointer" }}>
              {showKey["ELEVENLABS_API_KEY"] ? "hide" : "show"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>Get from elevenlabs.io → Profile → API Keys</p>
        </Card>

        {/* Kling AI */}
        <Card padding="16px 18px" radius={ds.radius.md} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot ok={current?.serviceStatus?.kling === "configured"} />
              <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>Kling AI</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.pill, fontFamily: ds.font.mono, background: `${ds.color.sky}18`, color: ds.color.sky, border: `1px solid ${ds.color.sky}40` }}>Video</span>
            </div>
            {current?.serviceStatus?.kling === "configured" && (
              <button onClick={() => handleClearMultiple(["KLING_ACCESS_KEY", "KLING_SECRET_KEY"])} style={{ fontSize: 11, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Access Key</label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey["KLING_ACCESS_KEY"] ? "text" : "password"}
                value={keys.KLING_ACCESS_KEY}
                onChange={e => { setKeys(p => ({ ...p, KLING_ACCESS_KEY: e.target.value })); setSaved(false); }}
                placeholder={current?.serviceStatus?.kling === "configured" ? current.maskedKeys.kling : "Kling Access Key"}
                style={{ ...inputStyle, paddingRight: 48, fontFamily: ds.font.mono }}
              />
              <button type="button" onClick={() => setShowKey(p => ({ ...p, KLING_ACCESS_KEY: !p.KLING_ACCESS_KEY }))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: ds.color.mute, background: "none", border: "none", cursor: "pointer" }}>
                {showKey["KLING_ACCESS_KEY"] ? "hide" : "show"}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Secret Key</label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey["KLING_SECRET_KEY"] ? "text" : "password"}
                value={keys.KLING_SECRET_KEY}
                onChange={e => { setKeys(p => ({ ...p, KLING_SECRET_KEY: e.target.value })); setSaved(false); }}
                placeholder="Kling Secret Key"
                style={{ ...inputStyle, paddingRight: 48, fontFamily: ds.font.mono }}
              />
              <button type="button" onClick={() => setShowKey(p => ({ ...p, KLING_SECRET_KEY: !p.KLING_SECRET_KEY }))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: ds.color.mute, background: "none", border: "none", cursor: "pointer" }}>
                {showKey["KLING_SECRET_KEY"] ? "hide" : "show"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>Get from klingai.com → Developer Settings</p>
          </div>
        </Card>

        {/* Runway */}
        <Card padding="16px 18px" radius={ds.radius.md} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot ok={current?.serviceStatus?.runway === "configured"} />
              <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>Runway</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.pill, fontFamily: ds.font.mono, background: `${ds.color.sky}18`, color: ds.color.sky, border: `1px solid ${ds.color.sky}40` }}>Video</span>
            </div>
            {current?.serviceStatus?.runway === "configured" && (
              <button onClick={() => handleClear("RUNWAY_API_KEY")} style={{ fontSize: 11, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
            )}
          </div>
          <label style={labelStyle}>API Key</label>
          <div style={{ position: "relative" }}>
            <input
              type={showKey["RUNWAY_API_KEY"] ? "text" : "password"}
              value={keys.RUNWAY_API_KEY}
              onChange={e => { setKeys(p => ({ ...p, RUNWAY_API_KEY: e.target.value })); setSaved(false); }}
              placeholder={current?.serviceStatus?.runway === "configured" ? current.maskedKeys.runway : "key_..."}
              style={{ ...inputStyle, paddingRight: 48, fontFamily: ds.font.mono }}
            />
            <button type="button" onClick={() => setShowKey(p => ({ ...p, RUNWAY_API_KEY: !p.RUNWAY_API_KEY }))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: ds.color.mute, background: "none", border: "none", cursor: "pointer" }}>
              {showKey["RUNWAY_API_KEY"] ? "hide" : "show"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>Get from app.runwayml.com → Account → API Keys</p>
        </Card>
      </div>

      {/* ── Section D: Generation & Publishing ── */}
      <div>
        <SectionLabel>Section D — Generation & Publishing</SectionLabel>
        <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 14 }}>Image/video generation providers and social media publishing connections.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { name: "Segmind",         badge: "Image + Video",  color: ds.color.mint,    link: "segmind.com",       note: "$0.005/image, $0.005/clip" },
            { name: "fal.ai",          badge: "Image + Video",  color: ds.color.lilac,   link: "fal.ai/dashboard",  note: "Kling, Flux, Ideogram, Runway via fal" },
            { name: "Fish Audio",      badge: "Voice",          color: ds.color.sky,     link: "fish.audio",        note: "80% cheaper than ElevenLabs" },
            { name: "Cartesia",        badge: "Voice",          color: ds.color.blue,    link: "cartesia.ai",       note: "Ultra-low latency TTS" },
            { name: "Piper TTS",       badge: "Voice (Local)",  color: ds.color.mint,    link: null,                note: "Free local TTS — always available" },
            { name: "Suno AI",         badge: "Music Gen",      color: ds.color.pink,    link: "suno.com",          note: "AI music generation — user owns commercial rights" },
            { name: "Mubert",          badge: "Music Gen",      color: ds.color.pink,    link: "mubert.com",        note: "AI music library + generation" },
            { name: "ElevenLabs SFX",  badge: "Sound Effects",  color: ds.color.coral,   link: "elevenlabs.io",     note: "AI sound effect generation (~100 credits/effect)" },
          ].map(p => (
            <Card key={p.name} padding="12px 14px" radius={ds.radius.sm}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>{p.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: ds.radius.pill, fontFamily: ds.font.mono, background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}30` }}>{p.badge}</span>
              </div>
              <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 4 }}>{p.note}</p>
              {p.link && <a href={`https://${p.link}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: ds.color.lilac }}>{p.link} →</a>}
            </Card>
          ))}
        </div>

        <p style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Publishing Connections</p>

        {/* Telegram */}
        <Card padding="16px 18px" radius={ds.radius.md} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: ds.color.ink }}>Telegram</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.pill, fontFamily: ds.font.mono, background: `${ds.color.mint}18`, color: ds.color.mint, border: `1px solid ${ds.color.mint}40` }}>Ready</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={labelStyle}>Bot Token</label>
              <input type="password" defaultValue="" placeholder="Set TELEGRAM_BOT_TOKEN in .env" style={{ ...inputStyle, fontFamily: ds.font.mono }} disabled />
              <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 3 }}>Bot token is set in .env file — cannot be changed from UI for security</p>
            </div>
            <div>
              <label style={labelStyle}>Channel / Chat ID</label>
              <input
                type="text"
                defaultValue=""
                placeholder="@your_channel or numeric chat ID"
                onBlur={async (e) => {
                  const val = e.target.value.trim();
                  if (!val) return;
                  await fetch("/api/settings/llm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ TELEGRAM_CHAT_ID: val }),
                  });
                }}
                style={inputStyle}
              />
              <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 3, lineHeight: 1.6 }}>
                For a <strong>channel</strong>: use @channelname (e.g. @diolux_ads)<br />
                For <strong>personal chat</strong>: use your numeric ID (e.g. 5811210934)
              </p>
            </div>
          </div>
        </Card>

        {/* Other platforms */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { name: "YouTube",   abbr: "YT", status: "Needs OAuth",  action: "/api/publish/youtube/auth",  color: ds.color.coral },
            { name: "Facebook",  abbr: "FB", status: "Needs OAuth",  action: "/api/publish/facebook/auth", color: ds.color.coral },
            { name: "Instagram", abbr: "IG", status: "Via Facebook",  action: null,                         color: ds.color.mute },
            { name: "TikTok",    abbr: "TK", status: "Needs OAuth",  action: "/api/publish/tiktok/auth",   color: ds.color.coral },
          ].map(p => (
            <Card key={p.name} padding="12px 14px" radius={ds.radius.sm} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: ds.radius.xs, background: ds.color.alert, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ds.font.mono, fontSize: 11, fontWeight: 700, color: ds.color.mute }}>
                  {p.abbr}
                </div>
                <div>
                  <p style={{ fontSize: 13, color: ds.color.ink, fontWeight: 600, margin: 0 }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: p.color, margin: 0 }}>{p.status}</p>
                </div>
              </div>
              {p.action && (
                <a href={p.action} style={{ fontSize: 10, padding: "5px 12px", borderRadius: ds.radius.sm, background: `${ds.color.lilac}15`, color: ds.color.lilac, textDecoration: "none", fontWeight: 600 }}>
                  Connect
                </a>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Save feedback */}
      {error && (
        <div style={{ padding: "10px 14px", background: `${ds.color.coral}18`, border: `1px solid ${ds.color.coral}40`, borderRadius: ds.radius.sm, fontSize: 12, color: ds.color.coral }}>
          {error}
        </div>
      )}
      {saved && (
        <div style={{ padding: "10px 14px", background: `${ds.color.mint}18`, border: `1px solid ${ds.color.mint}40`, borderRadius: ds.radius.sm, fontSize: 12, color: ds.color.mint }}>
          Settings saved. LLM calls will use the new configuration immediately (no restart needed).
        </div>
      )}

      <ButtonPrimary onClick={handleSave} disabled={saving} size="lg" style={{ width: "100%" }}>
        {saving ? "Saving..." : "Save Settings"}
      </ButtonPrimary>

      <p style={{ textAlign: "center", fontSize: 11, color: ds.color.mute2, paddingBottom: 8 }}>
        Keys are stored in <code style={{ fontFamily: ds.font.mono }}>storage/llm-settings.json</code> on this machine only. Not logged, not committed, not sent anywhere except the respective AI provider.
      </p>
    </div>
  );
}
