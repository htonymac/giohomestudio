"use client";

import { useState, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Music & Video Studio — Hub Page
// Two tabs: Music Studio (create music) + Music Video Studio (create videos)
// Each mode card opens a slide-up edit panel → generate → preview → approve
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────────

interface ModeConfig {
  id: string;
  icon: string;
  title: string;
  description: string;
  tag: string;
  color: "cyan" | "orange" | "purple" | "green" | "gold" | "pink";
  fields: FieldConfig[];
  generateLabel: string;
  generateAction: "music" | "video" | "route";
  routeTo?: string;
}

interface FieldConfig {
  type: "textarea" | "text" | "select" | "pills" | "upload" | "upload-multi" | "info";
  label: string;
  placeholder?: string;
  options?: string[];
  accept?: string;
  key: string;
  required?: boolean;
  infoText?: string;
  infoColor?: string;
}

interface StoryboardScene {
  scene: number;
  purpose: string;
  duration: string;
  prompt: string;
  style: string;
  movement: string;
}

// ── Video Model Options ──────────────────────────────────────────────────

interface VideoModel {
  id: string;
  name: string;
  provider?: string;
  cost: string;
  speed: string;
  quality: string;
  bestFor: string;
  badge?: string;
}

const VIDEO_MODELS: VideoModel[] = [
  { id: "kling3-pro",    name: "Kling 3.0 Pro",       cost: "4 credits", speed: "Slow",   quality: "Cinematic",   bestFor: "Music videos, cinematic scenes, final render", badge: "Best quality" },
  { id: "kling2",        name: "Kling 2.1",           cost: "1 credit",  speed: "Medium", quality: "Great",        bestFor: "General video, performance, dance", badge: "Best price" },
  { id: "seedance",      name: "SeeDance 2.0",        cost: "2 credits", speed: "Medium", quality: "Cinematic",   bestFor: "Dance, choreography, native audio" },
  { id: "hailuo-fast",   name: "Hailuo 2.3 Fast",     cost: "2 credits", speed: "Fast",   quality: "Good (768p)",  bestFor: "Quick previews, drafts, testing", badge: "Fastest" },
  { id: "hailuo-pro",    name: "Hailuo 2.3 Pro",      cost: "4 credits", speed: "Medium", quality: "High (1080p)", bestFor: "High-res scenes, detailed visuals" },
  { id: "wan25",         name: "Wan 2.5",             cost: "1 credit",  speed: "Medium", quality: "Good",         bestFor: "Animation, budget content", badge: "Cheapest" },
];

// AI suggestion: which model fits best for a given mode
function suggestVideoModel(modeId: string): string {
  const map: Record<string, string> = {
    "full-music-video": "kling3-pro",      // cinematic quality needed
    "bring-your-song":  "kling2",          // good balance
    "image-music-video":"hailuo-pro",      // image-to-video strength
    "ai-performance":   "kling3-pro",      // needs best quality for avatar
    "lyric-video":      "hailuo-fast",     // mostly text overlay, cheaper
    "short-teaser":     "hailuo-fast",     // short clip, speed matters
    "audio-to-video":   "kling2",          // good balance
    "image-animation":  "hailuo-pro",      // image-to-video
  };
  return map[modeId] ?? "kling2";
}

// ── Color system (blended: HTML design + existing dashboard) ─────────────

const COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan:   { bg: "rgba(0,212,255,0.06)",   border: "rgba(0,212,255,0.25)",   text: "#00d4ff", glow: "rgba(0,212,255,0.15)" },
  orange: { bg: "rgba(255,107,53,0.06)",  border: "rgba(255,107,53,0.25)",  text: "#ff6b35", glow: "rgba(255,107,53,0.15)" },
  purple: { bg: "rgba(168,85,247,0.06)",  border: "rgba(168,85,247,0.25)",  text: "#a855f7", glow: "rgba(168,85,247,0.15)" },
  green:  { bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.25)",   text: "#22c55e", glow: "rgba(34,197,94,0.15)" },
  gold:   { bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.25)",  text: "#f59e0b", glow: "rgba(245,158,11,0.15)" },
  pink:   { bg: "rgba(236,72,153,0.06)",  border: "rgba(236,72,153,0.25)",  text: "#ec4899", glow: "rgba(236,72,153,0.15)" },
};

// ── Mode Configurations ──────────────────────────────────────────────────

