"use client";

import { useState } from "react";

export default function StudioPage() {
  const [input, setInput] = useState("");
  const [duration, setDuration] = useState(5);
  const [musicMood, setMusicMood] = useState("epic");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Free Mode Studio</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Type anything. GioHomeStudio will enhance your prompt and generate a video, voice, and music track.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Your idea</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A cat flying off a cliff at golden hour..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duration (seconds)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Music mood</label>
            <select
              value={musicMood}
              onChange={(e) => setMusicMood(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            >
              <option value="epic">Epic</option>
              <option value="calm">Calm</option>
              <option value="emotional">Emotional</option>
              <option value="upbeat">Upbeat</option>
              <option value="dramatic">Dramatic</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={status === "loading" || !input.trim()}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
        >
          {status === "loading" ? "Generating..." : "Generate Content"}
        </button>

        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              status === "success"
                ? "bg-green-900/40 text-green-300 border border-green-800"
                : "bg-red-900/40 text-red-300 border border-red-800"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
