// POST /api/video/invtext-story — AI Story Builder for GHS InvText
//
// User types a story idea → LLM breaks it into slides with:
// - Text for each slide
// - Mood-matched background gradient
// - Animation per slide
// - Timing
// - Music mood suggestion
//
// No AI video/image generation — pure text+background, zero credits.

import { NextRequest, NextResponse } from "next/server";
import { callPlanner, type ModelTier } from "@/lib/model-tier-router";

export interface StorySlide {
  slide_number: number;
  text: string;
  mood: string;
  background: string; // CSS gradient
  animation: "fade" | "typewriter" | "slide_up" | "bounce" | "pop" | "glow" | "blur_reveal";
  duration: number;
  font_size: "small" | "medium" | "large" | "xlarge";
  position: "center" | "top" | "bottom";
}

export interface InvTextStory {
  title: string;
  slides: StorySlide[];
  music_mood: string;
  total_duration: number;
  narration_text: string; // full narration script
}

const MOOD_BACKGROUNDS: Record<string, string[]> = {
  sad: [
    "linear-gradient(135deg, #4a5568, #6b7280, #3b82f6)",
    "linear-gradient(135deg, #1e3a5f, #3b82f6, #6366f1)",
    "linear-gradient(135deg, #374151, #6366f1, #818cf8)",
  ],
  dark: [
    "linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)",
    "linear-gradient(135deg, #1f2937, #374151, #4b5563)",
  ],
  lonely: [
    "linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)",
    "linear-gradient(135deg, #1e40af, #3b82f6, #60a5fa)",
  ],
  hope: [
    "linear-gradient(135deg, #1a472a, #2d6a4f, #40916c)",
    "linear-gradient(135deg, #0f3460, #1a5276, #2980b9)",
  ],
  joy: [
    "linear-gradient(135deg, #f7c948, #ff6b35, #e63946)",
    "linear-gradient(135deg, #ff9a00, #ffcd00, #ffd700)",
    "linear-gradient(135deg, #00b894, #00cec9, #55efc4)",
  ],
  love: [
    "linear-gradient(135deg, #e63946, #ff006e, #fb5607)",
    "linear-gradient(135deg, #ff006e, #c77dff, #e63946)",
  ],
  excitement: [
    "linear-gradient(135deg, #ff006e, #fb5607, #ffbe0b)",
    "linear-gradient(135deg, #00ff87, #60efff, #ff00c8)",
  ],
  calm: [
    "linear-gradient(135deg, #a8d8ea, #aa96da, #fcbad3)",
    "linear-gradient(135deg, #90e0ef, #00b4d8, #0077b6)",
  ],
  warm: [
    "linear-gradient(135deg, #b8860b, #ffd700, #daa520)",
    "linear-gradient(135deg, #ff6b35, #f7c948, #e63946)",
  ],
  nature: [
    "linear-gradient(135deg, #2d6a4f, #52b788, #b7e4c7)",
    "linear-gradient(135deg, #606c38, #283618, #dda15e)",
  ],
  night: [
    "linear-gradient(135deg, #240046, #7b2cbf, #c77dff)",
    "linear-gradient(135deg, #0d1b2a, #1b263b, #415a77)",
  ],
  neutral: [
    "linear-gradient(135deg, #6c5ce7, #a855f7, #c084fc)",
    "linear-gradient(135deg, #0ea5e9, #6366f1, #a855f7)",
    "linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)",
  ],
};

function pickBackground(mood: string): string {
  const key = Object.keys(MOOD_BACKGROUNDS).find(k => mood.toLowerCase().includes(k)) || "neutral";
  const options = MOOD_BACKGROUNDS[key];
  return options[Math.floor(Math.random() * options.length)];
}

