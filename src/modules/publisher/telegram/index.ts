// GioHomeStudio — Telegram Channel Publisher
// Posts videos and audio to a Telegram channel/group via Bot API.
// Uses sendVideo for video, sendAudio for audio.
// Supports captions with Markdown formatting.

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import FormData from "form-data";
import { env } from "@/config/env";
import type { IPublisher, PublishInput, PublishOutput } from "../types";

class TelegramPublisher implements IPublisher {
  readonly platform = "telegram";

  isConfigured(): boolean {
    return !!(env.telegram.botToken && env.telegram.chatId);
  }

  async publish(input: PublishInput): Promise<PublishOutput> {
    const { botToken, chatId } = env.telegram;

    if (!botToken || !chatId) {
      return { status: "failed", platform: this.platform, error: "Telegram bot token or chat ID not configured" };
    }

    const targetChat = input.destinationId || chatId;

    if (!fs.existsSync(input.mediaPath)) {
      return { status: "failed", platform: this.platform, error: `Media file not found: ${input.mediaPath}` };
    }

    // Build caption with title + text + tags
    const parts: string[] = [];
    if (input.title) parts.push(`*${input.title}*`);
    if (input.caption) parts.push(input.caption);
    if (input.tags?.length) parts.push(input.tags.map(t => `#${t.replace(/\s+/g, "")}`).join(" "));
    const caption = parts.join("\n\n").slice(0, 1024); // Telegram caption limit

    const form = new FormData();
    form.append("chat_id", targetChat);
    form.append("caption", caption);
    form.append("parse_mode", "Markdown");

    const fileStream = fs.createReadStream(input.mediaPath);
    const fileName = path.basename(input.mediaPath);

    try {
      let endpoint: string;
      if (input.mediaType === "video") {
        endpoint = `https://api.telegram.org/bot${botToken}/sendVideo`;
        form.append("video", fileStream, fileName);
        form.append("supports_streaming", "true");
      } else {
        endpoint = `https://api.telegram.org/bot${botToken}/sendAudio`;
        form.append("audio", fileStream, fileName);
        if (input.title) form.append("title", input.title);
      }

      const response = await axios.post(endpoint, form, {
        headers: form.getHeaders(),
        maxContentLength: 50 * 1024 * 1024, // 50MB limit for Telegram
        timeout: 120000, // 2 minute timeout for large files
      });

      const messageId = String(response.data?.result?.message_id ?? "");
      // Construct post URL (works for public channels)
      const cleanChat = targetChat.replace("@", "");
      const postUrl = messageId ? `https://t.me/${cleanChat}/${messageId}` : undefined;

      console.log(`[TelegramPublisher] Published to ${targetChat}: messageId=${messageId}`);
      return { status: "published", platform: this.platform, postId: messageId, postUrl };
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `Telegram API ${err.response.status}: ${JSON.stringify(err.response.data?.description ?? err.message)}`
        : err instanceof Error ? err.message : String(err);
      console.error(`[TelegramPublisher] Failed:`, message);
      return { status: "failed", platform: this.platform, error: message };
    }
  }
}

export const telegramPublisher: IPublisher = new TelegramPublisher();
