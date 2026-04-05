"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ACCENT_PROFILES,
  SPEAKER_PROFILES,
  DELIVERY_STYLES,
  DEFAULT_NARRATION_SETTINGS,
  type NarrationSettings,
  type AccentLocale,
  type SpeakerProfile,
  type DeliveryStyle,
  type VoicePacing,
  type VoiceEmotion,
} from "@/modules/voice-provider/accent-profiles";

interface VoiceDesignPreview {
  previewId: string;
  audioUrl: string;
  label: string;
}

interface NarrationPanelProps {
  value: NarrationSettings;
  onChange: (settings: NarrationSettings) => void;
  narrationEnabled: boolean;
  onNarrationEnabledChange: (enabled: boolean) => void;
}

const PACING_OPTIONS: VoicePacing[] = ["slow", "normal", "fast"];
const EMOTION_OPTIONS: VoiceEmotion[] = ["calm", "warm", "energetic", "dramatic", "authoritative"];
const VOICE_SOURCE_OPTIONS: NarrationSettings["voiceSource"][] = ["auto_design", "library_search", "selected_id"];

const VOICE_SOURCE_LABELS: Record<NarrationSettings["voiceSource"], string> = {
  auto_design:    "Auto-generate (Voice Design)",
  library_search: "Search Library",
  selected_id:    "Use Selected Voice ID",
};

type MatchStatus = "exact" | "close" | "library" | "generic" | null;
const MATCH_STATUS_LABELS: Record<NonNullable<MatchStatus>, string> = {
  exact:   "Exact locale match",
  close:   "Close regional match",
  library: "Library voice",
  generic: "Generic fallback",
};
const MATCH_STATUS_COLORS: Record<NonNullable<MatchStatus>, string> = {
  exact:   "#22c55e",
  close:   "#f59e0b",
  library: "#3b82f6",
  generic: "#6b7280",
};

// Sub-accent groups — locales that show a secondary narrowing dropdown
const SUB_ACCENT_MAP: Partial<Record<string, AccentLocale[]>> = {
  "en-NG": ["en-NG-yoruba", "en-NG-igbo", "en-NG-hausa", "en-NG-standard", "en-NG-polished"],
  "en-GH": ["en-GH-standard", "en-GH-accra"],
  "en-ZA": ["en-ZA-johannesburg", "en-ZA-capetown"],
};

const REGION_GROUPS = [
  { label: "Nigerian English",      locales: ["en-NG-yoruba", "en-NG-igbo", "en-NG-hausa", "en-NG-standard", "en-NG-polished"] },
  { label: "Ghanaian English",      locales: ["en-GH-standard", "en-GH-accra"] },
  { label: "South African English", locales: ["en-ZA-johannesburg", "en-ZA-capetown"] },
  { label: "Other",                 locales: ["en-GB", "en-US", "custom"] },
];

// Maps locale prefix to ElevenLabs library search term
const LOCALE_PREFIX_QUERY: Record<string, string> = {
  "en-NG": "nigerian",
  "en-GH": "ghanaian",
  "en-ZA": "south african",
};

function getLibraryQuery(locale: AccentLocale): string {
  const prefix = Object.keys(LOCALE_PREFIX_QUERY).find(p => locale.startsWith(p));
  return prefix ? LOCALE_PREFIX_QUERY[prefix] : "african";
}

