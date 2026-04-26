// POST /api/hybrid/analyze-character
// AI vision analysis of a character image — returns structured visual identity properties.
//
// Flow:
//   1. Receive imageUrl (local /api/media/... or external http)
//   2. Fetch image server-side → convert to base64 (local URLs can't be reached by cloud AI)
//   3. Send to Claude vision (primary) → GPT-4o vision (fallback) → text-only LLM (last resort)
//   4. Parse structured JSON: species, bodyBuild, colorDescription, faceFeatures, clothing, etc.
//   5. Client receives these and auto-fills the Visual Identity Builder form
//
// This is how a novice user's uploaded character image becomes a fully described
// character that generates consistent scenes without any manual typing.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import * as fs from "fs";
import { loadLLMSettings } from "@/lib/llm-settings";

// ── Structured result shape ──────────────────────────────────────────────────
export interface CharacterVisualAnalysis {
  species: string;          // "rabbit", "human", "lion", "dog", "cat", "dragon"...
  bodyBuild: string;        // "large and stocky with big round belly", "slim and tall"...
  colorDescription: string; // "warm grey fur with white belly", "dark brown skin"...
  faceFeatures: string;     // "round spectacles, kind brown eyes, big round nose"...
  clothingDetails: string;  // "brown leather vest with brass buttons, brown belt"...
  accessories: string;      // "wooden walking cane, small satchel bag"...
  distinctiveFeatures: string; // "very big round belly, fluffy white tail, long floppy ears"...
  ageAppearance: string;    // "elderly, slightly hunched, wise expression"...
  suggestedRole: string;    // "protagonist", "elder", "supporting"...
  gender: string;           // "male", "female", "unknown"
  confidence: "high" | "medium" | "low";
}

// ── Vision prompt ──────────────────────────────────────────────────────────
const VISION_PROMPT = `You are a character description expert for an AI animation studio.
Analyze this character image and return ONLY a JSON object with these exact fields.
Be specific and detailed — your description will be used to generate consistent scenes.

{
  "species": "what type of character (rabbit, human, lion, cartoon dog, etc.)",
  "bodyBuild": "body shape and size description (large round belly, slim and tall, small and petite, etc.)",
  "colorDescription": "fur/skin/body color — be specific (warm grey fur with white belly, dark brown skin with warm undertones, etc.)",
  "faceFeatures": "face, eyes, nose, ears, and any glasses or facial features",
  "clothingDetails": "exactly what they are wearing — every item of clothing",
  "accessories": "any accessories, props, bags, weapons, jewellery",
  "distinctiveFeatures": "the most unique things about this character that MUST appear in every drawing",
  "ageAppearance": "how old they look and their posture (elderly and hunched, young and energetic, etc.)",
  "suggestedRole": "what role this character likely plays: protagonist, antagonist, supporting, narrator, elder, child, comic_relief",
  "gender": "male, female, or unknown",
  "confidence": "high, medium, or low — how clearly you could see the character"
}

Rules:
- If something is not visible, write "not visible" not empty string
- Be as specific as possible about colors, textures, clothing details
- Return ONLY the JSON object — no markdown, no explanation, no code fences`;

// ── Fetch image and convert to base64 ───────────────────────────────────────
// Handles three formats:
//   1. Absolute filesystem path (C:\...\storage\images\xxx.png) → read file directly
//   2. Relative /api/media/... URL → fetch via localhost
//   3. Full http(s) URL → fetch directly
async function imageUrlToBase64(
  imageUrl: string,
  baseUrl: string
): Promise<{ base64: string; mediaType: string } | null> {
  const guessMediaType = (src: string): string => {
    if (src.endsWith(".png")) return "image/png";
    if (src.endsWith(".gif")) return "image/gif";
    if (src.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  };

  try {
    // ── Case 1: local filesystem path ─────────────────────────────────────
    // Detect Windows absolute path (C:\...) or Unix /home/... or ./relative
    const isLocalPath = /^[a-zA-Z]:[\\\/]/.test(imageUrl)
      || imageUrl.startsWith("/home/")
      || imageUrl.startsWith("/var/")
      || imageUrl.startsWith("/tmp/")
      || (imageUrl.startsWith("/") && !imageUrl.startsWith("/api/"));

    if (isLocalPath) {
      if (!fs.existsSync(imageUrl)) return null;
      const buf = fs.readFileSync(imageUrl);
      return { base64: buf.toString("base64"), mediaType: guessMediaType(imageUrl) };
    }

    // ── Case 2 & 3: URL (relative or absolute) ────────────────────────────
    const fullUrl = imageUrl.startsWith("http") ? imageUrl : `${baseUrl}${imageUrl}`;
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const mediaType = contentType.includes("png") ? "image/png"
      : contentType.includes("gif") ? "image/gif"
      : contentType.includes("webp") ? "image/webp"
      : "image/jpeg";

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { base64, mediaType };
  } catch {
    return null;
  }
}

// ── Parse JSON from LLM response (handles markdown fences etc.) ────────────
function parseAnalysis(text: string): CharacterVisualAnalysis | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Validate required fields are present
    if (typeof parsed.species === "string" && typeof parsed.colorDescription === "string") {
      return parsed as CharacterVisualAnalysis;
    }
  } catch {
    // Try to extract JSON object from within the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as CharacterVisualAnalysis;
      } catch { /* fall through */ }
    }
  }
  return null;
}

