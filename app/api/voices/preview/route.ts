// POST /api/voices/preview
// Generates a short voice sample (3-5 seconds) using ElevenLabs and streams it back.
// Used by the voice selector UI to let users audition a voice before applying it.
//
// Body: { voiceId, text?, sampleText?, language? }
//   text / sampleText — caller-supplied custom text (either field accepted)
//   language          — ISO 639-1 code or internal tag (e.g. "yo", "pcm", "nigerian_pidgin")
//                       used to pick a language-appropriate fallback sample when no custom text given

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { env } from "@/config/env";

// Language-appropriate sample sentences. Keys match ISO 639-1 codes and our internal tags.
const LANGUAGE_SAMPLES: Record<string, string> = {
  yo:               "Ẹ káàbọ̀ sí GioHomeStudio. Ẹ jẹ́ kí a ṣẹ̀dá àkóónú tó lágbára papọ̀.",
  ig:               "Nnọọ na GioHomeStudio. Ka anyị mee ihe dị mma ọnụ.",
  ha:               "Barka da zuwa GioHomeStudio. Bari mu samar da abun ciki mai ƙarfi tare.",
  sw:               "Karibu GioHomeStudio. Tukiunda maudhui mazuri pamoja.",
  am:               "ወደ GioHomeStudio እንኳን ደህና መጡ። አብረን ጥሩ ይዘት እንፍጠር።",
  zu:               "Sawubona ku GioHomeStudio. Ake senze izinto ezinhle ndawonye.",
  pcm:              "This na GioHomeStudio. We dey make content wey go shake people, no dulling.",
  nigerian_pidgin:  "This na GioHomeStudio. We dey make content wey go shake people, no dulling.",
  fr:               "Bienvenue sur GioHomeStudio. Créons ensemble du contenu remarquable.",
  es:               "Bienvenido a GioHomeStudio. Creemos juntos contenido poderoso.",
  pt:               "Bem-vindo ao GioHomeStudio. Vamos criar conteúdo poderoso juntos.",
  ar:               "مرحباً بك في GioHomeStudio. دعنا نصنع محتوى رائعاً معاً.",
  hi:               "GioHomeStudio में आपका स्वागत है। आइए मिलकर शानदार सामग्री बनाएं।",
  zh:               "欢迎来到GioHomeStudio。让我们一起创造精彩内容。",
  ja:               "GioHomeStudioへようこそ。一緒に素晴らしいコンテンツを作りましょう。",
  ko:               "GioHomeStudio에 오신 것을 환영합니다. 함께 멋진 콘텐츠를 만들어봐요.",
  de:               "Willkommen bei GioHomeStudio. Lasst uns gemeinsam starke Inhalte erstellen.",
};

const DEFAULT_SAMPLE = "Welcome to GioHomeStudio. This voice will narrate your story with clarity and power.";

function getSampleText(customText: string | undefined, language: string | undefined): string {
  if (customText?.trim()) return customText.trim();
  if (language) {
    const key = language.toLowerCase();
    return LANGUAGE_SAMPLES[key] ?? DEFAULT_SAMPLE;
  }
  return DEFAULT_SAMPLE;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const voiceId: string = body.voiceId;

  if (!voiceId) {
    return NextResponse.json({ error: "voiceId required" }, { status: 400 });
  }
  if (!env.elevenlabs.apiKey) {
    return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 503 });
  }

  const sampleText = getSampleText(body.text ?? body.sampleText, body.language);

  try {
    const response = await axios.post(
      `${env.elevenlabs.baseUrl}/text-to-speech/${voiceId}`,
      {
        text: sampleText,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
      {
        headers: {
          "xi-api-key": env.elevenlabs.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        responseType: "arraybuffer",
      }
    );

    return new NextResponse(response.data, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `inline; filename="preview_${voiceId}.mp3"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
