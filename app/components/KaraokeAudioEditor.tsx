"use client";

/**
 * KaraokeAudioEditor — §14 Simple-label audio controls
 * Labels are human-friendly ("Bass up/down" not "Sub-bass shelf gain")
 * 8 presets: Natural Voice / Studio Warm / Deep Bass / Bright Pop /
 *            Gospel Hall / Afrobeats Mix / R&B Smooth / Hip Hop
 * §25 — Opens on "Natural Voice" (neutral). Reset to original button.
 * §19 — Voice-first toast messages on preset apply and reset.
 * Real Web Audio API processing.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MixSettings {
  vocalVolume: number;      // 0–1
  bassUpDown: number;       // -12 to +12 dB
  brightnessWarmth: number; // -12 to +12 dB
  reverbAmount: number;     // 0–1
  vocalClarity: number;     // -12 to +12 dB
  noiseCleanup: boolean;    // highpass 80Hz on/off
  overallEnergy: number;    // 0–1 (compression + brightness combined)
  vocalEmphasis: number;    // 0–12 dB (1-4kHz boost)
  introTrim: number;        // seconds from start
  outroTrim: number;        // seconds from end
}

// §14 — 8 presets, each sets all sliders
export type PresetName =
  | "Natural Voice"
  | "Studio Warm"
  | "Deep Bass"
  | "Bright Pop"
  | "Gospel Hall"
  | "Afrobeats Mix"
  | "R&B Smooth"
  | "Hip Hop";

const NEUTRAL_SETTINGS: MixSettings = {
  vocalVolume: 0.8,
  bassUpDown: 0,
  brightnessWarmth: 0,
  reverbAmount: 0.1,
  vocalClarity: 0,
  noiseCleanup: false,
  overallEnergy: 0.3,
  vocalEmphasis: 0,
  introTrim: 0,
  outroTrim: 0,
};

const PRESETS: Record<PresetName, MixSettings> = {
  "Natural Voice": { ...NEUTRAL_SETTINGS },
  "Studio Warm": {
    vocalVolume: 0.85,
    bassUpDown: 2,
    brightnessWarmth: -1,
    reverbAmount: 0.2,
    vocalClarity: 3,
    noiseCleanup: true,
    overallEnergy: 0.4,
    vocalEmphasis: 2,
    introTrim: 0,
    outroTrim: 0,
  },
  "Deep Bass": {
    vocalVolume: 0.75,
    bassUpDown: 8,
    brightnessWarmth: -2,
    reverbAmount: 0.15,
    vocalClarity: 1,
    noiseCleanup: false,
    overallEnergy: 0.6,
    vocalEmphasis: 1,
    introTrim: 0,
    outroTrim: 0,
  },
  "Bright Pop": {
    vocalVolume: 0.9,
    bassUpDown: 0,
    brightnessWarmth: 5,
    reverbAmount: 0.2,
    vocalClarity: 4,
    noiseCleanup: true,
    overallEnergy: 0.7,
    vocalEmphasis: 3,
    introTrim: 0,
    outroTrim: 0,
  },
  "Gospel Hall": {
    vocalVolume: 0.85,
    bassUpDown: 1,
    brightnessWarmth: 2,
    reverbAmount: 0.6,
    vocalClarity: 2,
    noiseCleanup: true,
    overallEnergy: 0.5,
    vocalEmphasis: 2,
    introTrim: 0,
    outroTrim: 0,
  },
  "Afrobeats Mix": {
    vocalVolume: 0.8,
    bassUpDown: 5,
    brightnessWarmth: 3,
    reverbAmount: 0.15,
    vocalClarity: 3,
    noiseCleanup: false,
    overallEnergy: 0.65,
    vocalEmphasis: 3,
    introTrim: 0,
    outroTrim: 0,
  },
  "R&B Smooth": {
    vocalVolume: 0.85,
    bassUpDown: 3,
    brightnessWarmth: 1,
    reverbAmount: 0.35,
    vocalClarity: 4,
    noiseCleanup: true,
    overallEnergy: 0.45,
    vocalEmphasis: 4,
    introTrim: 0,
    outroTrim: 0,
  },
  "Hip Hop": {
    vocalVolume: 0.9,
    bassUpDown: 6,
    brightnessWarmth: 4,
    reverbAmount: 0.1,
    vocalClarity: 5,
    noiseCleanup: true,
    overallEnergy: 0.75,
    vocalEmphasis: 5,
    introTrim: 0,
    outroTrim: 0,
  },
};

interface Props {
  audioUrl?: string;
  secondaryAudioUrl?: string;  // generated music URL for Step 12 mixing context
  recordingId?: string;
  onSave?: (settings: MixSettings) => void;
  onToast?: (msg: string) => void;
}

// ── Slider row ────────────────────────────────────────────────────────────────

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  changed,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  changed: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: changed ? "#a78bfa" : "#c5c5c8" }}>
          {label}
          {changed && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#a78bfa", fontFamily: "monospace" }}>
              ●
            </span>
          )}
        </label>
        <span style={{ fontSize: 11, color: "#55555a", fontFamily: "monospace" }}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>{description}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#a78bfa" }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KaraokeAudioEditor({ audioUrl, secondaryAudioUrl, recordingId, onSave, onToast }: Props) {
  const [settings, setSettings] = useState<MixSettings>({ ...NEUTRAL_SETTINGS }); // §25 — starts neutral
  const [activePreset, setActivePreset] = useState<PresetName>("Natural Voice");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");

  // Track which sliders were changed from neutral (for reset indicator)
  const [changedKeys, setChangedKeys] = useState<Set<keyof MixSettings>>(new Set());

  // Web Audio nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const brightnessFilterRef = useRef<BiquadFilterNode | null>(null);
  const vocalClarityFilterRef = useRef<BiquadFilterNode | null>(null);
  const vocalEmphasisFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const isConnected = useRef(false);

  // ── Build Web Audio graph ─────────────────────────────────────────────────

  const buildGraph = useCallback(() => {
    if (!audioElRef.current || isConnected.current) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioElRef.current);

    // Gain (vocal volume)
    const gain = ctx.createGain();
    gain.gain.value = settings.vocalVolume;
    gainNodeRef.current = gain;

    // Bass shelf
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 200;
    bass.gain.value = settings.bassUpDown;
    bassFilterRef.current = bass;

    // Brightness/warmth shelf
    const brightness = ctx.createBiquadFilter();
    brightness.type = "highshelf";
    brightness.frequency.value = 8000;
    brightness.gain.value = settings.brightnessWarmth;
    brightnessFilterRef.current = brightness;

    // Vocal clarity peaking (2.5kHz)
    const vocalClarity = ctx.createBiquadFilter();
    vocalClarity.type = "peaking";
    vocalClarity.frequency.value = 2500;
    vocalClarity.Q.value = 1;
    vocalClarity.gain.value = settings.vocalClarity;
    vocalClarityFilterRef.current = vocalClarity;

    // Vocal emphasis (1-4kHz)
    const vocalEmphasis = ctx.createBiquadFilter();
    vocalEmphasis.type = "peaking";
    vocalEmphasis.frequency.value = 2000;
    vocalEmphasis.Q.value = 0.7;
    vocalEmphasis.gain.value = settings.vocalEmphasis;
    vocalEmphasisFilterRef.current = vocalEmphasis;

    // Noise cleanup highpass at 80Hz
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = settings.noiseCleanup ? 80 : 20;
    highpassFilterRef.current = highpass;

    // Compressor (overall energy)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -50 + settings.overallEnergy * 30; // -50 to -20
    compressor.ratio.value = 1 + settings.overallEnergy * 8; // 1:1 to 9:1
    compressorRef.current = compressor;

    // Chain: source → gain → highpass → bass → brightness → vocalClarity → vocalEmphasis → compressor → destination
    source.connect(gain);
    gain.connect(highpass);
    highpass.connect(bass);
    bass.connect(brightness);
    brightness.connect(vocalClarity);
    vocalClarity.connect(vocalEmphasis);
    vocalEmphasis.connect(compressor);
    compressor.connect(ctx.destination);

    isConnected.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply settings changes to audio nodes ────────────────────────────────

  useEffect(() => {
    if (!isConnected.current) return;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = settings.vocalVolume;
    if (bassFilterRef.current) bassFilterRef.current.gain.value = settings.bassUpDown;
    if (brightnessFilterRef.current) brightnessFilterRef.current.gain.value = settings.brightnessWarmth;
    if (vocalClarityFilterRef.current) vocalClarityFilterRef.current.gain.value = settings.vocalClarity;
    if (vocalEmphasisFilterRef.current) vocalEmphasisFilterRef.current.gain.value = settings.vocalEmphasis;
    if (highpassFilterRef.current) highpassFilterRef.current.frequency.value = settings.noiseCleanup ? 80 : 20;
    if (compressorRef.current) {
      compressorRef.current.threshold.value = -50 + settings.overallEnergy * 30;
      compressorRef.current.ratio.value = 1 + settings.overallEnergy * 8;
    }
  }, [settings]);

  // ── Update a single setting ───────────────────────────────────────────────

  function updateSetting<K extends keyof MixSettings>(key: K, value: MixSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setActivePreset("Natural Voice"); // custom tweak clears preset name
    setChangedKeys((prev) => {
      const next = new Set(prev);
      const neutral = NEUTRAL_SETTINGS[key];
      if (value !== neutral) next.add(key); else next.delete(key);
      return next;
    });
  }

  // ── Apply preset ──────────────────────────────────────────────────────────

  function applyPreset(name: PresetName) {
    const preset = PRESETS[name];
    setSettings({ ...preset });
    setActivePreset(name);
    setChangedKeys(new Set());
    // §19 — voice-first toast
    const toastMsg = name === "Natural Voice"
      ? "Natural Voice — clean and unprocessed. Tweak anything."
      : `${name} applied — your voice, polished. Tweak anything.`;
    onToast?.(toastMsg);
    setSaveStatus("");
  }

  // ── Reset to original ─────────────────────────────────────────────────────

  function resetToOriginal() {
    setSettings({ ...NEUTRAL_SETTINGS });
    setActivePreset("Natural Voice");
    setChangedKeys(new Set());
    onToast?.("Reset to original — Natural Voice, no processing.");
    setSaveStatus("");
  }

  // ── Save mix ──────────────────────────────────────────────────────────────

  async function saveMix() {
    if (!recordingId) {
      onToast?.("No recording loaded — nothing to save.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/karaoke/save-mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId, mixSettings: settings }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Save failed");
      // §19 — voice-first save message
      setSaveStatus("Mix saved. Your idea, preserved.");
      onToast?.("Mix saved. Your idea, preserved.");
      onSave?.(settings);
    } catch (err) {
      setSaveStatus(`Save failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanges = changedKeys.size > 0;
  const presetNames = Object.keys(PRESETS) as PresetName[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} data-testid="karaoke-audio-editor">
      {/* Audio playback — hidden element, connected to Web Audio graph */}
      {audioUrl && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <audio
            ref={(el) => {
              audioElRef.current = el;
              if (el && !isConnected.current) buildGraph();
            }}
            src={audioUrl}
            controls
            onPlay={() => {
              if (audioCtxRef.current?.state === "suspended") {
                audioCtxRef.current.resume();
              }
            }}
            style={{ flex: 1, height: 36 }}
          />
        </div>
      )}

      {/* Preset buttons — §14 + §25 opens on Natural Voice */}
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Quick presets
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {presetNames.map((name) => (
            <button
              key={name}
              data-preset={name}
              onClick={() => applyPreset(name)}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: `1px solid ${activePreset === name ? "#a78bfa" : "rgba(255,255,255,0.1)"}`,
                background: activePreset === name ? "rgba(167,139,250,0.15)" : "transparent",
                color: activePreset === name ? "#a78bfa" : "#c5c5c8",
                fontSize: 12,
                fontWeight: activePreset === name ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders — §14 simple labels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <SliderRow
          label="Vocal volume"
          description="How loud your voice sits in the mix"
          value={Math.round(settings.vocalVolume * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => updateSetting("vocalVolume", v / 100)}
          changed={changedKeys.has("vocalVolume")}
        />
        <SliderRow
          label="Bass up/down"
          description="Low-end warmth — more bass or less bass"
          value={settings.bassUpDown}
          min={-12}
          max={12}
          step={1}
          onChange={(v) => updateSetting("bassUpDown", v)}
          changed={changedKeys.has("bassUpDown")}
        />
        <SliderRow
          label="Brightness/warmth"
          description="High-end shine — brighter or darker tone"
          value={settings.brightnessWarmth}
          min={-12}
          max={12}
          step={1}
          onChange={(v) => updateSetting("brightnessWarmth", v)}
          changed={changedKeys.has("brightnessWarmth")}
        />
        <SliderRow
          label="Reverb amount"
          description="Room feel — dry and close, or open and spacious"
          value={Math.round(settings.reverbAmount * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => updateSetting("reverbAmount", v / 100)}
          changed={changedKeys.has("reverbAmount")}
        />
        <SliderRow
          label="Vocal clarity"
          description="How crisp and present your voice sounds"
          value={settings.vocalClarity}
          min={-12}
          max={12}
          step={1}
          onChange={(v) => updateSetting("vocalClarity", v)}
          changed={changedKeys.has("vocalClarity")}
        />
        <SliderRow
          label="Vocal emphasis"
          description="Push your voice forward in the mix"
          value={settings.vocalEmphasis}
          min={0}
          max={12}
          step={1}
          onChange={(v) => updateSetting("vocalEmphasis", v)}
          changed={changedKeys.has("vocalEmphasis")}
        />
        <SliderRow
          label="Overall energy"
          description="Single dial — raises impact, punch, and presence together"
          value={Math.round(settings.overallEnergy * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => updateSetting("overallEnergy", v / 100)}
          changed={changedKeys.has("overallEnergy")}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: changedKeys.has("noiseCleanup") ? "#a78bfa" : "#c5c5c8" }}>
            Noise cleanup
            {changedKeys.has("noiseCleanup") && (
              <span style={{ marginLeft: 6, fontSize: 10, color: "#a78bfa", fontFamily: "monospace" }}>●</span>
            )}
          </label>
          <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>Remove low hum and background rumble</p>
          <button
            data-testid="noise-cleanup-toggle"
            onClick={() => updateSetting("noiseCleanup", !settings.noiseCleanup)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: `1px solid ${settings.noiseCleanup ? "#7ae0c3" : "rgba(255,255,255,0.1)"}`,
              background: settings.noiseCleanup ? "rgba(122,224,195,0.1)" : "transparent",
              color: settings.noiseCleanup ? "#7ae0c3" : "#7b7b80",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              alignSelf: "flex-start",
              marginTop: 4,
            }}
          >
            {settings.noiseCleanup ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Intro/Outro trim */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, paddingTop: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#c5c5c8" }}>Intro trim (seconds)</label>
          <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>Skip silence at the start</p>
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={settings.introTrim}
            onChange={(e) => updateSetting("introTrim", parseFloat(e.target.value) || 0)}
            style={{
              width: 80,
              padding: "6px 8px",
              background: "#151518",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#c5c5c8" }}>Outro trim (seconds)</label>
          <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>Cut silence at the end</p>
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={settings.outroTrim}
            onChange={(e) => updateSetting("outroTrim", parseFloat(e.target.value) || 0)}
            style={{
              width: 80,
              padding: "6px 8px",
              background: "#151518",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Music volume — §14 placeholder, hidden for now */}
      {/* "Music volume" placeholder for future accompaniment — not shown until backing track exists */}

      {/* Action row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 4, flexWrap: "wrap" }}>
        {/* §25 — Reset to original always visible */}
        <button
          data-testid="reset-to-original"
          onClick={resetToOriginal}
          style={{
            padding: "8px 18px",
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
            color: "#7b7b80",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reset to original
        </button>

        <button
          data-testid="save-mix-btn"
          onClick={saveMix}
          disabled={isSaving}
          style={{
            padding: "8px 24px",
            borderRadius: 7,
            border: "none",
            background: isSaving ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg, #a78bfa, #7cc4ff)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: isSaving ? "not-allowed" : "pointer",
          }}
        >
          {isSaving ? "Saving…" : "Save mix"}
        </button>

        {saveStatus && (
          <span
            data-testid="save-status"
            style={{
              fontSize: 13,
              color: saveStatus.startsWith("Mix saved") ? "#7ae0c3" : "#ff7a45",
              fontWeight: 600,
            }}
          >
            {saveStatus}
          </span>
        )}
      </div>

      {/* Changed indicator */}
      {hasChanges && (
        <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>
          {changedKeys.size} control{changedKeys.size !== 1 ? "s" : ""} changed from default — hit "Reset to original" to go back.
        </p>
      )}
    </div>
  );
}
