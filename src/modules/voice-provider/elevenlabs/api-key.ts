import { env } from "@/config/env";
import { loadLLMSettings } from "@/lib/llm-settings";

export function getElevenLabsKey(): string {
  return loadLLMSettings().ELEVENLABS_API_KEY || env.elevenlabs.apiKey;
}