function pickAnimation(mood: string): StorySlide["animation"] {
  if (mood.includes("sad") || mood.includes("lonely") || mood.includes("dark")) return "fade";
  if (mood.includes("joy") || mood.includes("excite") || mood.includes("happy")) return "bounce";
  if (mood.includes("hope") || mood.includes("reveal")) return "blur_reveal";
  if (mood.includes("narrat") || mood.includes("story") || mood.includes("tell")) return "typewriter";
  if (mood.includes("calm") || mood.includes("gentle")) return "fade";
  return "slide_up";
}

const STORY_SYSTEM = `You are a content creator for GHS InvText. Given an idea, break it into 4-10 visual text slides.

CRITICAL RULES FOR SLIDE TEXT:
- MAXIMUM 15 words per slide — HARD LIMIT
- Each slide is ONE short sentence or phrase
- Text must be readable at a glance — 3 seconds max to read
- NEVER put a paragraph on one slide

For COMMERCIAL ADS: use this structure: Headline → Features → Price → Location → CTA ("Call Now!" or "Visit Us!")
For STORIES: build emotional arc (start → conflict → resolution)
For TUTORIALS: number each step ("Step 1:", "Step 2:")
For QUOTES: wrap each in quotation marks
For NEWS: start with "BREAKING" headline

Each slide: { "text": "short text", "mood": "one of: sad, lonely, dark, hope, joy, love, excitement, calm, warm, nature, night" }

Rules:
- Include a title
- Write narration_text (full content read aloud)
- Suggest music_mood: cinematic, calm, emotional, upbeat, suspense, afrobeats

Return ONLY valid JSON:
{
  "title": "...",
  "slides": [{ "slide_number": 1, "text": "...", "mood": "..." }, ...],
  "music_mood": "...",
  "narration_text": "..."
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { prompt, tier = "pro", contentType = "story" } = body;

    // Smart auto-detection: override content type if prompt clearly indicates a different type
    const lp = prompt.toLowerCase();
    if (contentType === "story") {
      // Auto-detect ad/commercial
      if (lp.match(/for\s+sale|for\s+sell|buy\s+now|call\s+now|contact|price|naira|₦|\bNGN\b|order\s+now|available\s+now|discount|% off|shop|store|visit\s+us/i)) {
        contentType = "ad";
      }
      // Auto-detect tutorial
      else if (lp.match(/how\s+to|step\s+\d|guide|install|setup|configure/i)) {
        contentType = "tutorial";
      }
      // Auto-detect motivational
      else if (lp.match(/believe|never\s+give\s+up|you\s+can|dream|inspire|success|strength|courage/i)) {
        contentType = "motivational";
      }
      // Auto-detect children
      else if (lp.match(/once\s+upon|kids|children|little\s+(boy|girl|rabbit|cat|dog)|fairy|magic|princess|dragon/i)) {
        contentType = "children";
      }
    }

    if (!prompt) {
      return NextResponse.json({ error: "Story prompt required" }, { status: 400 });
    }

    let story: InvTextStory;

    if (tier === "standard") {
      // Pass content type to deterministic builder
      // Deterministic — split prompt into slides
      story = buildDeterministicStory(prompt, contentType);
    } else {
      // AI-planned — prompt changes based on content type
      const typeInstructions: Record<string, string> = {
        story: `Write a visual story with emotional arc based on this idea: "${prompt}"`,
        children: `Write a children's picture book story based on this idea: "${prompt}"`,
        ad: `Create a commercial advertisement with these slides: HEADLINE (attention grabber), KEY FEATURES (2-3 slides), PRICE/OFFER, LOCATION/CONTACT, CTA (call to action). Product/service: "${prompt}"`,
        motivational: `Create an inspirational motivational sequence based on: "${prompt}"`,
        educational: `Create an educational lesson with clear steps based on: "${prompt}"`,
        lyrics: `Write song lyrics verse by verse based on: "${prompt}"`,
        poem: `Write a poem with each slide being one stanza based on: "${prompt}"`,
        news: `Write a news bulletin/announcement based on: "${prompt}". First slide should be a BREAKING/HEADLINE.`,
        tutorial: `Create a step-by-step tutorial guide based on: "${prompt}". Each slide should be one clear step.`,
        quotes: `Create a series of memorable quotes/sayings based on: "${prompt}". Each slide is one quote in quotation marks.`,
      };
      const aiPrompt = typeInstructions[contentType] || typeInstructions.story;
      const result = await callPlanner(
        aiPrompt,
        STORY_SYSTEM,
        tier as ModelTier,
      );
      const text = typeof result === "string" ? result : (result as { text?: string })?.text || JSON.stringify(result);

      let parsed: { title: string; slides: Array<{ slide_number: number; text: string; mood: string }>; music_mood: string; narration_text: string };
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[1] || match[0]);
        } else {
          // Fallback to deterministic
          story = buildDeterministicStory(prompt, contentType);
          return NextResponse.json({ story, tier, method: "fallback_deterministic" });
        }
      }

      // Enrich slides with backgrounds and animations
      story = {
        title: parsed.title || prompt.slice(0, 40),
        slides: parsed.slides.map((s, i) => ({
          slide_number: s.slide_number || i + 1,
          text: s.text,
          mood: s.mood || "neutral",
          background: pickBackground(s.mood || "neutral"),
          animation: pickAnimation(s.mood || "neutral"),
          duration: Math.max(4, Math.min(8, Math.ceil(s.text.length / 15))),
          font_size: s.text.length > 80 ? "medium" : s.text.length > 40 ? "large" : "xlarge",
          position: "center",
        })),
        music_mood: parsed.music_mood || "emotional",
        total_duration: 0,
        narration_text: parsed.narration_text || parsed.slides.map(s => s.text).join(" "),
      };
      story.total_duration = story.slides.reduce((t, s) => t + s.duration, 0);
    }

    return NextResponse.json({ story, tier, method: tier === "standard" ? "deterministic" : "ai_written" });
  } catch (error) {
    console.error("[InvText Story API]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Story generation failed" },
      { status: 500 },
    );
  }
}