const MUSIC_MODES: ModeConfig[] = [
  {
    id: "text-to-music", icon: "✍️", title: "Text to Music", tag: "Most popular", color: "cyan",
    description: "Describe your song idea in words. GHS writes the lyrics, picks the style, and generates a full track.",
    generateLabel: "Generate My Song", generateAction: "music",
    fields: [
      { type: "textarea", label: "Song Concept", key: "prompt", required: true, placeholder: "A heartbreak song about leaving Lagos for London, nostalgic, missing home and family..." },
      { type: "select", label: "Genre", key: "genre", options: ["Afrobeats", "Amapiano", "Highlife", "Gospel", "R&B", "Hip Hop", "Fuji", "Juju", "Drill", "Pop", "Jazz", "EDM", "Country", "Classical"] },
      { type: "select", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Portuguese", "Arabic", "Hindi", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "German", "Japanese", "Korean", "Mixed"] },
      { type: "pills", label: "Mood", key: "mood", options: ["Joyful", "Melancholic", "Energetic", "Romantic", "Spiritual", "Angry", "Celebratory", "Nostalgic", "Peaceful", "Dark"] },
      { type: "pills", label: "Duration", key: "duration", options: ["1 min", "2 min", "3 min", "4 min"] },
    ],
  },
  {
    id: "image-to-music", icon: "🖼️", title: "Image to Music", tag: "Visual AI", color: "orange",
    description: "Upload a photo. GHS reads the mood, colours, and scene — then creates a song that matches the image.",
    generateLabel: "Generate Music from Image", generateAction: "music",
    fields: [
      { type: "upload", label: "Upload Image", key: "image", required: true, accept: "image/*" },
      { type: "select", label: "Genre Preference", key: "genre", options: ["Let GHS decide", "Afrobeats", "Amapiano", "Gospel", "R&B", "Ambient", "Classical", "Jazz", "Pop"] },
      { type: "select", label: "Duration", key: "duration", options: ["1 min", "2 min", "3 min"] },
      { type: "text", label: "Additional Notes (optional)", key: "notes", placeholder: "e.g. Make it feel like a Sunday morning in Lagos..." },
    ],
  },
  {
    id: "voice-to-music", icon: "🎙️", title: "Voice to Music", tag: "Voice AI", color: "purple",
    description: "Record or upload your voice humming, singing, or speaking. GHS turns it into a full produced song.",
    generateLabel: "Generate Song from My Voice", generateAction: "music",
    fields: [
      { type: "upload", label: "Upload Voice Recording", key: "voice", required: true, accept: "audio/*" },
      { type: "select", label: "What to do with my voice", key: "voiceUse", options: ["Keep my voice as lead vocal", "Use as melody guide, generate new vocals", "Use for lyrics only, generate full production"] },
      { type: "select", label: "Genre", key: "genre", options: ["Let GHS decide", "Afrobeats", "Gospel", "R&B", "Highlife", "Pop", "Hip Hop"] },
      { type: "text", label: "What is this song about?", key: "about", placeholder: "Brief description helps GHS write better lyrics around your melody..." },
    ],
  },
  {
    id: "image-voice-to-music", icon: "🎨", title: "Image + Voice to Music", tag: "Combined", color: "gold",
    description: "Combine a photo with your voice. The image sets the visual mood, your voice sets the emotional tone.",
    generateLabel: "Combine & Generate", generateAction: "music",
    fields: [
      { type: "upload", label: "Upload Image", key: "image", required: true, accept: "image/*" },
      { type: "upload", label: "Upload Voice", key: "voice", required: true, accept: "audio/*" },
      { type: "textarea", label: "Song Direction (optional)", key: "direction", placeholder: "Add any extra direction — theme, story, mood words..." },
      { type: "pills", label: "Duration", key: "duration", options: ["1 min", "2 min", "3 min"] },
    ],
  },
  {
    id: "image-animation", icon: "🎭", title: "Music with Animation", tag: "Animated", color: "pink",
    description: "Upload an image and music. GHS animates the image to move with the beat — dancing, pulsing, breathing.",
    generateLabel: "Animate & Generate", generateAction: "music",
    fields: [
      { type: "upload", label: "Upload Image to Animate", key: "image", required: true, accept: "image/*" },
      { type: "pills", label: "Music Source", key: "musicSource", options: ["Generate new music", "Upload my own music"] },
      { type: "pills", label: "Animation Style", key: "animStyle", options: ["Gentle pulse", "Dancing", "Breathing", "Zoom & pan", "Colour shift", "Particle burst"] },
      { type: "select", label: "Music Style (if generating)", key: "genre", options: ["Match the image mood", "Afrobeats", "Ambient", "Gospel", "Electronic", "Jazz", "Pop"] },
    ],
  },
  {
    id: "audio-to-video", icon: "🎵", title: "Audio to Video", tag: "Auto-visual", color: "green",
    description: "Upload your existing audio or song. GHS generates a matching visual video to go with it automatically.",
    generateLabel: "Generate Video for My Song", generateAction: "video",
    fields: [
      { type: "upload", label: "Upload Audio / Song", key: "audio", required: true, accept: "audio/*" },
      { type: "pills", label: "Visual Style", key: "visualStyle", options: ["Cinematic", "Street", "Abstract", "Nature", "Luxury", "Urban Lagos", "Rural Africa", "Fantasy"] },
      { type: "text", label: "What is this song about? (optional)", key: "about", placeholder: "Helps GHS pick better visuals for your song..." },
      { type: "pills", label: "Output format", key: "format", options: ["16:9 YouTube", "9:16 Reels/TikTok", "Both"] },
    ],
  },
];

const CHILDREN_MODES: ModeConfig[] = [
  {
    id: "children-abc", icon: "🔤", title: "ABC Alphabet Song", tag: "Learning", color: "purple",
    description: "Fun educational alphabet song with colourful animation.",
    generateLabel: "Create ABC Song", generateAction: "music",
    fields: [
      { type: "info", label: "", key: "_info", infoText: "GHS will create a fun, educational alphabet song for children with colourful animation. Safe, joyful, and engaging for ages 2–8.", infoColor: "purple" },
      { type: "select", label: "Age Group", key: "age", options: ["Toddlers (2–3 years)", "Pre-school (3–5 years)", "Early school (5–8 years)"] },
      { type: "select", label: "Music Style", key: "musicStyle", options: ["Fun & Bouncy", "Calm & Gentle", "Afro-kids", "Classic nursery"] },
      { type: "pills", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Hindi", "Mixed"] },
      { type: "pills", label: "Animation Style", key: "animStyle", options: ["Cartoon animals", "Colourful letters", "Nigerian characters", "Space adventure", "Jungle theme"] },
    ],
  },
  {
    id: "children-numbers", icon: "🔢", title: "Numbers & Counting", tag: "Learning", color: "gold",
    description: "Counting songs for kids — 1 to 10, 1 to 100.",
    generateLabel: "Create Numbers Song", generateAction: "music",
    fields: [
      { type: "select", label: "Count up to", key: "countTo", options: ["1 to 10", "1 to 20", "1 to 50", "1 to 100"] },
      { type: "select", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Hindi"] },
      { type: "pills", label: "Theme", key: "theme", options: ["Counting fruits", "Counting animals", "Counting stars", "Counting market items", "Pure numbers"] },
    ],
  },
  {
    id: "children-animals", icon: "🐾", title: "Animal Sounds", tag: "Learning", color: "green",
    description: "Learn animal names and sounds through music.",
    generateLabel: "Create Animal Song", generateAction: "music",
    fields: [
      { type: "pills", label: "Animals to include", key: "animals", options: ["Nigerian animals", "Farm animals", "Wild animals", "Ocean animals", "All animals", "Let GHS choose"] },
      { type: "select", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Hindi"] },
    ],
  },
  {
    id: "children-colours", icon: "🌈", title: "Colours Song", tag: "Learning", color: "pink",
    description: "Learn all colours through a catchy song.",
    generateLabel: "Create Colours Song", generateAction: "music",
    fields: [
      { type: "pills", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Mixed"] },
      { type: "pills", label: "Visual style", key: "visualStyle", options: ["Cartoon", "Watercolour", "3D shapes", "Nigerian patterns", "Rainbow"] },
    ],
  },
  {
    id: "children-nursery", icon: "🌙", title: "Nursery Rhyme", tag: "Creative", color: "cyan",
    description: "Custom nursery rhymes for bedtime and playtime.",
    generateLabel: "Create Nursery Rhyme", generateAction: "music",
    fields: [
      { type: "textarea", label: "Rhyme idea", key: "prompt", placeholder: "A bedtime song about the moon and stars over Lagos, gentle and calming..." },
      { type: "select", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Mixed"] },
      { type: "select", label: "Mood", key: "mood", options: ["Calm & bedtime", "Playful", "Cheerful morning"] },
    ],
  },
  {
    id: "children-custom", icon: "✨", title: "Custom Children's Song", tag: "Any topic", color: "purple",
    description: "Any topic, any age — GHS creates it.",
    generateLabel: "Create Children's Song", generateAction: "music",
    fields: [
      { type: "textarea", label: "What should this song be about?", key: "prompt", required: true, placeholder: "A song teaching children about sharing and kindness, fun and bouncy, ages 4-6..." },
      { type: "select", label: "Age group", key: "age", options: ["Toddlers (2–3)", "Pre-school (3–5)", "Early school (5–8)", "Older kids (8–12)"] },
      { type: "select", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Portuguese", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Hindi", "Mixed"] },
    ],
  },
];

const VIDEO_MODES: ModeConfig[] = [
  {
    id: "full-music-video", icon: "🎬", title: "Full Music Video", tag: "Full pipeline", color: "cyan",
    description: "Type a concept. GHS writes the song, generates all scenes, syncs cuts to the beat, and produces a complete video.",
    generateLabel: "Start Full Music Video Pipeline", generateAction: "video",
    fields: [
      { type: "textarea", label: "Song Concept", key: "prompt", required: true, placeholder: "A love song about Lagos nightlife, the energy of Victoria Island, meeting someone special under the city lights..." },
      { type: "select", label: "Genre", key: "genre", options: ["Afrobeats", "Amapiano", "Highlife", "Gospel", "R&B", "Hip Hop", "Fuji", "Pop"] },
      { type: "select", label: "Language", key: "language", options: ["English (US)", "English (UK)", "French", "Spanish", "Portuguese", "Yoruba", "Igbo", "Hausa", "Pidgin", "Twi", "Swahili", "Arabic", "Hindi", "Mixed"] },
      { type: "pills", label: "Visual Style", key: "visualStyle", options: ["Cinematic", "Street", "Luxury", "Nature", "Urban Lagos", "Abstract", "Fantasy"] },
      { type: "select", label: "Duration", key: "duration", options: ["2 minutes", "3 minutes", "4 minutes"] },
      { type: "text", label: "Artist Name (for title card)", key: "artist", placeholder: "Your artist or brand name" },
      { type: "upload-multi", label: "Upload your own photos (optional)", key: "photos", accept: "image/*" },
    ],
  },
  {
    id: "bring-your-song", icon: "🎤", title: "Bring Your Own Song", tag: "Your music", color: "orange",
    description: "Already have a track? Upload your audio. GHS generates a full visual video to match your music automatically.",
    generateLabel: "Generate Video for My Track", generateAction: "video",
    fields: [
      { type: "upload", label: "Upload Your Song", key: "audio", required: true, accept: "audio/*" },
      { type: "pills", label: "Visual Style", key: "visualStyle", options: ["Cinematic", "Street", "Luxury", "Nature", "Urban Lagos", "Abstract", "Fantasy"] },
      { type: "text", label: "Song description (optional)", key: "about", placeholder: "What is your song about? Helps GHS pick better scenes..." },
      { type: "pills", label: "Lyric overlay", key: "lyrics", options: ["Yes — show lyrics on screen", "No lyrics overlay"] },
    ],
  },
  {
    id: "image-music-video", icon: "📸", title: "Image Music Video", tag: "Personal", color: "gold",
    description: "Upload your own photos. GHS animates them into a music video — your memories, your story, your song.",
    generateLabel: "Create My Image Music Video", generateAction: "video",
    fields: [
      { type: "upload-multi", label: "Upload Your Photos (3–20)", key: "photos", required: true, accept: "image/*" },
      { type: "pills", label: "Music Source", key: "musicSource", options: ["Generate music for my photos", "Upload my own music"] },
      { type: "textarea", label: "Story / Caption (optional)", key: "story", placeholder: "Tell GHS what these photos are about — a birthday, a trip, a wedding, a business launch..." },
    ],
  },
  {
    id: "ai-performance", icon: "🕺", title: "AI Artist Performance", tag: "Avatar", color: "purple",
    description: "Generate an AI avatar artist performing your song. Choose look, style, stage, background, and movement.",
    generateLabel: "Generate AI Performance Video", generateAction: "video",
    fields: [
      { type: "pills", label: "Song Source", key: "songSource", options: ["Generate new song", "Upload my song"] },
      { type: "textarea", label: "Song concept (if generating)", key: "prompt", placeholder: "Describe your song idea..." },
      { type: "pills", label: "AI Artist Style", key: "artistStyle", options: ["Male Afrobeats artist", "Female R&B artist", "Gender neutral pop", "Traditional African", "Gospel performer"] },
      { type: "pills", label: "Performance Stage", key: "stage", options: ["Concert stage", "Street corner", "Rooftop Lagos", "Luxury studio", "Beach", "Open field"] },
    ],
  },
  {
    id: "lyric-video", icon: "📝", title: "Lyric Video", tag: "Lyric sync", color: "green",
    description: "Upload a song. GHS generates a stylised lyric video with animated text synced to every word of your track.",
    generateLabel: "Create Lyric Video", generateAction: "video",
    fields: [
      { type: "upload", label: "Upload Your Song", key: "audio", required: true, accept: "audio/*" },
      { type: "textarea", label: "Lyrics (paste here)", key: "lyrics", placeholder: "Paste your song lyrics here. GHS will sync them to the audio automatically..." },
      { type: "pills", label: "Text Style", key: "textStyle", options: ["Bold street", "Elegant script", "Minimal clean", "Neon glow", "Hand-drawn", "Gold luxury"] },
      { type: "pills", label: "Background Style", key: "bgStyle", options: ["Abstract motion", "Lagos cityscape", "Particles", "Gradient", "Dark minimal", "Cosmic"] },
    ],
  },
  {
    id: "short-teaser", icon: "⚡", title: "Short Teaser Cut", tag: "Social ready", color: "pink",
    description: "60-second vertical teaser for Reels and TikTok. The most energetic 60 seconds of your video, auto-selected.",
    generateLabel: "Create Short Teaser", generateAction: "video",
    fields: [
      { type: "upload", label: "Upload Full Video or Song", key: "source", required: true, accept: "video/*,audio/*" },
      { type: "pills", label: "Output platform", key: "platform", options: ["Instagram Reels", "TikTok", "YouTube Shorts", "All three"] },
      { type: "pills", label: "Teaser length", key: "length", options: ["30 seconds", "45 seconds", "60 seconds", "90 seconds"] },
    ],
  },
];

// ── Styles ───────────────────────────────────────────────────────────────

const surface = "#0e1318";
const surface2 = "#151c24";
const border = "#1e2a35";
const border2 = "#263240";
const muted = "#5a7080";
const accent = "#7c5cfc";

// ── Page Component ───────────────────────────────────────────────────────

export default function MusicVideoStudioPage() {
  const [tab, setTab] = useState<"music" | "video">("music");
  const [editMode, setEditMode] = useState<ModeConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [audioResult, setAudioResult] = useState<string | null>(null);
  const [audioProvider, setAudioProvider] = useState("");
  const [storyboard, setStoryboard] = useState<StoryboardScene[] | null>(null);
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [tier, setTier] = useState<"standard" | "premium">("standard");
  const [videoModel, setVideoModel] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form handlers ──
  function updateField(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  function togglePill(key: string, value: string) {
    setFormData(prev => ({ ...prev, [key]: prev[key] === value ? "" : value }));
  }

  function openEdit(mode: ModeConfig) {
    setEditMode(mode);
    setFormData({});
    setAudioResult(null);
    setStoryboard(null);
    setVideoModel(suggestVideoModel(mode.id));
  }

  function closeEdit() {
    setEditMode(null);
  }

  // ── Generate music ──
  async function handleGenerateMusic() {
    if (!editMode) return;
    setGenerating(true);
    setAudioResult(null);

    try {
      const prompt = [
        formData.prompt || formData.about || formData.direction || editMode.title,
        formData.genre && `genre: ${formData.genre}`,
        formData.mood && `mood: ${formData.mood}`,
        formData.language && `language: ${formData.language}`,
        formData.musicStyle && `style: ${formData.musicStyle}`,
        editMode.id.startsWith("children-") && "children's song, safe, educational, bright, fun",
      ].filter(Boolean).join(", ");

      const durationMatch = (formData.duration ?? "2 min").match(/(\d+)/);
      const durationSeconds = durationMatch ? parseInt(durationMatch[1]) * 60 : 120;

      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          genre: formData.genre,
          mood: formData.mood,
          durationSeconds,
          instrumental: false,
          tier,
          title: formData.prompt?.slice(0, 40) || editMode.title,
        }),
      });

      const data = await res.json();
      if (data.musicPath) {
        const relPath = data.musicPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
        setAudioResult(`/api/media/${relPath}`);
        setAudioProvider(data.provider ?? data.source ?? "");
      }
    } catch { /* ignore */ }
    setGenerating(false);
  }

  // ── Generate storyboard ──
  async function handleGenerateStoryboard() {
    if (!editMode) return;
    setStoryboardLoading(true);

    try {
      const prompt = [
        formData.prompt || formData.about || formData.story || editMode.title,
        formData.genre && `genre: ${formData.genre}`,
        formData.visualStyle && `visual style: ${formData.visualStyle}`,
        formData.textStyle && `text style: ${formData.textStyle}`,
        formData.bgStyle && `background: ${formData.bgStyle}`,
      ].filter(Boolean).join(", ");

      const res = await fetch("/api/auto-creator/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion: {
            title: editMode.title,
            type: editMode.id,
            style: formData.visualStyle ?? "cinematic",
            description: prompt,
            caption_preview: "",
            cta: "",
            music_mood: formData.mood ?? formData.genre ?? "cinematic",
          },
          context: `Music video storyboard for: ${prompt}. Mode: ${editMode.title}. Generate 4-6 scenes with visual prompts.`,
        }),
      });

      const data = await res.json();
      if (data.draft) {
        // Convert draft into storyboard scenes
        const scenes: StoryboardScene[] = [
          { scene: 1, purpose: "Intro", duration: "10s", prompt: `Opening scene: ${data.draft.title}`, style: formData.visualStyle ?? "cinematic", movement: "Slow zoom in" },
          { scene: 2, purpose: "Verse 1", duration: "30s", prompt: data.draft.voice_script?.split(".")[0] || prompt, style: formData.visualStyle ?? "cinematic", movement: "Lateral pan" },
          { scene: 3, purpose: "Chorus", duration: "20s", prompt: `High energy: ${data.draft.caption?.split(".")[0] || "Dynamic visual"}`, style: formData.visualStyle ?? "cinematic", movement: "Beat punch cuts" },
          { scene: 4, purpose: "Verse 2", duration: "30s", prompt: data.draft.voice_script?.split(".")[1] || "Continuation", style: formData.visualStyle ?? "cinematic", movement: "Smooth glide" },
          { scene: 5, purpose: "Outro", duration: "10s", prompt: `Closing: ${data.draft.cta || "Fade out"}`, style: formData.visualStyle ?? "cinematic", movement: "Slow zoom out" },
        ];
        setStoryboard(scenes);
      }
    } catch { /* ignore */ }
    setStoryboardLoading(false);
  }

  // ── Route to existing editors ──
  function routeToEditor() {
    if (audioResult) {
      window.location.href = `/dashboard/music-studio`;
    } else {
      window.location.href = `/dashboard/music-studio`;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Hero ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,92,252,0.08)", border: "1px solid rgba(124,92,252,0.2)", padding: "5px 14px", borderRadius: 100, fontSize: 11, fontWeight: 500, color: accent, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 20 }}>
          <span style={{ width: 6, height: 6, background: accent, borderRadius: "50%" }} /> AI Studio
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 12 }}>
          Create anything.<br /><span style={{ color: accent }}>Music. Video. Magic.</span>
        </h1>
        <p style={{ fontSize: 15, color: muted, maxWidth: 560, lineHeight: 1.7 }}>
          Turn your images, text, or voice into full music videos, animated songs, and AI content — in minutes.
        </p>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: "flex", gap: 4, background: surface, border: `1px solid ${border}`, padding: 4, borderRadius: 14, width: "fit-content", marginBottom: 40 }}>
        {([
          { key: "music" as const, label: "Music Studio" },
          { key: "video" as const, label: "Music Video Studio" },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "10px 24px", borderRadius: 10, border: tab === t.key ? `1px solid ${border2}` : "none",
              background: tab === t.key ? surface2 : "transparent",
              color: tab === t.key ? "#fff" : muted,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: tab === t.key ? accent : "#3d5060" }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* MUSIC STUDIO TAB                                     */}
      {/* ════════════════════════════════════════════════════ */}
      {tab === "music" && (
        <>
          <SectionLabel text="Choose your creation mode" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 48 }}>
            {MUSIC_MODES.map(m => <ModeCard key={m.id} mode={m} onClick={() => openEdit(m)} />)}
          </div>

          {/* Children's Music Section */}
          <div style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.05), rgba(236,72,153,0.05))",
            border: "1px solid rgba(168,85,247,0.15)", borderRadius: 24, padding: 36, marginBottom: 48,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: 36, top: "50%", transform: "translateY(-50%)", fontSize: 80, opacity: 0.12 }}>🎠</div>
            <SectionLabel text="For children" />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.5px" }}>
              Children&apos;s Music Studio
            </h2>
            <p style={{ fontSize: 14, color: muted, maxWidth: 480, lineHeight: 1.6, marginBottom: 24 }}>
              Create fun, educational songs for kids — alphabet songs, counting songs, nursery rhymes, animal songs, and more. Safe, colourful, and joyful. In English, Yoruba, Igbo, Hausa, and Pidgin.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {CHILDREN_MODES.map(m => (
                <button key={m.id} onClick={() => openEdit(m)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: surface, border: `1px solid ${border2}`, borderRadius: 12,
                    padding: "10px 16px", cursor: "pointer", transition: "all 0.2s",
                  }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: muted }}>{m.description.slice(0, 40)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* MUSIC VIDEO STUDIO TAB                               */}
      {/* ════════════════════════════════════════════════════ */}
      {tab === "video" && (
        <>
          {/* Feature highlights */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 40 }}>
            {[
              { icon: "🎬", title: "Beat-Synced Cuts", desc: "Every video cut lands on a beat. Automatic. Professional." },
              { icon: "🎵", title: "Full Song Generation", desc: "GHS writes and produces a complete song — lyrics, vocals, beat." },
              { icon: "🗺️", title: "Scene Planning", desc: "AI maps each section of your song to a matching visual scene." },
              { icon: "📝", title: "Lyric Overlay", desc: "Words appear on screen exactly as they are sung." },
              { icon: "🌍", title: "African Genres", desc: "Afrobeats, Amapiano, Highlife, Gospel, Fuji, Drill and more." },
              { icon: "📱", title: "Platform Cuts", desc: "Auto-generates YouTube, Reels, and TikTok versions." },
            ].map(f => (
              <div key={f.title} style={{ background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 500, color: "#fff", marginBottom: 3 }}>{f.title}</h4>
                  <p style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <SectionLabel text="Choose your music video mode" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 48 }}>
            {VIDEO_MODES.map(m => <ModeCard key={m.id} mode={m} onClick={() => openEdit(m)} />)}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* SLIDE-UP EDIT PANEL                                  */}
      {/* ════════════════════════════════════════════════════ */}
      {editMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          {/* Backdrop */}
          <div onClick={closeEdit} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} />

          {/* Panel */}
          <div style={{
            position: "relative", width: "100%", maxHeight: "92vh",
            background: surface, borderTop: `1px solid ${border2}`,
            borderRadius: "28px 28px 0 0", overflowY: "auto", zIndex: 1,
            animation: "slideUp 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: border2, borderRadius: 2, margin: "16px auto 0" }} />

            <div style={{ padding: "24px 40px 40px", maxWidth: 900, margin: "0 auto" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
                  <span>{editMode.icon}</span> {editMode.title}
                </div>
                <button onClick={closeEdit} style={{ width: 36, height: 36, background: surface2, border: `1px solid ${border}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: muted, fontSize: 18 }}>
                  ×
                </button>
              </div>

              {/* Dynamic form fields */}
              {editMode.fields.map(field => (
                <div key={field.key} style={{ marginBottom: 24 }}>
                  {field.type === "info" && (
                    <div style={{ background: `${COLORS[field.infoColor ?? "purple"].bg}`, border: `1px solid ${COLORS[field.infoColor ?? "purple"].border}`, borderRadius: 14, padding: 16 }}>
                      <p style={{ fontSize: 13, color: COLORS[field.infoColor ?? "purple"].text, lineHeight: 1.6 }}>{field.infoText}</p>
                    </div>
                  )}

                  {field.type !== "info" && (
                    <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10, display: "block" }}>
                      {field.label} {field.required && "*"}
                    </label>
                  )}

                  {field.type === "textarea" && (
                    <textarea
                      value={formData[field.key] ?? ""}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, fontWeight: 300, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                    />
                  )}

                  {field.type === "text" && (
                    <input
                      type="text"
                      value={formData[field.key] ?? ""}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, fontWeight: 300, outline: "none" }}
                    />
                  )}

                  {field.type === "select" && (
                    <select
                      value={formData[field.key] ?? field.options?.[0] ?? ""}
                      onChange={e => updateField(field.key, e.target.value)}
                      style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14, fontWeight: 300, outline: "none" }}
                    >
                      {field.options?.map(o => <option key={o} value={o} style={{ background: surface }}>{o}</option>)}
                    </select>
                  )}

                  {field.type === "pills" && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {field.options?.map(o => (
                        <button key={o} onClick={() => togglePill(field.key, o)}
                          style={{
                            padding: "8px 16px", borderRadius: 100,
                            border: `1px solid ${formData[field.key] === o ? COLORS[editMode.color].text : border}`,
                            background: formData[field.key] === o ? COLORS[editMode.color].text : "transparent",
                            color: formData[field.key] === o ? "#000" : muted,
                            fontSize: 13, cursor: "pointer", fontWeight: formData[field.key] === o ? 500 : 400,
                            transition: "all 0.2s",
                          }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  )}

                  {(field.type === "upload" || field.type === "upload-multi") && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{ border: `2px dashed ${border2}`, borderRadius: 16, padding: 40, textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 12 }}>{editMode.icon}</div>
                      <p style={{ fontSize: 14, color: muted }}>
                        Tap to upload<br />
                        <strong style={{ color: COLORS[editMode.color].text }}>{field.label}</strong>
                      </p>
                      <input ref={fileInputRef} type="file" accept={field.accept} multiple={field.type === "upload-multi"} style={{ display: "none" }}
                        onChange={e => { if (e.target.files?.[0]) updateField(field.key, e.target.files[0].name); }} />
                      {formData[field.key] && <p style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>Selected: {formData[field.key]}</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* ── Tier selector (for music generation) ── */}
              {editMode.generateAction === "music" && (
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 10, display: "block" }}>
                    Music Quality
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setTier("standard")}
                      style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1px solid ${tier === "standard" ? "#22c55e" : border}`, background: tier === "standard" ? "rgba(34,197,94,0.08)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Standard</p>
                      <p style={{ fontSize: 11, color: muted }}>Standard — 1 credit/song</p>
                    </button>
                    <button onClick={() => setTier("premium")}
                      style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1px solid ${tier === "premium" ? "#f59e0b" : border}`, background: tier === "premium" ? "rgba(245,158,11,0.08)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Premium</p>
                      <p style={{ fontSize: 11, color: muted }}>Premium — 3 credits/song</p>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Audio result player ── */}
              {audioResult && (
                <div style={{ background: "#080b10", border: `1px solid ${COLORS[editMode.color].border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: COLORS[editMode.color].text, marginBottom: 12 }}>
                    Your music is ready
                  </p>
                  <audio ref={audioRef} src={audioResult} controls style={{ width: "100%", marginBottom: 12 }} />
                  <p style={{ fontSize: 10, color: muted }}>Provider: {audioProvider}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={routeToEditor}
                      style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Open in Music Editor
                    </button>
                    {editMode.generateAction === "music" && (
                      <button onClick={handleGenerateStoryboard} disabled={storyboardLoading}
                        style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        {storyboardLoading ? "Planning..." : "Create Music Video"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Storyboard preview ── */}
              {storyboard && (
                <div style={{ background: "#080b10", border: `1px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#22c55e", marginBottom: 16 }}>
                    Storyboard Preview — {storyboard.length} scenes
                  </p>
                  {storyboard.map(s => (
                    <div key={s.scene} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${border}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: muted, flexShrink: 0 }}>
                        {s.scene}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.purpose}</p>
                          <span style={{ fontSize: 10, color: muted }}>{s.duration}</span>
                        </div>
                        <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>{s.prompt}</p>
                        <p style={{ fontSize: 10, color: "#5a7080", marginTop: 2 }}>{s.style} &middot; {s.movement}</p>
                      </div>
                    </div>
                  ))}

                  {/* ── Video Model Selector ── */}
                  <div style={{ marginTop: 20, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#a855f7" }}>
                        Choose Video AI Model
                      </p>
                      <span style={{ fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(34,197,94,0.2)" }}>
                        AI suggests: {VIDEO_MODELS.find(m => m.id === suggestVideoModel(editMode.id))?.name}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {VIDEO_MODELS.map(m => {
                        const isSelected = videoModel === m.id;
                        const isSuggested = suggestVideoModel(editMode.id) === m.id;
                        return (
                          <button key={m.id} onClick={() => setVideoModel(m.id)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                              border: `1px solid ${isSelected ? "#a855f7" : border}`,
                              background: isSelected ? "rgba(168,85,247,0.08)" : "transparent",
                              transition: "all 0.2s", textAlign: "left",
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: "50%",
                                border: `2px solid ${isSelected ? "#a855f7" : "#3d5060"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7" }} />}
                              </div>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.name}</span>
                                  {m.badge && (
                                    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: m.badge === "Best quality" ? "rgba(168,85,247,0.15)" : "rgba(34,197,94,0.15)", color: m.badge === "Best quality" ? "#a855f7" : "#22c55e", fontWeight: 600 }}>
                                      {m.badge}
                                    </span>
                                  )}
                                  {isSuggested && !m.badge && (
                                    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: "rgba(0,212,255,0.12)", color: "#00d4ff", fontWeight: 600 }}>
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 10, color: muted }}>{m.bestFor}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{m.cost}</span>
                              <span style={{ fontSize: 9, color: muted, display: "block" }}>{m.speed} &middot; {m.quality}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Cost estimate */}
                    {(() => {
                      const selected = VIDEO_MODELS.find(m => m.id === videoModel);
                      const creditMap: Record<string, number> = { "kling3-pro": 4, "kling2": 1, "seedance": 2, "hailuo-fast": 2, "hailuo-pro": 4, "wan25": 1 };
                      const creditsPerScene = creditMap[videoModel] ?? 2;
                      const totalEst = creditsPerScene * storyboard.length;
                      return (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                          <span style={{ fontSize: 11, color: "#f59e0b" }}>
                            Estimated: {storyboard.length} scenes × {creditsPerScene} credits
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>{totalEst} credits</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "none", background: "#22c55e", color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      Approve & Render ({VIDEO_MODELS.find(m => m.id === videoModel)?.name})
                    </button>
                    <button onClick={() => setStoryboard(null)} style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, cursor: "pointer" }}>
                      Edit
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 8 }}>Credits will be charged after approval only</p>
                </div>
              )}

              {/* ── Generate button ── */}
              {!audioResult && !storyboard && (
                <button
                  onClick={editMode.generateAction === "music" ? handleGenerateMusic : handleGenerateStoryboard}
                  disabled={generating || storyboardLoading}
                  style={{
                    width: "100%", padding: 16, border: "none", borderRadius: 14,
                    background: generating || storyboardLoading ? "#2a2a40" : COLORS[editMode.color].text,
                    color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    marginTop: 32, transition: "all 0.2s",
                  }}>
                  {generating || storyboardLoading ? "Creating..." : `✦ ${editMode.generateLabel}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-up animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2.5, textTransform: "uppercase", color: "#3d5060", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
      {text}
      <div style={{ flex: 1, height: 1, background: "#1e2a35" }} />
    </div>
  );
}

function ModeCard({ mode, onClick }: { mode: ModeConfig; onClick: () => void }) {
  const c = COLORS[mode.color];
  return (
    <div onClick={onClick}
      style={{
        position: "relative", background: "#0e1318", border: "1px solid #1e2a35",
        borderRadius: 20, padding: 28, cursor: "pointer", transition: "all 0.3s",
        overflow: "hidden",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c.border; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a35"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      <span style={{ position: "absolute", top: 28, right: 28, color: "#3d5060", fontSize: 18 }}>↗</span>
      <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18, background: c.bg, color: c.text }}>
        {mode.icon}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.3px" }}>
        {mode.title}
      </h3>
      <p style={{ fontSize: 13, color: "#5a7080", lineHeight: 1.6, marginBottom: 20 }}>
        {mode.description}
      </p>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase", padding: "4px 10px", borderRadius: 100, border: `1px solid ${c.border}`, background: c.bg, color: c.text }}>
        ✦ {mode.tag}
      </span>
    </div>
  );
}
