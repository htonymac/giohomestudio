// POST /api/llm/assistant
// Local-AI (Ollama) prompt assistant for the video editor's "AI Prompt Assistant".
// Anthropic + FAL are out of credits — this route is FREE, runs on the same server via Ollama.
//
// Does three things depending on what the user typed:
//   (a) polish a rough prompt into a clean, usable one
//   (b) generate a brand-new prompt from a request ("nice overlay prompt for a luxury shortlet")
//   (c) fetch a URL the user names and use the page's text as grounding ("get info on
//       dioluxapartments.com and write me an outro line")
//
// Request:  { message: string }
// Response: { result: string, usedUrl?: string, model: string } | { error: string } (503 on failure)

import { NextRequest, NextResponse } from "next/server";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

// Preference order — bigger general-purpose chat/instruct models first, llava (vision model,
// weaker at pure text) last since it's the one guaranteed to be installed per current server state.
const MODEL_PREFERENCE = ["llama", "mistral", "qwen", "gemma", "phi", "llava"];

function pickModel(names: string[]): string | null {
  if (names.length === 0) return null;
  for (const pref of MODEL_PREFERENCE) {
    const hit = names.find((n) => n.toLowerCase().includes(pref));
    if (hit) return hit;
  }
  return names[0];
}

// ── SSRF guard ────────────────────────────────────────────────────────────
// Only fetch URLs the user explicitly named, and never let that turn into a
// probe of the server's own network (Ollama itself, localhost, private LAN ranges).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true;
  if (h === "0.0.0.0") return true;

  // IPv4 literal checks
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata)
    if (a === 0) return true; // 0.0.0.0/8
  }

  // Bare IPv6 loopback / link-local / unique-local
  if (h.startsWith("fe80:")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local (fc00::/7)

  // Never allow fetching the Ollama host itself.
  try {
    const ollamaHost = new URL(OLLAMA_BASE).hostname.toLowerCase();
    if (h === ollamaHost) return true;
  } catch {
    // OLLAMA_BASE is malformed — ignore, doesn't affect the block list above.
  }

  return false;
}

function extractUrl(message: string): string | null {
  // Prefer an explicit http(s) URL if present.
  const httpMatch = message.match(/https?:\/\/[^\s)"'<>]+/i);
  if (httpMatch) return httpMatch[0];

  // Otherwise accept a bare domain-looking token, e.g. "dioluxapartments.com".
  const domainMatch = message.match(
    /\b([a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,})\b/i
  );
  if (domainMatch) return `https://${domainMatch[1]}`;

  return null;
}

async function fetchSiteText(rawUrl: string): Promise<{ text: string; url: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (isBlockedHost(parsed.hostname)) {
    console.error("[llm/assistant] SSRF guard blocked host:", parsed.hostname);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "GioHomeStudioBot/1.0 (+prompt-assistant)" },
    });
    if (!res.ok) return null;

    // Cap body read to ~1.5 MB so a huge page can't stall/blow up memory.
    const reader = res.body?.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    const CAP = 1.5 * 1024 * 1024;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          bytes += value.byteLength;
          chunks.push(value);
          if (bytes >= CAP) {
            reader.cancel().catch(() => {});
            break;
          }
        }
      }
    }
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    const text = (title ? `Title: ${title}\n` : "") + stripped.slice(0, 3000);
    return { text, url: parsed.toString() };
  } catch (err) {
    console.error("[llm/assistant] site fetch failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  let message = "";
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }

  try {
    // 1. Optional URL grounding — best-effort, never fails the whole request.
    let siteText: string | null = null;
    let usedUrl: string | undefined;
    const candidateUrl = extractUrl(message);
    if (candidateUrl) {
      const fetched = await fetchSiteText(candidateUrl);
      if (fetched) {
        siteText = fetched.text;
        usedUrl = fetched.url;
      }
    }

    // 2. Pick an installed Ollama model.
    const tagsRes = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!tagsRes.ok) {
      console.error("[llm/assistant] /api/tags failed:", tagsRes.status);
      return NextResponse.json({ error: "Local AI is unavailable right now" }, { status: 503 });
    }
    const tagsData = await tagsRes.json();
    const modelNames: string[] = Array.isArray(tagsData?.models)
      ? tagsData.models.map((m: { name?: string }) => m?.name).filter(Boolean)
      : [];
    const model = pickModel(modelNames);
    if (!model) {
      console.error("[llm/assistant] no Ollama models installed");
      return NextResponse.json({ error: "Local AI has no models installed" }, { status: 503 });
    }

    // 3. Build the prompt and call Ollama.
    const system =
      "You are a creative copy/prompt assistant for a video ad + overlay tool for a Nigerian luxury short-let brand called Diolux. " +
      "Produce concise, ready-to-use text. Return ONLY the result — no preamble, no markdown, no quotes.";
    const parts = [system];
    if (siteText) parts.push(`Info from the brand's site:\n${siteText}`);
    parts.push(`User request:\n${message}`);
    const prompt = parts.join("\n\n");

    const genRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!genRes.ok) {
      console.error("[llm/assistant] /api/generate failed:", genRes.status);
      return NextResponse.json({ error: "Local AI is unavailable right now" }, { status: 503 });
    }
    const genData = await genRes.json();
    const result = typeof genData?.response === "string" ? genData.response.trim() : "";
    if (!result) {
      console.error("[llm/assistant] empty response from Ollama model:", model);
      return NextResponse.json({ error: "Local AI is unavailable right now" }, { status: 503 });
    }

    return NextResponse.json({ result, usedUrl, model });
  } catch (err) {
    console.error("[llm/assistant] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Local AI is unavailable right now" }, { status: 503 });
  }
}
