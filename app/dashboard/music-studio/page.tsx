"use client";

import { useEffect, useState, useRef } from "react";

interface StockTrack {
  filename: string;
  label: string;
  mood: string;
}

export default function MusicStudioPage() {
  const [tab, setTab] = useState<"generate" | "library" | "sfx" | "upload">("generate");
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
      <h1 className="text-2xl font-bold text-white mb-2">Music & Audio Studio</h1>
      <p className="text-sm text-[#6060a0] mb-6">Generate, browse, trim, and mix audio for your content</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "generate" as const, label: "AI Generate", icon: "🎵" },
          { id: "library" as const, label: "Stock Library", icon: "📚" },
          { id: "sfx" as const, label: "Sound Effects", icon: "💥" },
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

          {/* Built-in SFX categories */}
          <div className="pt-4 border-t border-[#2a2a40]">
            <p className="text-xs font-semibold text-[#b090ff] mb-3">Built-in SFX Pack (Royalty Free)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["Crowd Applause", "Beat Drop", "Riser", "Swoosh", "Door Slam", "Car Horn", "Thunder", "Rain", "Market Noise", "Talking Drum", "Bell", "Wind"].map(sfx => (
                <div key={sfx} className="text-[10px] text-[#6060a0] bg-[#0a0a18] border border-[#1a1a2e] rounded px-2.5 py-2 text-center">
                  {sfx}
                </div>
              ))}
            </div>
          </div>
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
