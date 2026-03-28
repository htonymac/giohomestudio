// GioHomeStudio — Env config loader
// All env access goes through this file. Never import process.env directly elsewhere.

function require(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[GioHomeStudio] Missing required env variable: ${key}`);
  return val;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // Database
  databaseUrl: require("DATABASE_URL"),

  // Video provider selection: "runway" | "kling" | "mock_video"
  video: {
    provider: optional("VIDEO_PROVIDER", "runway"),
  },

  // Runway
  runway: {
    apiKey: optional("RUNWAY_API_KEY"),
    baseUrl: optional("RUNWAY_API_BASE_URL", "https://api.dev.runwayml.com"),
  },

  // Kling AI
  kling: {
    accessKey: optional("KLING_ACCESS_KEY"),
    secretKey: optional("KLING_SECRET_KEY"),
    baseUrl: optional("KLING_API_BASE_URL", "https://api.klingai.com"),
  },

  // ElevenLabs
  elevenlabs: {
    apiKey: optional("ELEVENLABS_API_KEY"),
    baseUrl: optional("ELEVENLABS_API_BASE_URL", "https://api.elevenlabs.io/v1"),
  },

  // Telegram
  telegram: {
    botToken: optional("TELEGRAM_BOT_TOKEN"),
    chatId: optional("TELEGRAM_CHAT_ID"),
  },

  // Music provider selection
  music: {
    provider: optional("MUSIC_PROVIDER", "stock_library"),
    kieAiApiKey: optional("KIE_AI_API_KEY"),
    kieAiBaseUrl: optional("KIE_AI_API_BASE_URL", "https://api.kie.ai"),
  },

  // FFmpeg binaries
  ffmpegPath: optional("FFMPEG_PATH", "C:\\ffmpeg\\bin\\ffmpeg.exe"),
  ffprobePath: optional("FFPROBE_PATH", "C:\\ffmpeg\\bin\\ffprobe.exe"),

  // Storage
  storagePath: optional("STORAGE_BASE_PATH", "./storage"),

  // App
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3200"),
  nodeEnv: optional("NODE_ENV", "development"),
} as const;
