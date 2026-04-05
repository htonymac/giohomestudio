"use client";

import { useState, useEffect } from "react";

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

const inputCls = "w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm placeholder-[#3a3a55] focus:outline-none focus:border-[#7c5cfc] font-mono";
const selectCls = "w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]";
const labelCls = "block text-xs text-[#6060a0] mb-1 font-medium";
const sectionCls = "bg-[#12121e] border border-[#2a2a40] rounded-xl p-4 space-y-4";

const PROVIDERS = [
  {
    id: "claude" as const,
    name: "Claude (Anthropic)",
    key: "ANTHROPIC_API_KEY" as const,
    placeholder: "sk-ant-api03-…",
    hint: "Get from console.anthropic.com",
    note: "Your Claude.ai Pro/Max subscription does NOT include API access. You need a separate key from the Anthropic console.",
    badge: "Recommended",
    badgeColor: "bg-[#7c5cfc]/20 text-[#b090ff] border-[#7c5cfc]/40",
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
    badgeColor: "bg-green-900/20 text-green-400 border-green-800/40",
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
    badgeColor: "bg-green-900/20 text-green-400 border-green-800/40",
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
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-green-500" : "bg-[#3a3a55]"}`} />
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

  // Single map for show/hide toggles across all key inputs (LLM + service keys)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  async function refreshSettings() {
    const r = await fetch("/api/settings/llm");
    if (!r.ok) return;
    const data: SettingsData = await r.json();
    setCurrent(data);
    if (data.roleAssignments) setRoles(data.roleAssignments);
  }

  // Load current status on mount
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
      // Only send non-empty API key values (empty = keep existing / fall back to env)
      for (const [k, v] of Object.entries(keys)) {
        if (v !== "") payload[k] = v;
      }
      // Always send role assignments (even if unchanged, they are idempotent)
      payload["OLLAMA_MODEL_FAST"]       = roles.fast;
      payload["OLLAMA_MODEL_QUALITY"]    = roles.quality;
      payload["OLLAMA_MODEL_CREATIVE"]   = roles.creative;
      payload["OLLAMA_MODEL_ASSISTANT"]  = roles.assistant;
      payload["OLLAMA_MODEL_SUPERVISOR"] = roles.supervisor;
      payload["OLLAMA_MODEL_VISION"]     = roles.vision;
      // Service keys: only include if non-empty
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

  // Which provider will actually be used
  const willUse = current?.forced
    || (current?.status.claude === "configured" ? "claude"
      : current?.status.openai === "configured" ? "openai"
      : current?.status.grok   === "configured" ? "grok"
      : "ollama (local)");

  const ollamaOnline = current ? current.ollamaModels.length > 0 : false;

  return (
    <div className="w-full max-w-2xl mx-auto p-1 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">LLM Settings</h1>
        <p className="text-sm text-[#6060a0] mt-1">
          Configure which AI providers power GioHomeStudio. Keys are stored locally in <code className="text-[#9090c0] text-xs">storage/llm-settings.json</code> — never shared.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-[#0d1a2e] border border-[#2a4060] rounded-xl px-4 py-3">
        <p className="text-xs text-[#70a0d0] leading-relaxed">
          <span className="font-semibold text-[#90c0e8]">ℹ You do NOT need to edit .env for LLM settings.</span>{" "}
          Everything configured here is saved to <code className="text-[#9090c0]">storage/llm-settings.json</code> and takes effect immediately — no restart needed.
        </p>
      </div>

      {/* Status bar */}
      <div className={`${sectionCls} !space-y-0`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Provider status</p>
            <p className="text-xs text-[#6060a0] mt-0.5">
              {loading ? "Loading…" : activeCount === 0 ? "No providers configured — LLM functions will fail" : `${activeCount} provider${activeCount !== 1 ? "s" : ""} configured · Active: ${willUse}`}
            </p>
          </div>
          {!loading && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full border ${activeCount > 0 ? "bg-green-900/20 text-green-400 border-green-800/40" : "bg-red-900/20 text-red-400 border-red-800/40"}`}>
              {activeCount > 0 ? "Ready" : "Not configured"}
            </span>
          )}
        </div>

        {current && (
          <div className="flex gap-4 pt-3 mt-3 border-t border-[#1a1a2e]">
            {[
              { label: "Claude",        ok: current.status.claude === "configured", masked: current.maskedKeys.anthropic },
              { label: "GPT",           ok: current.status.openai === "configured", masked: current.maskedKeys.openai },
              { label: "Grok",          ok: current.status.grok   === "configured", masked: current.maskedKeys.grok },
              { label: "Ollama (local)", ok: ollamaOnline,                          masked: current.ollamaUrl },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-1.5">
                <StatusDot ok={p.ok} />
                <span className="text-xs text-[#6060a0]">{p.label}</span>
                {p.ok && p.masked && <span className="text-[10px] text-[#404060] font-mono">{p.masked}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section A: Cloud API Keys ── */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Section A — Cloud API Keys</h2>

        {PROVIDERS.map(provider => {
          const isSet = current?.status[provider.id] === "configured";
          const masked = current?.maskedKeys[provider.maskedField];
          return (
            <div key={provider.id} className={`${sectionCls} mb-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot ok={isSet} />
                  <span className="text-sm font-semibold text-white">{provider.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${provider.badgeColor}`}>
                    {provider.badge}
                  </span>
                </div>
                {isSet && (
                  <button
                    onClick={() => handleClear(provider.key)}
                    className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div>
                <label className={labelCls}>API Key</label>
                <div className="relative">
                  <input
                    type={showKey[provider.key] ? "text" : "password"}
                    value={keys[provider.key]}
                    onChange={e => setKey(provider.key, e.target.value)}
                    placeholder={isSet ? masked : provider.placeholder}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(prev => ({ ...prev, [provider.key]: !prev[provider.key] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#4040600] hover:text-[#9090c0] transition-colors px-1"
                  >
                    {showKey[provider.key] ? "hide" : "show"}
                  </button>
                </div>
                <p className="text-[11px] text-[#4040600] mt-1">{provider.hint}</p>
              </div>

              {provider.note && (
                <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-yellow-400/80 leading-relaxed">{provider.note}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Section B: Ollama Local Models ── */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Section B — Ollama Local Models</h2>

        <div className={sectionCls}>
          {/* Ollama status */}
          <div className="flex items-center gap-2">
            <StatusDot ok={ollamaOnline} />
            <span className="text-sm font-semibold text-white">Ollama</span>
            {loading ? (
              <span className="text-xs text-[#6060a0]">Checking…</span>
            ) : ollamaOnline ? (
              <span className="text-xs text-green-400">{current?.ollamaModels.length} model{current?.ollamaModels.length !== 1 ? "s" : ""} detected</span>
            ) : (
              <span className="text-xs text-[#a06060]">Ollama offline — start it to see models</span>
            )}
          </div>

          {/* Detected models list */}
          {ollamaOnline && current && current.ollamaModels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {current.ollamaModels.map(m => (
                <span key={m} className="text-[11px] bg-[#1a1a2e] border border-[#2a2a40] text-[#9090c0] px-2 py-0.5 rounded font-mono">
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Role assignment dropdowns */}
          <div className="space-y-3 pt-1">
            <p className="text-xs text-[#6060a0] font-medium">Assign Ollama models to roles:</p>
            {ROLE_DEFS.map(role => {
              const modelOptions = ollamaOnline && current
                ? current.ollamaModels
                : [roles[role.key]].filter(Boolean);

              // Ensure current value always appears as an option
              const allOptions = Array.from(new Set([roles[role.key], role.defaultModel, ...modelOptions])).filter(Boolean);

              return (
                <div key={role.key}>
                  <label className={labelCls}>
                    {role.label} <span className="text-[#3a3a55] font-normal">— {role.description}</span>
                  </label>
                  {ollamaOnline && current && current.ollamaModels.length > 0 ? (
                    <select
                      value={roles[role.key]}
                      onChange={e => setRole(role.key, e.target.value)}
                      className={selectCls}
                    >
                      {allOptions.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={roles[role.key]}
                      onChange={e => setRole(role.key, e.target.value)}
                      placeholder={role.defaultModel}
                      className={inputCls}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Provider force selector ── */}
      <div className={sectionCls}>
        <div>
          <p className="text-sm font-semibold text-white">Force a specific provider</p>
          <p className="text-xs text-[#6060a0] mt-0.5">By default, GioHomeStudio tries Claude → GPT → Grok → Ollama in that order. Override here to always use one provider.</p>
        </div>
        <div>
          <label className={labelCls}>Always use</label>
          <div className="flex gap-2 flex-wrap">
            {(["", "claude", "openai", "grok", "ollama"] as const).map(v => (
              <button
                key={v || "auto"}
                onClick={() => setKey("LLM_PROVIDER", v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  keys.LLM_PROVIDER === v
                    ? "bg-[#7c5cfc]/20 border-[#7c5cfc] text-[#b090ff]"
                    : "bg-[#0d0d1a] border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70] hover:text-white"
                }`}
              >
                {v === "" ? "Auto (recommended)" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Ollama base URL</label>
          <input
            type="text"
            value={keys.OLLAMA_BASE_URL}
            onChange={e => setKey("OLLAMA_BASE_URL", e.target.value)}
            placeholder="http://localhost:11434"
            className={inputCls}
          />
          <p className="text-[11px] text-[#4040600] mt-1">Only needed if Ollama is running on a different port or machine</p>
        </div>
      </div>

      {/* ── Section C: Media Service Keys ── */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Section C — Media Service Keys</h2>
        <p className="text-xs text-[#6060a0] mb-4">Voice generation, AI video, and music. Keys saved here override <code className="text-[#9090c0]">.env</code> values.</p>

        {/* ElevenLabs */}
        <div className={`${sectionCls} mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot ok={current?.serviceStatus?.elevenlabs === "configured"} />
              <span className="text-sm font-semibold text-white">ElevenLabs</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-[#7c5cfc]/20 text-[#b090ff] border-[#7c5cfc]/40">Voice</span>
            </div>
            {current?.serviceStatus?.elevenlabs === "configured" && (
              <button onClick={() => handleClear("ELEVENLABS_API_KEY")} className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors">Clear</button>
            )}
          </div>
          <div>
            <label className={labelCls}>API Key</label>
            <div className="relative">
              <input
                type={showKey["ELEVENLABS_API_KEY"] ? "text" : "password"}
                value={keys.ELEVENLABS_API_KEY}
                onChange={e => { setKeys(p => ({ ...p, ELEVENLABS_API_KEY: e.target.value })); setSaved(false); }}
                placeholder={current?.serviceStatus?.elevenlabs === "configured" ? current.maskedKeys.elevenlabs : "sk_…"}
                className={inputCls}
              />
              <button type="button" onClick={() => setShowKey(p => ({ ...p, ELEVENLABS_API_KEY: !p.ELEVENLABS_API_KEY }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#4040600] hover:text-[#9090c0] transition-colors px-1">
                {showKey["ELEVENLABS_API_KEY"] ? "hide" : "show"}
              </button>
            </div>
            <p className="text-[11px] text-[#4040600] mt-1">Get from elevenlabs.io → Profile → API Keys</p>
          </div>
        </div>

        {/* Kling AI */}
        <div className={`${sectionCls} mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot ok={current?.serviceStatus?.kling === "configured"} />
              <span className="text-sm font-semibold text-white">Kling AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-blue-900/20 text-blue-400 border-blue-800/40">Video</span>
            </div>
            {current?.serviceStatus?.kling === "configured" && (
              <button onClick={() => handleClearMultiple(["KLING_ACCESS_KEY", "KLING_SECRET_KEY"])} className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors">Clear</button>
            )}
          </div>
          <div>
            <label className={labelCls}>Access Key</label>
            <div className="relative">
              <input
                type={showKey["KLING_ACCESS_KEY"] ? "text" : "password"}
                value={keys.KLING_ACCESS_KEY}
                onChange={e => { setKeys(p => ({ ...p, KLING_ACCESS_KEY: e.target.value })); setSaved(false); }}
                placeholder={current?.serviceStatus?.kling === "configured" ? current.maskedKeys.kling : "Kling Access Key"}
                className={inputCls}
              />
              <button type="button" onClick={() => setShowKey(p => ({ ...p, KLING_ACCESS_KEY: !p.KLING_ACCESS_KEY }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#4040600] hover:text-[#9090c0] transition-colors px-1">
                {showKey["KLING_ACCESS_KEY"] ? "hide" : "show"}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Secret Key</label>
            <div className="relative">
              <input
                type={showKey["KLING_SECRET_KEY"] ? "text" : "password"}
                value={keys.KLING_SECRET_KEY}
                onChange={e => { setKeys(p => ({ ...p, KLING_SECRET_KEY: e.target.value })); setSaved(false); }}
                placeholder="Kling Secret Key"
                className={inputCls}
              />
              <button type="button" onClick={() => setShowKey(p => ({ ...p, KLING_SECRET_KEY: !p.KLING_SECRET_KEY }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#4040600] hover:text-[#9090c0] transition-colors px-1">
                {showKey["KLING_SECRET_KEY"] ? "hide" : "show"}
              </button>
            </div>
            <p className="text-[11px] text-[#4040600] mt-1">Get from klingai.com → Developer Settings</p>
          </div>
        </div>

        {/* Runway */}
        <div className={`${sectionCls} mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot ok={current?.serviceStatus?.runway === "configured"} />
              <span className="text-sm font-semibold text-white">Runway</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-blue-900/20 text-blue-400 border-blue-800/40">Video</span>
            </div>
            {current?.serviceStatus?.runway === "configured" && (
              <button onClick={() => handleClear("RUNWAY_API_KEY")} className="text-[11px] text-red-500/60 hover:text-red-400 transition-colors">Clear</button>
            )}
          </div>
          <div>
            <label className={labelCls}>API Key</label>
            <div className="relative">
              <input
                type={showKey["RUNWAY_API_KEY"] ? "text" : "password"}
                value={keys.RUNWAY_API_KEY}
                onChange={e => { setKeys(p => ({ ...p, RUNWAY_API_KEY: e.target.value })); setSaved(false); }}
                placeholder={current?.serviceStatus?.runway === "configured" ? current.maskedKeys.runway : "key_…"}
                className={inputCls}
              />
              <button type="button" onClick={() => setShowKey(p => ({ ...p, RUNWAY_API_KEY: !p.RUNWAY_API_KEY }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#4040600] hover:text-[#9090c0] transition-colors px-1">
                {showKey["RUNWAY_API_KEY"] ? "hide" : "show"}
              </button>
            </div>
            <p className="text-[11px] text-[#4040600] mt-1">Get from app.runwayml.com → Account → API Keys</p>
          </div>
        </div>
      </div>

      {/* Save */}
      {error && (
        <div className="px-4 py-2 bg-red-950/30 border border-red-800/40 rounded-lg text-xs text-red-400">{error}</div>
      )}
      {saved && (
        <div className="px-4 py-2 bg-green-950/30 border border-green-800/40 rounded-lg text-xs text-green-400">
          Settings saved. LLM calls will use the new configuration immediately (no restart needed).
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-[#7c5cfc] hover:bg-[#9070ff] disabled:bg-[#2a2a40] disabled:text-[#6060a0] text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>

      <p className="text-center text-[11px] text-[#3a3a55] pb-2">
        Keys are stored in <code>storage/llm-settings.json</code> on this machine only. They are not logged, committed, or sent anywhere except the respective AI provider.
      </p>
    </div>
  );
}