function buildDeterministicStory(prompt: string, contentType: string = "story"): InvTextStory {
  const lower = prompt.toLowerCase();
  // Content type affects mood, music, and slide structure
  const typeDefaults: Record<string, { defaultMood: string; music: string }> = {
    story: { defaultMood: "calm", music: "cinematic" },
    children: { defaultMood: "joy", music: "upbeat" },
    ad: { defaultMood: "excitement", music: "upbeat" },
    motivational: { defaultMood: "hope", music: "cinematic" },
    educational: { defaultMood: "calm", music: "calm" },
    lyrics: { defaultMood: "love", music: "emotional" },
    poem: { defaultMood: "calm", music: "emotional" },
    news: { defaultMood: "neutral", music: "cinematic" },
    tutorial: { defaultMood: "neutral", music: "calm" },
    quotes: { defaultMood: "hope", music: "cinematic" },
  };
  const typeConf = typeDefaults[contentType] || typeDefaults.story;

  // Extract key elements
  const hasCharacter = lower.match(/(?:a |the )(\w+(?:\s\w+)?)/)?.[1] || "character";

  // Build story arc from the prompt — split into short chunks (max 15 words per slide)
  const rawSentences = prompt.split(/[.!?\n]+/).filter(s => s.trim().length > 3);

  // Break long sentences into shorter chunks
  const sentences: string[] = [];
  for (const raw of rawSentences) {
    const words = raw.trim().split(/\s+/);
    if (words.length <= 15) {
      sentences.push(raw.trim());
    } else {
      // Split at natural break points (commas, conjunctions) or every 12 words
      let chunk: string[] = [];
      for (const word of words) {
        chunk.push(word);
        if (chunk.length >= 12 || (chunk.length >= 8 && /[,;:]$/.test(word)) || (chunk.length >= 6 && /^(and|but|then|so|because|when|while|after|before|until)$/i.test(word))) {
          sentences.push(chunk.join(" ").replace(/[,;:]$/, ""));
          chunk = [];
        }
      }
      if (chunk.length > 0) sentences.push(chunk.join(" "));
    }
  }

  let slides: StorySlide[];

  // ═══ Content-type-aware slide generation ═══
  if (contentType === "ad") {
    // COMMERCIAL AD format: headline → features → price → location → CTA
    const adSlides: Array<{text: string; mood: string}> = [
      { text: prompt.split(/[.!]\s*/)[0]?.trim() || prompt.slice(0, 30), mood: "excitement" },
    ];
    // Extract key info from prompt
    const priceMatch = prompt.match(/(\d[\d,.]+ ?(naira|NGN|₦|USD|\$|k|K|million|m))/i);
    const locationMatch = prompt.match(/((?:at|in|visit|location|address)[:\s]*[^.!]+)/i);
    const features = sentences.filter(s => !s.match(/call|visit|contact|price|location|address/i)).slice(1, 4);
    features.forEach(f => adSlides.push({ text: f.trim(), mood: "warm" }));
    if (priceMatch) adSlides.push({ text: priceMatch[0].includes("naira") || priceMatch[0].includes("₦") ? `Only ${priceMatch[0]}` : priceMatch[0], mood: "excitement" });
    if (locationMatch) adSlides.push({ text: locationMatch[1].replace(/^(at|in|visit|location|address)[:\s]*/i, "").trim(), mood: "calm" });
    adSlides.push({ text: "Contact Us Today!", mood: "excitement" });

    slides = adSlides.map((s, i) => ({
      slide_number: i + 1, text: s.text, mood: s.mood,
      background: pickBackground(s.mood), animation: i === 0 ? "bounce" as const : i === adSlides.length - 1 ? "bounce" as const : "slide_up" as const,
      duration: i === 0 ? 4 : 3, font_size: (i === 0 ? "xlarge" : "large") as StorySlide["font_size"], position: "center" as const,
    }));
  } else if (contentType === "children") {
    // CHILDREN STORY: simple words, bright moods, happy arc
    const kidsMoods = ["joy", "excitement", "calm", "hope", "joy", "excitement"];
    if (sentences.length >= 3) {
      slides = sentences.slice(0, 8).map((s, i) => ({
        slide_number: i + 1, text: s.trim(), mood: kidsMoods[i % kidsMoods.length],
        background: pickBackground(kidsMoods[i % kidsMoods.length]), animation: (["bounce", "slide_up", "fade", "blur_reveal"] as const)[i % 4],
        duration: 5, font_size: "xlarge" as const, position: "center" as const,
      }));
    } else {
      slides = [
        { slide_number: 1, text: `Once upon a time...`, mood: "calm", background: pickBackground("calm"), animation: "fade" as const, duration: 4, font_size: "xlarge" as const, position: "center" as const },
        { slide_number: 2, text: prompt.slice(0, 50), mood: "joy", background: pickBackground("joy"), animation: "bounce" as const, duration: 5, font_size: "xlarge" as const, position: "center" as const },
        { slide_number: 3, text: "And they all lived happily ever after!", mood: "excitement", background: pickBackground("excitement"), animation: "bounce" as const, duration: 4, font_size: "xlarge" as const, position: "center" as const },
      ];
    }
  } else if (contentType === "motivational") {
    slides = sentences.slice(0, 6).map((s, i) => ({
      slide_number: i + 1, text: s.trim(), mood: (["hope", "calm", "hope", "excitement", "joy"] as const)[i % 5],
      background: pickBackground((["hope", "calm", "hope", "excitement", "joy"] as const)[i % 5]),
      animation: (["fade", "slide_up", "blur_reveal", "bounce"] as const)[i % 4],
      duration: 5, font_size: "xlarge" as const, position: "center" as const,
    }));
    if (slides.length < 2) slides.push({ slide_number: 2, text: "Believe in yourself.", mood: "hope", background: pickBackground("hope"), animation: "fade", duration: 5, font_size: "xlarge" as const, position: "center" as const });
  } else if (contentType === "quotes") {
    slides = sentences.slice(0, 8).map((s, i) => ({
      slide_number: i + 1, text: `"${s.trim()}"`, mood: (["calm", "hope", "love", "warm"] as const)[i % 4],
      background: pickBackground((["calm", "hope", "love", "warm"] as const)[i % 4]),
      animation: "fade" as const, duration: 5, font_size: "xlarge" as const, position: "center" as const,
    }));
  } else if (contentType === "tutorial") {
    slides = sentences.slice(0, 10).map((s, i) => ({
      slide_number: i + 1, text: `Step ${i + 1}: ${s.trim()}`, mood: "neutral",
      background: pickBackground("neutral"), animation: "slide_up" as const,
      duration: 5, font_size: "large" as const, position: "center" as const,
    }));
  } else if (contentType === "lyrics") {
    slides = sentences.slice(0, 12).map((s, i) => ({
      slide_number: i + 1, text: s.trim(), mood: (["love", "calm", "love", "warm"] as const)[i % 4],
      background: pickBackground((["love", "calm", "love", "warm"] as const)[i % 4]),
      animation: "typewriter" as const, duration: 4, font_size: "xlarge" as const, position: "center" as const,
    }));
  } else if (contentType === "poem") {
    slides = sentences.slice(0, 10).map((s, i) => ({
      slide_number: i + 1, text: s.trim(), mood: (["calm", "love", "hope", "calm"] as const)[i % 4],
      background: pickBackground((["calm", "love", "hope", "calm"] as const)[i % 4]),
      animation: "fade" as const, duration: 5, font_size: "xlarge" as const, position: "center" as const,
    }));
  } else if (contentType === "news") {
    slides = [
      { slide_number: 1, text: "BREAKING", mood: "excitement", background: pickBackground("excitement"), animation: "bounce" as const, duration: 2, font_size: "xlarge" as const, position: "center" as const },
      ...sentences.slice(0, 6).map((s, i) => ({
        slide_number: i + 2, text: s.trim(), mood: "neutral" as const,
        background: pickBackground("neutral"), animation: "slide_up" as const,
        duration: 4, font_size: "large" as const, position: "center" as const,
      })),
    ];
  } else {
    // DEFAULT: Story Telling — narrative arc
    if (sentences.length >= 3) {
      slides = sentences.slice(0, 10).map((s, i) => {
        const isStart = i < sentences.length * 0.3;
        const isEnd = i > sentences.length * 0.7;
        const mood = isEnd ? (lower.includes("joy") || lower.includes("happy") ? "joy" : "hope") : isStart ? (lower.includes("sad") ? "sad" : typeConf.defaultMood) : typeConf.defaultMood;
        return {
          slide_number: i + 1, text: s.trim(), mood,
          background: pickBackground(mood), animation: pickAnimation(mood),
          duration: Math.max(3, Math.min(6, Math.ceil(s.trim().split(/\s+/).length * 0.5))),
          font_size: (s.length > 60 ? "large" : "xlarge") as StorySlide["font_size"], position: "center" as const,
        };
      });
    } else {
      slides = [
        { slide_number: 1, text: prompt.split(/[.!]/)[0]?.trim() || prompt, mood: typeConf.defaultMood, background: pickBackground(typeConf.defaultMood), animation: "fade" as const, duration: 5, font_size: "xlarge" as const, position: "center" as const },
        { slide_number: 2, text: prompt.split(/[.!]/)[1]?.trim() || "The story continues...", mood: "hope", background: pickBackground("hope"), animation: "slide_up" as const, duration: 5, font_size: "xlarge" as const, position: "center" as const },
      ];
    }
  }

  return {
    title: prompt.slice(0, 50),
    slides,
    music_mood: lower.includes("sad") ? "emotional" : lower.includes("happy") || lower.includes("joy") ? "upbeat" : typeConf.music,
    total_duration: slides.reduce((t, s) => t + s.duration, 0),
    narration_text: slides.map(s => s.text).join(" "),
  };
}
