// GET /api/templates — list all content creation templates
// Templates are pre-configured starting points for common content types

import { NextResponse } from "next/server";

const TEMPLATES = [
  // Property & Real Estate
  {
    id: "property_tour",
    name: "Property Tour Ad",
    icon: "🏠",
    category: "Real Estate",
    description: "Upload property photos → AI generates captions + narration → professional ad reel",
    mode: "commercial",
    href: "/dashboard/commercial",
    tags: ["property", "real estate", "apartment", "shortlet"],
    settings: { aspectRatio: "9:16", targetDurationSec: 30, autoDistribute: true },
    popular: true,
  },
  {
    id: "property_slideshow",
    name: "Property Slideshow",
    icon: "🖼️",
    category: "Real Estate",
    description: "Images + narration + music → Ken Burns slideshow with captions",
    mode: "images_audio",
    href: "/dashboard?mode=images_audio",
    tags: ["slideshow", "property", "images"],
    settings: { aspectRatio: "9:16", duration: 20 },
  },

  // Social Media
  {
    id: "instagram_reel",
    name: "Instagram Reel",
    icon: "📸",
    category: "Social Media",
    description: "Quick 15-second vertical video optimized for Instagram Reels",
    mode: "text_to_video",
    href: "/dashboard?mode=text_to_video",
    tags: ["instagram", "reel", "short", "vertical"],
    settings: { aspectRatio: "9:16", duration: 15 },
    popular: true,
  },
  {
    id: "youtube_short",
    name: "YouTube Short",
    icon: "▶️",
    category: "Social Media",
    description: "60-second vertical video for YouTube Shorts",
    mode: "text_to_video",
    href: "/dashboard?mode=text_to_video",
    tags: ["youtube", "short", "60s"],
    settings: { aspectRatio: "9:16", duration: 60 },
  },
  {
    id: "tiktok_clip",
    name: "TikTok Clip",
    icon: "🎵",
    category: "Social Media",
    description: "Fast-paced 15s clip with trending energy",
    mode: "text_to_video",
    href: "/dashboard?mode=text_to_video",
    tags: ["tiktok", "clip", "fast"],
    settings: { aspectRatio: "9:16", duration: 15 },
  },

  // Business
  {
    id: "product_showcase",
    name: "Product Showcase",
    icon: "🛍️",
    category: "Business",
    description: "Showcase your product with AI-generated visuals and narration",
    mode: "text_to_video",
    href: "/dashboard?mode=text_to_video",
    tags: ["product", "showcase", "promo"],
    settings: { aspectRatio: "9:16", duration: 30 },
    popular: true,
  },
  {
    id: "brand_intro",
    name: "Brand Introduction",
    icon: "✨",
    category: "Business",
    description: "16:9 landscape intro video for your brand or business",
    mode: "text_to_video",
    href: "/dashboard?mode=text_to_video",
    tags: ["brand", "intro", "landscape"],
    settings: { aspectRatio: "16:9", duration: 30 },
  },
  {
    id: "service_ad",
    name: "Service Announcement",
    icon: "📢",
    category: "Business",
    description: "Quick service or offer announcement for social media",
    mode: "commercial",
    href: "/dashboard/commercial",
    tags: ["service", "announcement", "offer"],
    settings: { aspectRatio: "9:16", targetDurationSec: 15 },
  },

  // Creative
  {
    id: "ai_character",
    name: "AI Character Video",
    icon: "🎭",
    category: "Creative",
    description: "Generate a character image → animate with motion → cinematic video",
    mode: "image_to_video",
    href: "/dashboard?mode=image_to_video",
    tags: ["character", "animation", "creative"],
    settings: { aspectRatio: "9:16", duration: 5 },
  },
  {
    id: "story_episode",
    name: "Story Episode",
    icon: "📖",
    category: "Creative",
    description: "Multi-scene episode with characters, dialogue, and SFX",
    mode: "hybrid",
    href: "/dashboard?mode=hybrid",
    tags: ["story", "episode", "series", "narrative"],
    settings: { aspectRatio: "16:9", duration: 60 },
  },
  {
    id: "ai_image_pack",
    name: "AI Image Pack",
    icon: "🖼️",
    category: "Creative",
    description: "Generate multiple AI images from descriptions — save to library",
    mode: "text_to_image",
    href: "/dashboard?mode=text_to_image",
    tags: ["image", "ai", "generation", "pack"],
    settings: { aspectRatio: "1:1" },
  },

  // Audio
  {
    id: "podcast_narration",
    name: "Podcast Narration",
    icon: "🎙",
    category: "Audio",
    description: "Long-form narration with background music — audio only",
    mode: "text_to_audio",
    href: "/dashboard?mode=text_to_audio",
    tags: ["podcast", "narration", "long-form", "audio"],
    settings: { duration: 120 },
  },
  {
    id: "voiceover",
    name: "Quick Voiceover",
    icon: "🗣",
    category: "Audio",
    description: "Short voiceover for ads, intros, or social media",
    mode: "text_to_audio",
    href: "/dashboard?mode=text_to_audio",
    tags: ["voiceover", "quick", "ad"],
    settings: { duration: 15 },
  },
];

export async function GET() {
  return NextResponse.json({
    templates: TEMPLATES,
    categories: [...new Set(TEMPLATES.map(t => t.category))],
    popular: TEMPLATES.filter(t => t.popular),
  });
}
