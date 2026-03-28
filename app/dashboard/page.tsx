"use client";

import { useEffect, useState } from "react";
import type { DestinationPage } from "@/types/content";

export default function StudioPage() {
  const [input, setInput] = useState("");

  // Core controls
  const [duration, setDuration] = useState(5);
  const [videoProvider, setVideoProvider] = useState<"runway" | "kling" | "">("");
  const [videoQuality, setVideoQuality] = useState<"draft" | "standard" | "high">("standard");
  const [aiAutoMode, setAiAutoMode] = useState(true);

  // Style controls
  const [videoType, setVideoType] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [customSubjectDescription, setCustomSubjectDescription] = useState("");

  // Misc
  const [musicMood, setMusicMood] = useState("epic");
  const [destinationPageId, setDestinationPageId] = useState("");
  const [pages, setPages] = useState<DestinationPage[]>([]);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/destination-pages")
      .then((r) => r.json())
      .then((d) => setPages(d.pages ?? []))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!input.trim()) return;
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: input.trim(),
          durationSeconds: duration,
          musicMood,
          aspectRatio: "9:16",
          destinationPageId: destinationPageId || undefined,
          videoProvider: videoProvider || undefined,
          videoQuality,
          videoType: videoType || undefined,
          visualStyle: visualStyle || undefined,
          subjectType: subjectType || undefined,
          customSubjectDescription: subjectType === "custom_character" ? customSubjectDescription || undefined : undefined,
          aiAutoMode,
        }),
      });

      if (res.ok) {
        setStatus("success");
        setMessage("Pipeline started. Your content is being generated. Check the Review tab when ready.");
        setInput("");
      } else {
        const err = await res.json();
        setStatus("error");
        setMessage(err.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Is the server running?");
    }
  }

  const selectCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-600";
  const labelCls = "block text-xs text-gray-400 mb-1 font-medium";

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-white mb-1">Free Mode Studio</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Describe your idea. GioHomeStudio will enhance your prompt and generate a video, voice, and music track.
      </p>

      <div className="space-y-5">

        {/* Idea input */}
        <div>
          <label className={labelCls}>Your idea</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A cat flying off a cliff at golden hour..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none text-sm"
          />
        </div>

        {/* ── Section: Core controls ── */}
        <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Core</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Duration</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={selectCls}>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Video provider</label>
              <select value={videoProvider} onChange={(e) => setVideoProvider(e.target.value as "runway" | "kling" | "")} className={selectCls}>
                <option value="">Auto</option>
                <option value="runway">Runway</option>
                <option value="kling">Kling</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Video quality</label>
              <select value={videoQuality} onChange={(e) => setVideoQuality(e.target.value as "draft" | "standard" | "high")} className={selectCls}>
                <option value="draft">Draft (mock — fast)</option>
                <option value="standard">Standard</option>
                <option value="high">High (10s clip)</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>AI auto mode</label>
              <select value={aiAutoMode ? "on" : "off"} onChange={(e) => setAiAutoMode(e.target.value === "on")} className={selectCls}>
                <option value="on">On — full enhancement</option>
                <option value="off">Off — minimal changes</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Section: Style controls ── */}
        <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Style</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Video type</label>
              <select value={videoType} onChange={(e) => setVideoType(e.target.value)} className={selectCls}>
                <option value="">— Any —</option>
                <option value="cinematic">Cinematic</option>
                <option value="ad_promo">Ad / Promo</option>
                <option value="realistic">Realistic</option>
                <option value="animation">Animation</option>
                <option value="storytelling">Storytelling</option>
                <option value="social_short">Social Short</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Visual style</label>
              <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} className={selectCls}>
                <option value="">— Any —</option>
                <option value="photorealistic">Photorealistic</option>
                <option value="stylized">Stylized</option>
                <option value="anime">Anime</option>
                <option value="3d">3D</option>
                <option value="cinematic_dark">Cinematic Dark</option>
                <option value="bright_commercial">Bright Commercial</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Subject / actor type</label>
              <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)} className={selectCls}>
                <option value="">— Any —</option>
                <option value="human">Human</option>
                <option value="animal">Animal</option>
                <option value="product">Product</option>
                <option value="scene_only">Scene only</option>
                <option value="custom_character">Custom character</option>
              </select>
            </div>

            {subjectType === "custom_character" && (
              <div className="col-span-2 md:col-span-3">
                <label className={labelCls}>Custom character description</label>
                <input
                  type="text"
                  value={customSubjectDescription}
                  onChange={(e) => setCustomSubjectDescription(e.target.value)}
                  placeholder="e.g. a tall woman in red armor with silver hair"
                  maxLength={200}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Section: Misc controls ── */}
        <div className="border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Audio & Destination</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Music mood</label>
              <select value={musicMood} onChange={(e) => setMusicMood(e.target.value)} className={selectCls}>
                <option value="epic">Epic</option>
                <option value="calm">Calm</option>
                <option value="emotional">Emotional</option>
                <option value="upbeat">Upbeat</option>
                <option value="dramatic">Dramatic</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Destination page</label>
              <select value={destinationPageId} onChange={(e) => setDestinationPageId(e.target.value)} className={selectCls}>
                <option value="">— No destination —</option>
                {pages.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.platform}{p.handle ? ` · ${p.handle}` : ""})
                  </option>
                ))}
              </select>
              {pages.length === 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  <a href="/dashboard/destination-pages" className="text-blue-400 hover:text-blue-300">Add a destination page</a>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quality note for draft mode */}
        {videoQuality === "draft" && (
          <p className="text-xs text-yellow-600 bg-yellow-950/30 border border-yellow-900/40 rounded-lg px-3 py-2">
            Draft mode — real video provider is skipped. Mock video used. No API credits consumed.
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={status === "loading" || !input.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors text-sm"
        >
          {status === "loading" ? "Generating..." : "Generate Content"}
        </button>

        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm ${
            status === "success"
              ? "bg-green-900/40 text-green-300 border border-green-800"
              : "bg-red-900/40 text-red-300 border border-red-800"
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
