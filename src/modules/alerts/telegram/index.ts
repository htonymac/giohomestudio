// GioHomeStudio — Telegram Alert Provider Adapter

import axios from "axios";
import { env } from "@/config/env";
import type { IAlertProvider, AlertInput, AlertOutput } from "@/types/providers";

class TelegramAlertProvider implements IAlertProvider {
  readonly name = "telegram";

  async send(input: AlertInput): Promise<AlertOutput> {
    const { botToken, chatId } = env.telegram;

    if (!botToken || !chatId) {
      return { status: "failed", error: "Telegram credentials not configured." };
    }

    let message = input.message;

    // Append content item link if provided
    if (input.contentItemId) {
      message += `\n\n🔗 Review: ${env.appUrl}/dashboard/review/${input.contentItemId}`;
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }
      );

      const messageId = String(response.data?.result?.message_id ?? "");
      return { status: "sent", messageId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "failed", error: message };
    }
  }
}

export const telegramAlertProvider: IAlertProvider = new TelegramAlertProvider();
