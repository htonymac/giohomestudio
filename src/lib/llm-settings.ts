// GioHomeStudio — LLM settings loader
// Reads API keys from storage/llm-settings.json (set via the dashboard Settings page).
// Falls back to process.env if the file doesn't exist or a key isn't set there.
// File always takes priority over .env so the UI override wins.

import * as fs from "fs";
import * as path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "storage", "llm-settings.json");

export interface LLMSettingsData {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?:    string;
  XAI_API_KEY?:       string;
  LLM_PROVIDER?:      string;   // "claude" | "openai" | "grok" | "ollama" | ""
  OLLAMA_BASE_URL?:   string;
  // Role-based Ollama model assignments
  OLLAMA_MODEL_FAST?:       string;  // default: phi3:latest
  OLLAMA_MODEL_QUALITY?:    string;  // default: qwen2.5:14b
  OLLAMA_MODEL_CREATIVE?:   string;  // default: mistral:latest
  OLLAMA_MODEL_ASSISTANT?:  string;  // default: llama3:latest
  OLLAMA_MODEL_SUPERVISOR?: string;  // default: qwen2.5:14b
  OLLAMA_MODEL_VISION?:     string;  // default: llava:latest (must be a vision-capable model)
  // Media service keys (ElevenLabs, Kling, Runway)
  ELEVENLABS_API_KEY?: string;
  KLING_ACCESS_KEY?:   string;
  KLING_SECRET_KEY?:   string;
  RUNWAY_API_KEY?:     string;
}

let cache: LLMSettingsData | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5_000; // re-read file at most every 5 seconds

export function loadLLMSettings(): LLMSettingsData {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;

  let fileData: LLMSettingsData = {};
  try {
    fileData = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    // File missing or corrupt — fall through to process.env
  }

  // File keys win over process.env (empty string in file = not set, fall back to env)
  const merged: LLMSettingsData = {
    ANTHROPIC_API_KEY:       fileData.ANTHROPIC_API_KEY       || process.env.ANTHROPIC_API_KEY       || "",
    OPENAI_API_KEY:          fileData.OPENAI_API_KEY          || process.env.OPENAI_API_KEY          || "",
    XAI_API_KEY:             fileData.XAI_API_KEY             || process.env.XAI_API_KEY             || "",
    LLM_PROVIDER:            fileData.LLM_PROVIDER            || process.env.LLM_PROVIDER            || "",
    OLLAMA_BASE_URL:         fileData.OLLAMA_BASE_URL         || process.env.OLLAMA_BASE_URL         || "http://localhost:11434",
    OLLAMA_MODEL_FAST:       fileData.OLLAMA_MODEL_FAST       || process.env.OLLAMA_MODEL_FAST       || "phi3:latest",
    OLLAMA_MODEL_QUALITY:    fileData.OLLAMA_MODEL_QUALITY    || process.env.OLLAMA_MODEL_QUALITY    || "qwen2.5:14b",
    OLLAMA_MODEL_CREATIVE:   fileData.OLLAMA_MODEL_CREATIVE   || process.env.OLLAMA_MODEL_CREATIVE   || "mistral:latest",
    OLLAMA_MODEL_ASSISTANT:  fileData.OLLAMA_MODEL_ASSISTANT  || process.env.OLLAMA_MODEL_ASSISTANT  || "llama3:latest",
    OLLAMA_MODEL_SUPERVISOR: fileData.OLLAMA_MODEL_SUPERVISOR || process.env.OLLAMA_MODEL_SUPERVISOR || "qwen2.5:14b",
    OLLAMA_MODEL_VISION:     fileData.OLLAMA_MODEL_VISION     || process.env.OLLAMA_MODEL_VISION     || "llava:latest",
    // Media service keys
    ELEVENLABS_API_KEY: fileData.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || "",
    KLING_ACCESS_KEY:   fileData.KLING_ACCESS_KEY   || process.env.KLING_ACCESS_KEY   || "",
    KLING_SECRET_KEY:   fileData.KLING_SECRET_KEY   || process.env.KLING_SECRET_KEY   || "",
    RUNWAY_API_KEY:     fileData.RUNWAY_API_KEY     || process.env.RUNWAY_API_KEY     || "",
  };

  cache = merged;
  cacheTime = now;
  return merged;
}

export function saveLLMSettings(data: LLMSettingsData): void {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });

  // Load existing to merge (don't overwrite keys that weren't submitted)
  let existing: LLMSettingsData = {};
  try {
    existing = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch { /* file missing or corrupt — start fresh */ }

  const merged = { ...existing, ...data };
  // Remove empty strings (so file-absent = fall back to env)
  for (const key of Object.keys(merged) as (keyof LLMSettingsData)[]) {
    if (merged[key] === "") delete merged[key];
  }

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  cache = null; // invalidate cache
}

export function getLLMSettingsStatus(): Record<string, "configured" | "not_configured"> {
  const s = loadLLMSettings();
  return {
    claude: s.ANTHROPIC_API_KEY ? "configured" : "not_configured",
    openai: s.OPENAI_API_KEY    ? "configured" : "not_configured",
    grok:   s.XAI_API_KEY       ? "configured" : "not_configured",
    ollama: "configured", // always potentially available — may fail at runtime
  };
}
