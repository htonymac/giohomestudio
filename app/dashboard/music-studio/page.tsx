"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import SFXPicker from "../../components/SFXPicker";

interface StockTrack {
  filename: string;
  label: string;
  mood: string;
}

export default function MusicStudioPage() {
  const [tab, setTab] = useState<"generate" | "library" | "sfx" | "dj" | "upload">("generate");
  // DJ Tools state
  const [djTrack, setDjTrack] = useState("");
  const [djStart, setDjStart] = useState(0);
  const [djEnd, setDjEnd] = useState(10);
  const [djFadeIn, setDjFadeIn] = useState(0.5);
  const [djFadeOut, setDjFadeOut] = useState(0.5);
  const [djVolume, setDjVolume] = useState(1);
  const [djLoop, setDjLoop] = useState(false);
  const [djLoopCount, setDjLoopCount] = useState(2);
  const [djProcessing, setDjProcessing] = useState(false);
  const [djResult, setDjResult] = useState<{ outputPath?: string; error?: string } | null>(null);
  const [tracks, setTracks] = useState<StockTrack[]>([]);
  const [loading, setLoading] = useState(false);

  // AI Generate state
  const [genPrompt, setGenPrompt] = useState("");
  const [genResult, setGenResult] = useState<{ musicPath?: string; source?: string; error?: string; note?: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  // SFX state
  const [sfxPrompt, setSfxPrompt] = useState("");
  const [sfxResult, setSfxResult] = useState<{ sfxPath?: string; error?: string; matched?: string } | null>(null);
  const [sfxGenerating, setSfxGenerating] = useState(false);

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/music/library").then(r => r.json()).then(d => setTracks(d.tracks ?? []));
  }, []);

  function playTrack(path: string) {
    if (playing === path) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      setPlaying(path);
    }
  }

  async function handleGenerate() {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: genPrompt }),
      });
      setGenResult(await res.json());
    } catch { setGenResult({ error: "Network error" }); }
    setGenerating(false);
  }

  async function handleSfxGenerate() {
    if (!sfxPrompt.trim()) return;
    setSfxGenerating(true);
    setSfxResult(null);
    try {
      const res = await fetch("/api/sfx/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: sfxPrompt }),
      });
      setSfxResult(await res.json());
    } catch { setSfxResult({ error: "Network error" }); }
    setSfxGenerating(false);
  }

  const MOODS = [...new Set(tracks.map(t => t.mood))];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🎵 Music & Audio Studio</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Generate, browse, trim, and mix audio for your content</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "generate" as const, label: "AI Generate", icon: "🎵" },
          { id: "library" as const, label: "Stock Library", icon: "📚" },
          { id: "sfx" as const, label: "Sound Effects", icon: "💥" },
          { id: "dj" as const, label: "DJ Tools", icon: "🎧" },
          { id: "upload" as const, label: "Upload", icon: "⬆️" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-[#7c5cfc] text-white" : "bg-[#1a1a2e] text-[#6060a0] hover:text-white"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Hidden audio player */}
      {playing && (
        <audio ref={audioRef} src={`/api/media/${playing.replace(/\\/g, "/").replace(/^storage\//, "")}`} autoPlay onEnded={() => setPlaying(null)} />
      )}

      {/* AI Generate Tab */}
      {tab === "generate" && (
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">AI Music Generator</h2>
            <p className="text-xs text-[#6060a0]">Describe the mood, genre, and energy — AI generates an original track you own commercially.</p>
          </div>
          <textarea
            value={genPrompt}
            onChange={e => setGenPrompt(e.target.value)}
            placeholder="e.g. Afrobeats energy, upbeat, 60 seconds, perfect for property ad reel..."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-600 resize-none"
          />
          <button
            disabled={generating || !genPrompt.trim()}
            onClick={handleGenerate}
            className="px-6 py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
          >
            {generating ? "Generating..." : "Generate Music"}
          </button>
          {genResult && (
            <div className={`p-3 rounded-lg text-xs ${genResult.error ? "bg-red-950/40 text-red-400" : "bg-green-950/40 text-green-400"}`}>
              {genResult.error ? genResult.error : (
                <>
                  <p>Track matched: {genResult.musicPath?.split(/[\\/]/).pop()}</p>
                  <p className="text-[#6060a0] mt-1">{genResult.note}</p>
                  {genResult.musicPath && (
                    <button onClick={() => playTrack(genResult.musicPath!)} className="mt-2 text-[#7c5cfc] underline">
                      {playing === genResult.musicPath ? "⏸ Stop" : "▶ Preview"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stock Library Tab */}
      {tab === "library" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-[#6060a0] py-1">Filter:</span>
            {MOODS.map(m => (
              <button key={m} className="text-[10px] bg-[#1a1a2e] text-[#6060a0] hover:text-white px-2.5 py-1 rounded border border-[#2a2a40] transition-colors capitalize">
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {tracks.map(t => (
              <div key={t.filename} className="bg-[#12121e] border border-[#2a2a40] rounded-lg p-3 flex items-center gap-3 hover:border-[#7c5cfc]/40 transition-colors">
                <button
                  onClick={() => playTrack(`storage/music/stock/${t.filename}`)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#7c5cfc]/20 text-[#b090ff] hover:bg-[#7c5cfc]/30 text-sm flex-shrink-0"
                >
                  {playing === `storage/music/stock/${t.filename}` ? "⏸" : "▶"}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white font-medium truncate">{t.label}</p>
                  <p className="text-[9px] text-[#6060a0] capitalize">{t.mood}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SFX Tab */}
      {tab === "sfx" && (
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Sound Effects</h2>
            <p className="text-xs text-[#6060a0]">Describe the sound you need — AI finds or generates it.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={sfxPrompt}
              onChange={e => setSfxPrompt(e.target.value)}
              placeholder="e.g. crowd applause, door slam, car horn, rain..."
              className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-600"
            />
            <button
              disabled={sfxGenerating || !sfxPrompt.trim()}
              onClick={handleSfxGenerate}
              className="px-5 py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
            >
              {sfxGenerating ? "..." : "Find SFX"}
            </button>
          </div>
          {sfxResult && (
            <div className={`p-3 rounded-lg text-xs ${sfxResult.error ? "bg-orange-950/40 text-orange-400" : "bg-green-950/40 text-green-400"}`}>
              {sfxResult.error ?? `Found: ${sfxResult.matched}`}
              {sfxResult.sfxPath && (
                <button onClick={() => playTrack(sfxResult.sfxPath!)} className="ml-3 text-[#7c5cfc] underline">
                  {playing === sfxResult.sfxPath ? "⏸ Stop" : "▶ Preview"}
                </button>
              )}
            </div>
          )}

          {/* Full SFX Library — browse, preview, use */}
          <div className="pt-4 border-t border-[#2a2a40]">
            <p className="text-xs font-semibold text-[#b090ff] mb-3">Full SFX Library ({48} effects — click to preview)</p>
            <SFXPicker onSelect={(event, path) => { playTrack(path); }} />
          </div>
        </div>
      )}

      {/* DJ Tools Tab */}
      {tab === "dj" && (
        <div className="space-y-4">
          {/* Trimmer */}
          <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Audio Trimmer & Editor</h2>
              <p className="text-xs text-[#6060a0]">Set start/end points, add fades, adjust volume, loop sections.</p>
            </div>

            <div>
              <label className="text-[10px] text-[#6060a0] uppercase tracking-wider block mb-1">Select track</label>
              <select value={djTrack} onChange={e => setDjTrack(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2">
                <option value="">Choose a stock track...</option>
                {tracks.map(t => (
                  <option key={t.filename} value={`storage/music/stock/${t.filename}`}>{t.label} ({t.mood})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-[#6060a0] block mb-1">Start (sec)</label>
                <input type="number" min={0} step={0.1} value={djStart} onChange={e => setDjStart(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="text-[10px] text-[#6060a0] block mb-1">End (sec)</label>
                <input type="number" min={0.1} step={0.1} value={djEnd} onChange={e => setDjEnd(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="text-[10px] text-[#6060a0] block mb-1">Fade In (sec)</label>
                <input type="number" min={0} max={5} step={0.1} value={djFadeIn} onChange={e => setDjFadeIn(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="text-[10px] text-[#6060a0] block mb-1">Fade Out (sec)</label>
                <input type="number" min={0} max={5} step={0.1} value={djFadeOut} onChange={e => setDjFadeOut(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#6060a0] block mb-1">Volume: {(djVolume * 100).toFixed(0)}%</label>
                <input type="range" min={0} max={2} step={0.05} value={djVolume} onChange={e => setDjVolume(Number(e.target.value))} className="w-full accent-[#7c5cfc]" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-[#6060a0]">
                  <input type="checkbox" checked={djLoop} onChange={e => setDjLoop(e.target.checked)} className="accent-[#7c5cfc]" />
                  Loop
                </label>
                {djLoop && (
                  <input type="number" min={2} max={10} value={djLoopCount} onChange={e => setDjLoopCount(Number(e.target.value))} className="w-16 bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1" />
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                disabled={!djTrack || djProcessing}
                onClick={async () => {
                  setDjProcessing(true);
                  setDjResult(null);
                  try {
                    const res = await fetch("/api/music/trim", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        inputPath: djTrack,
                        startSec: djStart,
                        endSec: djEnd,
                        fadeInSec: djFadeIn,
                        fadeOutSec: djFadeOut,
                        volume: djVolume,
                        loop: djLoop,
                        loopCount: djLoopCount,
                      }),
                    });
                    setDjResult(await res.json());
                  } catch { setDjResult({ error: "Network error" }); }
                  setDjProcessing(false);
                }}
                className="px-6 py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
              >
                {djProcessing ? "Processing..." : "Trim & Export"}
              </button>
              {djTrack && (
                <button onClick={() => playTrack(djTrack)} className="px-4 py-2.5 bg-gray-800 text-gray-300 hover:text-white rounded-xl text-sm transition-colors">
                  {playing === djTrack ? "⏸ Stop" : "▶ Preview"}
                </button>
              )}
            </div>

            {djResult && (
              <div className={`p-3 rounded-lg text-xs ${djResult.error ? "bg-red-950/40 text-red-400" : "bg-green-950/40 text-green-400"}`}>
                {djResult.error ?? `Exported: ${djResult.outputPath}`}
                {djResult.outputPath && (
                  <button onClick={() => playTrack(djResult.outputPath!)} className="ml-3 text-[#7c5cfc] underline">
                    {playing === djResult.outputPath ? "⏸ Stop" : "▶ Preview result"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Waveform & Beat Visualizer */}
          <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Waveform & Beat Visualizer</h2>
              <p className="text-xs text-[#6060a0]">Visual waveform with beat detection — select a track above to visualize.</p>
            </div>
            <WaveformVisualizer trackPath={djTrack} playing={playing} />
          </div>

          {/* Mixer — Live Preview */}
          <LiveMixer tracks={tracks} />
        </div>
      )}

      {/* Upload Tab */}
      {tab === "upload" && (
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Upload Your Own Music</h2>

          <div className="border-2 border-dashed border-[#3a3a60] rounded-xl p-8 text-center hover:border-[#7c5cfc] transition-colors cursor-pointer">
            <p className="text-[#6060a0] text-sm mb-2">Drag & drop audio files here</p>
            <p className="text-[#404060] text-xs">Supports MP3, WAV, AAC</p>
          </div>

          {/* Legal disclaimer */}
          <div className="bg-[#0a0a18] border border-[#1a1a2e] rounded-lg p-4">
            <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2">Music & Audio Upload Policy</p>
            <div className="text-[9px] text-[#8080b0] space-y-1.5 leading-relaxed">
              <p>By uploading audio to GioHomeStudio, you confirm that:</p>
              <p className="text-green-400/70">✅ You own the rights to this music, OR</p>
              <p className="text-green-400/70">✅ You have a valid license to use it commercially, OR</p>
              <p className="text-green-400/70">✅ The music is royalty-free or in the public domain</p>
              <p className="mt-2">GioHomeStudio does not allow:</p>
              <p className="text-red-400/70">❌ Copyrighted songs from Spotify, Apple Music, YouTube, or any commercial platform</p>
              <p className="text-red-400/70">❌ Music owned by record labels or publishers without a valid sync and master license</p>
              <p className="text-red-400/70">❌ Any audio you do not have rights to use commercially</p>
              <p className="mt-2 text-[#6060a0]">
                GioHomeStudio is not responsible for copyright violations resulting from music uploaded by users. Users are solely responsible for ensuring they have the necessary rights to all audio they upload and use on this platform.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Waveform & Beat Visualizer ───────────────────────────────────────────────

function WaveformVisualizer({ trackPath, playing }: { trackPath: string; playing: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [beats, setBeats] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const animRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const analyzeTrack = useCallback(async (path: string) => {
    if (!path) return;
    setLoading(true);
    try {
      const url = `/api/media/${path.replace(/\\/g, "/").replace(/^storage\//, "")}`;
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const audio = await ctx.decodeAudioData(buf);
      const channel = audio.getChannelData(0);
      setDuration(audio.duration);

      // Downsample to ~800 points for waveform display
      const samples = 800;
      const blockSize = Math.floor(channel.length / samples);
      const wave = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channel[start + j] ?? 0);
        }
        wave[i] = sum / blockSize;
      }
      setWaveform(wave);

      // Simple beat detection: find energy peaks
      const beatBlockSize = Math.floor(audio.sampleRate * 0.02); // 20ms blocks
      const energyBlocks: number[] = [];
      for (let i = 0; i < channel.length; i += beatBlockSize) {
        let energy = 0;
        for (let j = 0; j < beatBlockSize && i + j < channel.length; j++) {
          energy += channel[i + j] * channel[i + j];
        }
        energyBlocks.push(energy / beatBlockSize);
      }

      // Find local maxima above average energy * 1.5
      const avgEnergy = energyBlocks.reduce((a, b) => a + b, 0) / energyBlocks.length;
      const threshold = avgEnergy * 1.5;
      const detectedBeats: number[] = [];
      let lastBeat = -10;
      for (let i = 1; i < energyBlocks.length - 1; i++) {
        if (energyBlocks[i] > threshold &&
            energyBlocks[i] > energyBlocks[i - 1] &&
            energyBlocks[i] > energyBlocks[i + 1] &&
            i - lastBeat > 10) { // min 200ms between beats
          detectedBeats.push((i * beatBlockSize) / audio.sampleRate);
          lastBeat = i;
        }
      }
      setBeats(detectedBeats);
      ctx.close();
    } catch { /* ignore decode errors */ }
    setLoading(false);
  }, []);

  useEffect(() => { analyzeTrack(trackPath); }, [trackPath, analyzeTrack]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    function draw() {
      if (!ctx || !waveform) return;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += h / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Beat markers
      ctx.strokeStyle = "#7c5cfc40";
      ctx.lineWidth = 1;
      for (const beat of beats) {
        const x = (beat / duration) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        // Beat dot
        ctx.fillStyle = "#7c5cfc";
        ctx.beginPath();
        ctx.arc(x, 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Waveform bars
      const barWidth = w / waveform.length;
      const maxVal = Math.max(...Array.from(waveform)) || 1;
      for (let i = 0; i < waveform.length; i++) {
        const val = waveform[i] / maxVal;
        const barH = val * (h * 0.8);
        const x = i * barWidth;

        // Gradient color based on amplitude
        const intensity = Math.floor(val * 255);
        ctx.fillStyle = `rgb(${100 + intensity * 0.3}, ${80 + intensity * 0.2}, ${252})`;
        ctx.fillRect(x, mid - barH / 2, Math.max(barWidth - 0.5, 0.5), barH);
      }

      // Playback position indicator (if this track is playing)
      if (playing === trackPath) {
        const elapsed = (performance.now() / 1000) % duration;
        const px = (elapsed / duration) * w;
        ctx.strokeStyle = "#00ddb5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [waveform, beats, duration, playing, trackPath]);

  if (!trackPath) {
    return (
      <div className="h-32 flex items-center justify-center border border-dashed border-[#2a2a40] rounded-lg">
        <p className="text-xs text-[#404060]">Select a track above to see its waveform</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center bg-[#0a0a18] rounded-lg">
        <p className="text-xs text-[#6060a0]">Analyzing waveform...</p>
      </div>
    );
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        className="w-full rounded-lg"
        style={{ background: "#0a0a18", border: "1px solid #1a1a2e" }}
      />
      {beats.length > 0 && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-[#6060a0]">{beats.length} beats detected</span>
          <span className="text-[10px] text-[#404060]">|</span>
          <span className="text-[10px] text-[#6060a0]">~{duration > 0 ? Math.round(beats.length / (duration / 60)) : 0} BPM</span>
          <span className="text-[10px] text-[#404060]">|</span>
          <span className="text-[10px] text-[#6060a0]">{duration.toFixed(1)}s duration</span>
          {/* Beat pattern indicator */}
          <div className="flex gap-0.5 ml-auto">
            {beats.slice(0, 32).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-3 rounded-sm"
                style={{
                  background: i % 4 === 0 ? "#7c5cfc" : i % 2 === 0 ? "#5c3cdc80" : "#3a2a8060",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live Mixer ───────────────────────────────────────────────────────────────

interface MixerLayer { track: string; volume: number; pan: number; audio: HTMLAudioElement | null; }

function LiveMixer({ tracks }: { tracks: { filename: string; label: string; mood: string }[] }) {
  const [layers, setLayers] = useState<MixerLayer[]>([
    { track: "", volume: 1, pan: 0, audio: null },
    { track: "", volume: 1, pan: 0, audio: null },
    { track: "", volume: 1, pan: 0, audio: null },
  ]);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mixExporting, setMixExporting] = useState(false);
  const [mixResult, setMixResult] = useState<{ outputPath?: string; error?: string } | null>(null);
  const LABELS = ["Layer 1 — Music", "Layer 2 — SFX / Ambience", "Layer 3 — Voice / Riser"];

  function updateMix(i: number, patch: Partial<MixerLayer>) {
    setLayers(prev => { const n = [...prev]; n[i] = { ...n[i], ...patch }; return n; });
  }
  function pickTrack(i: number, tp: string) {
    if (layers[i].audio) { layers[i].audio!.pause(); layers[i].audio!.src = ""; }
    if (!tp) { updateMix(i, { track: "", audio: null }); return; }
    const a = new Audio(`/api/media/${tp.replace(/\\/g, "/").replace(/^storage\//, "")}`);
    a.loop = true; a.volume = layers[i].volume;
    if (isPlaying) a.play();
    updateMix(i, { track: tp, audio: a });
  }
  function togglePlay() {
    if (isPlaying) { layers.forEach(l => l.audio?.pause()); setIsPlaying(false); }
    else { layers.forEach(l => { if (l.audio && l.track) { l.audio.volume = Math.min(1, l.volume); l.audio.play(); } }); setIsPlaying(true); }
  }
  function stopAll() { layers.forEach(l => { if (l.audio) { l.audio.pause(); l.audio.currentTime = 0; } }); setIsPlaying(false); }
  async function doExport() {
    const active = layers.filter(l => l.track);
    if (!active.length) return;
    setMixExporting(true); setMixResult(null);
    try {
      const r = await fetch("/api/music/layer", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: active.map(l => ({ path: l.track, volume: l.volume, pan: l.pan })), eq: { bass, mid, treble } }) });
      setMixResult(await r.json());
    } catch { setMixResult({ error: "Network error" }); }
    setMixExporting(false);
  }

  return (
    <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-white mb-0.5">Sound Layering (Mini DJ)</h2>
          <p className="text-xs text-[#6060a0]">Mix up to 3 tracks — hear changes live as you adjust volume and layers.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={togglePlay} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isPlaying ? "bg-orange-600 hover:bg-orange-500 text-white" : "bg-[#7c5cfc] hover:bg-[#9070ff] text-white"}`}>
            {isPlaying ? "⏸ Pause" : "▶ Preview Mix"}
          </button>
          {isPlaying && <button onClick={stopAll} className="px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:text-white">⏹ Stop</button>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {LABELS.map((label, i) => (
          <div key={i} className="bg-[#0a0a18] border border-[#1a1a2e] rounded-lg p-3">
            <p className="text-[10px] text-[#7c5cfc] font-semibold mb-2">{label}</p>
            <select value={layers[i].track} onChange={e => pickTrack(i, e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-gray-400 text-[10px] rounded px-2 py-1.5 mb-2">
              <option value="">Select track...</option>
              {tracks.map(t => <option key={t.filename} value={`storage/music/stock/${t.filename}`}>{t.label} ({t.mood})</option>)}
            </select>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#404060] w-6">Vol</span>
                <input type="range" min={0} max={2} step={0.05} value={layers[i].volume}
                  onChange={e => { const v = Number(e.target.value); updateMix(i, { volume: v }); if (layers[i].audio) layers[i].audio!.volume = Math.min(1, v); }}
                  className="flex-1 accent-[#7c5cfc] h-1" />
                <span className="text-[8px] text-[#404060] w-8 text-right">{Math.round(layers[i].volume * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#404060] w-6">Pan</span>
                <input type="range" min={-1} max={1} step={0.1} value={layers[i].pan} onChange={e => updateMix(i, { pan: Number(e.target.value) })}
                  className="flex-1 accent-[#7c5cfc] h-1" />
                <span className="text-[8px] text-[#404060] w-8 text-right">{layers[i].pan === 0 ? "C" : layers[i].pan < 0 ? `L${Math.abs(Math.round(layers[i].pan * 100))}` : `R${Math.round(layers[i].pan * 100)}`}</span>
              </div>
            </div>
            {layers[i].track && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => { if (layers[i].audio) { if (layers[i].audio!.paused) layers[i].audio!.play(); else layers[i].audio!.pause(); } }} className="text-[9px] text-[#7c5cfc] hover:text-white">Solo</button>
                <button onClick={() => { if (layers[i].audio) layers[i].audio!.volume = 0; }} className="text-[9px] text-[#f87171] hover:text-white">Mute</button>
                <button onClick={() => { if (layers[i].audio) layers[i].audio!.volume = Math.min(1, layers[i].volume); }} className="text-[9px] text-[#4ade80] hover:text-white">Unmute</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[#2a2a40]">
        <p className="text-[10px] text-[#6060a0] font-semibold mb-2">Master EQ (applied on export)</p>
        <div className="grid grid-cols-3 gap-3">
          {[{ l: "Bass (100Hz)", v: bass, s: setBass }, { l: "Mid (1kHz)", v: mid, s: setMid }, { l: "Treble (8kHz)", v: treble, s: setTreble }].map(eq => (
            <div key={eq.l} className="flex items-center gap-2">
              <span className="text-[9px] text-[#404060] w-16">{eq.l}</span>
              <input type="range" min={-10} max={10} step={1} value={eq.v} onChange={e => eq.s(Number(e.target.value))} className="flex-1 accent-[#7c5cfc] h-1" />
              <span className="text-[8px] text-[#404060] w-6 text-right">{eq.v > 0 ? "+" : ""}{eq.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={doExport} disabled={mixExporting || layers.every(l => !l.track)}
          className="px-6 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">
          {mixExporting ? "Mixing..." : "Mix & Export"}
        </button>
      </div>
      {mixResult && (
        <div className={`mt-2 p-3 rounded-lg text-xs ${mixResult.error ? "bg-red-950/40 text-red-400" : "bg-green-950/40 text-green-400"}`}>
          {mixResult.error ?? `Mixed: ${mixResult.outputPath}`}
        </div>
      )}
    </div>
  );
}