export default function NarrationPanel({
  value,
  onChange,
  narrationEnabled,
  onNarrationEnabledChange,
}: NarrationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [previews, setPreviews] = useState<VoiceDesignPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);
  const [matchStatus, setMatchStatus] = useState<MatchStatus>(null);
  const [libraryVoices, setLibraryVoices] = useState<Array<{ voiceId: string; name: string; labels: Record<string,string>; previewUrl: string }>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [generateError, setGenerateError] = useState("");

  // Refs for cancelling in-flight requests when a new one starts
  const previewAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  // Ref for debouncing persist calls
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted settings once on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/voice-design/profile", { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.default) {
          onChange({ ...DEFAULT_NARRATION_SETTINGS, ...data.default });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced persist — fires 500ms after the last settings change
  const persistSettings = useCallback((settings: NarrationSettings) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      fetch("/api/voice-design/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: "default", settings }),
      }).catch(() => {});
    }, 500);
  }, []);

  function update(partial: Partial<NarrationSettings>) {
    const next = { ...value, ...partial };
    onChange(next);
    persistSettings(next);
  }

  const currentProfile = ACCENT_PROFILES.find(p => p.locale === value.locale);
  const speakerLabel = SPEAKER_PROFILES.find(p => p.id === value.speakerProfile)?.label ?? "";
  const collapsedSummary = currentProfile
    ? `${currentProfile.label} · ${speakerLabel} · ${value.deliveryStyle}`
    : "Not configured";

  async function handlePreviewVoice() {
    // Cancel any in-flight preview request before starting a new one
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setPreviewError("");
    setPreviews([]);
    setMatchStatus(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/voice-design/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: value.locale,
          speakerProfile: value.speakerProfile,
          deliveryStyle: value.deliveryStyle,
          pacing: value.pacing,
          emotion: value.emotion,
          customInstruction: value.customInstruction,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error ?? "Preview failed");
      } else {
        setPreviews(data.previews ?? []);
        setMatchStatus("exact");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setPreviewError("Network error — could not reach ElevenLabs");
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleUseThisVoice() {
    if (!selectedPreviewId) return;
    setSavingVoice(true);
    setGenerateError("");
    try {
      const profile = ACCENT_PROFILES.find(p => p.locale === value.locale);
      const voiceName = `GioStudio — ${profile?.label ?? value.locale} (${speakerLabel})`;
      const res = await fetch("/api/voice-design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: selectedPreviewId,
          voiceName,
          voiceDescription: voiceName,
        }),
      });
      const data = await res.json();
      if (res.ok && data.voiceId) {
        update({ voiceId: data.voiceId, voiceSource: "auto_design" });
      } else {
        setGenerateError(data.error ?? "Failed to save voice");
      }
    } catch {
      setGenerateError("Network error — could not save voice");
    } finally {
      setSavingVoice(false);
    }
  }

  async function handleSearchLibrary() {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setLibraryLoading(true);
    setLibraryVoices([]);
    setLibraryError("");
    try {
      const query = getLibraryQuery(value.locale);
      const res = await fetch(`/api/voice-design/library-search?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setLibraryError(data.error ?? "Library search failed");
      } else {
        setLibraryVoices(data.voices ?? []);
        if ((data.voices ?? []).length === 0) setLibraryError("No voices found for this accent");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setLibraryError("Network error");
    } finally {
      setLibraryLoading(false);
    }
  }

  // en-GB, en-US, and custom have no sub-accent narrowing
  const showSubAccent = ACCENT_PROFILES.find(p => p.locale === value.locale)?.hasSubAccent ?? false;

  return (
    <div style={{ border: "1px solid #333", borderRadius: 8, background: "#0f0f0f", marginBottom: 16 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer", color: "#e5e5e5",
          fontWeight: 600, fontSize: 14,
        }}
      >
        <span>🎙 Narration Settings</span>
        <span style={{ fontSize: 12, color: "#888" }}>
          {narrationEnabled ? collapsedSummary : "OFF"} &nbsp; {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

          <Row label="Narration">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={narrationEnabled}
                onChange={e => onNarrationEnabledChange(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>{narrationEnabled ? "ON" : "OFF"}</span>
            </label>
          </Row>

          <Row label="Region / Accent">
            <select
              value={value.locale}
              onChange={e => update({ locale: e.target.value as AccentLocale })}
              style={selectStyle}
            >
              {REGION_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.locales.map(loc => {
                    const p = ACCENT_PROFILES.find(x => x.locale === loc);
                    return p ? (
                      <option key={loc} value={loc}>{p.label}</option>
                    ) : null;
                  })}
                </optgroup>
              ))}
            </select>
          </Row>

          {/* Sub-accent only shown for locales that have regional variants (en-GB/en-US/custom have none) */}
          {showSubAccent && (
            <Row label="Sub-accent">
              <select
                value={value.locale}
                onChange={e => update({ locale: e.target.value as AccentLocale })}
                style={selectStyle}
              >
                {(Object.values(SUB_ACCENT_MAP).flat() as AccentLocale[])
                  .filter(loc => {
                    const prefix = value.locale.substring(0, 5); // "en-NG" | "en-GH" | "en-ZA"
                    return loc.startsWith(prefix);
                  })
                  .map(loc => {
                    const p = ACCENT_PROFILES.find(x => x.locale === loc);
                    return p ? (
                      <option key={loc} value={loc}>{p.subLabel ?? p.label}</option>
                    ) : null;
                  })}
              </select>
            </Row>
          )}

          <Row label="Speaker">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SPEAKER_PROFILES.map(sp => (
                <label key={sp.id} style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    name="speakerProfile"
                    value={sp.id}
                    checked={value.speakerProfile === sp.id}
                    onChange={() => update({ speakerProfile: sp.id as SpeakerProfile })}
                  />
                  {sp.label}
                </label>
              ))}
            </div>
          </Row>

          <Row label="Delivery style">
            <select
              value={value.deliveryStyle}
              onChange={e => update({ deliveryStyle: e.target.value as DeliveryStyle })}
              style={selectStyle}
            >
              {DELIVERY_STYLES.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </Row>

          <Row label="Pacing">
            <div style={{ display: "flex", gap: 10 }}>
              {PACING_OPTIONS.map(p => (
                <label key={p} style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    name="pacing"
                    value={p}
                    checked={value.pacing === p}
                    onChange={() => update({ pacing: p })}
                  />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </label>
              ))}
            </div>
          </Row>

          <Row label="Emotion / energy">
            <select
              value={value.emotion}
              onChange={e => update({ emotion: e.target.value as VoiceEmotion })}
              style={selectStyle}
            >
              {EMOTION_OPTIONS.map(e => (
                <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
              ))}
            </select>
          </Row>

          <Row label="Custom instruction">
            <textarea
              value={value.customInstruction}
              onChange={e => update({ customInstruction: e.target.value })}
              placeholder="Optional: add extra direction e.g. 'Slightly slower on key phrases'"
              rows={2}
              style={{ ...selectStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </Row>

          <Row label="Voice preview">
            <button onClick={handlePreviewVoice} disabled={previewLoading} style={btnStyle}>
              {previewLoading ? "Generating previews…" : "PREVIEW VOICE"}
            </button>

            {previewError && <span style={{ color: "#f87171", fontSize: 12, display: "block", marginTop: 4 }}>{previewError}</span>}

            {previews.length > 0 && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {previews.map(p => (
                    <div key={p.previewId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="radio"
                        name="selectedPreview"
                        checked={selectedPreviewId === p.previewId}
                        onChange={() => setSelectedPreviewId(p.previewId)}
                      />
                      <span style={{ fontSize: 13, minWidth: 80 }}>{p.label}</span>
                      {p.audioUrl ? (
                        <audio controls src={p.audioUrl} style={{ height: 28 }} />
                      ) : (
                        <span style={{ fontSize: 12, color: "#888" }}>(no audio URL)</span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleUseThisVoice}
                  disabled={!selectedPreviewId || savingVoice}
                  style={{ ...btnStyle, background: selectedPreviewId ? "#16a34a" : "#333", marginTop: 6 }}
                >
                  {savingVoice ? "Saving…" : "Use This Voice"}
                </button>
                {generateError && (
                  <span style={{ color: "#f87171", fontSize: 12, display: "block", marginTop: 4 }}>{generateError}</span>
                )}
              </>
            )}

            {matchStatus && (
              <span style={{ fontSize: 12, color: MATCH_STATUS_COLORS[matchStatus], fontWeight: 600, display: "block", marginTop: 4 }}>
                ● {MATCH_STATUS_LABELS[matchStatus]}
              </span>
            )}

            {value.voiceId && (
              <span style={{ fontSize: 12, color: "#a3e635", display: "block", marginTop: 4 }}>
                Voice ID saved: {value.voiceId.slice(0, 16)}…
              </span>
            )}
          </Row>

          <Row label="Voice source">
            {VOICE_SOURCE_OPTIONS.map(src => (
              <label key={src} style={{ fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <input
                  type="radio"
                  name="voiceSource"
                  value={src}
                  checked={value.voiceSource === src}
                  onChange={() => update({ voiceSource: src })}
                />
                {VOICE_SOURCE_LABELS[src]}
              </label>
            ))}

            {value.voiceSource === "library_search" && (
              <div style={{ marginTop: 4 }}>
                <button onClick={handleSearchLibrary} disabled={libraryLoading} style={btnStyle}>
                  {libraryLoading ? "Searching…" : "Search Library"}
                </button>
                {libraryError && <span style={{ color: "#f87171", fontSize: 12, display: "block", marginTop: 4 }}>{libraryError}</span>}
                {libraryVoices.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                    {libraryVoices.map(v => (
                      <div key={v.voiceId} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "6px 8px", border: "1px solid #2a2a2a", borderRadius: 5, background: value.voiceId === v.voiceId ? "#1a1a2e" : "transparent" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="radio"
                            name="libraryVoice"
                            checked={value.voiceId === v.voiceId}
                            onChange={() => update({ voiceId: v.voiceId })}
                          />
                          <span style={{ fontSize: 13 }}>{v.name}</span>
                          {v.labels?.accent && <span style={{ color: "#888", fontSize: 11 }}>· {v.labels.accent}</span>}
                          {v.labels?.gender && <span style={{ color: "#888", fontSize: 11 }}>· {v.labels.gender}</span>}
                        </div>
                        {v.previewUrl && (
                          <audio controls src={v.previewUrl} style={{ height: 26, width: "100%" }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {value.voiceSource === "selected_id" && (
              <input
                type="text"
                value={value.voiceId ?? ""}
                onChange={e => update({ voiceId: e.target.value })}
                placeholder="Paste ElevenLabs Voice ID"
                style={{ ...selectStyle, marginTop: 4 }}
              />
            )}
          </Row>

        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, color: "#888", minWidth: 130, paddingTop: 4 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "#1a1a1a",
  color: "#e5e5e5",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 13,
  width: "100%",
};

const btnStyle: React.CSSProperties = {
  background: "#1d4ed8",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: "6px 14px",
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 600,
};
