// GET /api/voices/providers — list all voice providers and their status
import { NextResponse } from "next/server";

export async function GET() {
  const providers = [
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      quality: "premium",
      configured: !!process.env.ELEVENLABS_API_KEY,
      description: "Best quality, Nigerian accent profiles, premium voices",
      cost: "~$0.02/generation",
    },
    {
      id: "cartesia",
      name: "Cartesia",
      quality: "premium",
      configured: !!process.env.CARTESIA_API_KEY,
      description: "Ultra-low latency, high quality, real-time preview",
      cost: "~$0.01/generation",
    },
    {
      id: "fish_audio",
      name: "Fish Audio",
      quality: "good",
      configured: !!process.env.FISH_AUDIO_API_KEY,
      description: "80% cheaper than ElevenLabs, good for high volume",
      cost: "~$0.004/generation",
    },
    {
      id: "piper",
      name: "Piper TTS",
      quality: "basic",
      configured: true, // always available (local)
      description: "Free local TTS, runs on CPU, no API key needed",
      cost: "Free",
    },
    {
      id: "mock_voice",
      name: "Mock (Silent)",
      quality: "none",
      configured: true,
      description: "Silent audio for testing",
      cost: "Free",
    },
  ];

  return NextResponse.json({ providers });
}