// ── Claude vision call ────────────────────────────────────────────────────
async function analyzeWithClaude(
  base64: string,
  mediaType: string
): Promise<CharacterVisualAnalysis | null> {
  const key = loadLLMSettings().ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // fast + cheap vision model
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
          },
          { type: "text", text: VISION_PROMPT },
        ],
      }],
    });
    const text = (msg.content[0] as { type: string; text: string })?.text ?? "";
    return parseAnalysis(text);
  } catch {
    return null;
  }
}

// ── GPT-4o vision call (fallback) ────────────────────────────────────────
async function analyzeWithGPT(
  base64: string,
  mediaType: string
): Promise<CharacterVisualAnalysis | null> {
  const key = loadLLMSettings().OPENAI_API_KEY;
  if (!key) return null;

  try {
    const client = new OpenAI({ apiKey: key });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini", // vision-capable and cheap
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${base64}`, detail: "high" },
          },
          { type: "text", text: VISION_PROMPT },
        ],
      }],
    });
    const text = res.choices[0]?.message?.content ?? "";
    return parseAnalysis(text);
  } catch {
    return null;
  }
}

// ── Ollama local vision call ──────────────────────────────────────────────
// Checks Ollama connectivity ONCE (2s timeout) then loops only over installed vision models.
// If Ollama is not running, returns null immediately — no multi-second hang.
async function analyzeWithOllama(
  base64: string,
  _mediaType: string
): Promise<CharacterVisualAnalysis | null> {
  const settings = loadLLMSettings();
  const ollamaBase = settings.OLLAMA_BASE_URL || "http://localhost:11434";

  // ── Single connectivity + model list check ──────────────────────────────
  let availableModels: string[] = [];
  try {
    const listRes = await fetch(`${ollamaBase}/api/tags`, {
      signal: AbortSignal.timeout(2000), // fast fail — don't hold up Claude/GPT fallback
    });
    if (!listRes.ok) return null;
    const listData = await listRes.json();
    availableModels = (listData.models || []).map((m: { name: string }) => m.name as string);
  } catch {
    return null; // Ollama not running — skip immediately
  }

  if (availableModels.length === 0) return null;

  // ── Pick first available vision model ───────────────────────────────────
  const preferred = settings.OLLAMA_MODEL_VISION
    ? [settings.OLLAMA_MODEL_VISION]
    : ["llava", "llava-llama3", "moondream", "bakllava"];

  const modelToUse = preferred.find(p =>
    availableModels.some(m => m.startsWith(p))
  );
  if (!modelToUse) return null; // no vision model installed

  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelToUse,
        stream: false,
        messages: [{
          role: "user",
          content: VISION_PROMPT,
          images: [base64],
        }],
        options: { temperature: 0.2, num_predict: 800 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = (data?.message?.content ?? "").trim();
    if (!text) return null;

    const parsed = parseAnalysis(text);
    if (parsed) parsed.confidence = "medium";
    return parsed;
  } catch {
    return null;
  }
}

type VisionProvider = "auto" | "ollama" | "claude" | "gpt";

// ── POST handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, characterName, preferredProvider } = body as {
      imageUrl?: string;
      characterName?: string;
      preferredProvider?: VisionProvider;
    };

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const preferred: VisionProvider = preferredProvider ?? "auto";

    // Build base URL for resolving relative paths (e.g. /api/media/...)
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Fetch the image and convert to base64
    const imageData = await imageUrlToBase64(imageUrl, baseUrl);

    let analysis: CharacterVisualAnalysis | null = null;
    let usedProvider = "none";

    if (imageData) {
      const { base64, mediaType } = imageData;

      if (preferred === "ollama") {
        // Local only — do not fall through to cloud
        analysis = await analyzeWithOllama(base64, mediaType);
        if (analysis) usedProvider = "ollama-vision";
      } else if (preferred === "claude") {
        // Claude only
        analysis = await analyzeWithClaude(base64, mediaType);
        if (analysis) usedProvider = "claude-vision";
      } else if (preferred === "gpt") {
        // GPT only
        analysis = await analyzeWithGPT(base64, mediaType);
        if (analysis) usedProvider = "gpt-vision";
      } else {
        // "auto" — try Ollama first (free, private), then cloud fallbacks
        analysis = await analyzeWithOllama(base64, mediaType);
        if (analysis) usedProvider = "ollama-vision";

        if (!analysis) {
          analysis = await analyzeWithClaude(base64, mediaType);
          if (analysis) usedProvider = "claude-vision";
        }

        if (!analysis) {
          analysis = await analyzeWithGPT(base64, mediaType);
          if (analysis) usedProvider = "gpt-vision";
        }
      }
    }

    // No vision model available — return empty shells so user knows to configure one
    if (!analysis) {
      analysis = {
        species: "",
        bodyBuild: "",
        colorDescription: "",
        faceFeatures: "",
        clothingDetails: "",
        accessories: "",
        distinctiveFeatures: "",
        ageAppearance: "",
        suggestedRole: "supporting",
        gender: "unknown",
        confidence: "low",
      };
      usedProvider = "none";
    }

    return NextResponse.json({
      success: true,
      analysis,
      imageUrl,
      provider: usedProvider,
      noVisionAvailable: usedProvider === "none",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-character] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
