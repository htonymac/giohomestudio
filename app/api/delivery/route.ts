// POST /api/delivery — Send content draft to user's phone for review
//
// Channels:
// - Telegram: sends via Telegram Bot API (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
// - WhatsApp: sends via WhatsApp Web link (opens share dialog)
//
// Purpose: user creates content on desktop, reviews on phone before posting.

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import * as fs from "fs";
import * as path from "path";

interface DeliveryRequest {
  channel: "telegram" | "whatsapp";
  type: "text" | "image" | "video" | "document";
  title: string;
  caption?: string;
  hashtags?: string[];
  mediaUrl?: string; // /api/media/... path
  voiceScript?: string;
  projectId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: DeliveryRequest = await req.json();

    if (!body.channel || !body.title) {
      return NextResponse.json({ error: "channel and title required" }, { status: 400 });
    }

    // Build message text
    const parts: string[] = [];
    parts.push(`📋 *${body.title}*`);
    if (body.caption) parts.push(`\n${body.caption}`);
    if (body.hashtags?.length) parts.push(`\n${body.hashtags.map(h => `#${h}`).join(" ")}`);
    if (body.voiceScript) parts.push(`\n🎙 Voice script:\n_${body.voiceScript}_`);
    parts.push(`\n\n_Sent from GioHomeStudio for review_`);
    const messageText = parts.join("");

    if (body.channel === "telegram") {
      return await sendTelegram(messageText, body);
    }

    if (body.channel === "whatsapp") {
      return sendWhatsApp(messageText, body);
    }

    return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delivery failed" }, { status: 500 });
  }
}

// ── Telegram Bot delivery ──
async function sendTelegram(text: string, body: DeliveryRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json({ error: "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env" }, { status: 400 });
  }

  const baseUrl = `https://api.telegram.org/bot${token}`;

  // Send text message
  const textRes = await fetch(`${baseUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!textRes.ok) {
    const err = await textRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Telegram error: ${JSON.stringify(err)}` }, { status: 500 });
  }

  // Send media if provided
  let mediaSent = false;
  if (body.mediaUrl) {
    const mediaPath = body.mediaUrl.startsWith("/api/media/")
      ? path.join(env.storagePath, body.mediaUrl.replace("/api/media/", ""))
      : body.mediaUrl;

    if (fs.existsSync(mediaPath)) {
      const fileBuffer = fs.readFileSync(mediaPath);
      const fileName = path.basename(mediaPath);
      const formData = new FormData();
      formData.append("chat_id", chatId);

      if (body.type === "image" || mediaPath.match(/\.(jpg|jpeg|png|webp)$/i)) {
        formData.append("photo", new Blob([fileBuffer]), fileName);
        formData.append("caption", body.title);
        const photoRes = await fetch(`${baseUrl}/sendPhoto`, { method: "POST", body: formData });
        mediaSent = photoRes.ok;
      } else if (body.type === "video" || mediaPath.match(/\.(mp4|mov|webm)$/i)) {
        formData.append("video", new Blob([fileBuffer]), fileName);
        formData.append("caption", body.title);
        const videoRes = await fetch(`${baseUrl}/sendVideo`, { method: "POST", body: formData });
        mediaSent = videoRes.ok;
      } else {
        formData.append("document", new Blob([fileBuffer]), fileName);
        formData.append("caption", body.title);
        const docRes = await fetch(`${baseUrl}/sendDocument`, { method: "POST", body: formData });
        mediaSent = docRes.ok;
      }
    }
  }

  return NextResponse.json({
    success: true,
    channel: "telegram",
    messageSent: true,
    mediaSent,
    chatId,
  });
}

// ── WhatsApp Web share link ──
function sendWhatsApp(text: string, body: DeliveryRequest) {
  // WhatsApp doesn't have a direct API for sending without WhatsApp Business API.
  // We generate a share link that opens WhatsApp Web with pre-filled text.
  const cleanText = text.replace(/[*_]/g, ""); // Remove markdown
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(cleanText)}`;

  return NextResponse.json({
    success: true,
    channel: "whatsapp",
    shareUrl,
    instruction: "Open this URL to share via WhatsApp. The text is pre-filled — just select the contact.",
  });
}
