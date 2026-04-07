// GioHomeStudio — Instagram Publisher
// Posts Reels to Instagram via Facebook's Instagram Graph API.
//
// Requirements:
// - Instagram Business/Creator account linked to a Facebook Page
// - Same FACEBOOK_APP_ID / FACEBOOK_APP_SECRET used for Facebook publisher
// - Additional permission: instagram_basic, instagram_content_publish
// - Video must be hosted at a public URL (Instagram fetches it)
//
// Flow: Upload video to a temp public URL → create media container → publish
//
// Token storage: storage/config/instagram-tokens.json

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { env } from "@/config/env";
import type { IPublisher, PublishInput, PublishOutput } from "../types";

const TOKEN_FILE = () => path.resolve(env.storagePath, "config", "instagram-tokens.json");
const GRAPH_API = "https://graph.facebook.com/v21.0";

interface InstagramTokens {
  igUserId: string;
  accessToken: string;
  username: string;
}

function loadTokens(): InstagramTokens | null {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE(), "utf-8")); } catch { return null; }
}

function saveTokens(tokens: InstagramTokens) {
  const dir = path.dirname(TOKEN_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE(), JSON.stringify(tokens, null, 2));
}

// After Facebook OAuth, get the Instagram business account linked to the page
export async function connectInstagram(pageAccessToken: string, pageId: string): Promise<boolean> {
  try {
    // Get Instagram Business Account ID linked to this Facebook Page
    const res = await axios.get(`${GRAPH_API}/${pageId}`, {
      params: { fields: "instagram_business_account", access_token: pageAccessToken },
    });

    const igId = res.data.instagram_business_account?.id;
    if (!igId) {
      console.error("[Instagram] No Instagram business account linked to this Facebook Page");
      return false;
    }

    // Get username
    const profileRes = await axios.get(`${GRAPH_API}/${igId}`, {
      params: { fields: "username", access_token: pageAccessToken },
    });

    saveTokens({
      igUserId: igId,
      accessToken: pageAccessToken,
      username: profileRes.data.username ?? "unknown",
    });
    console.log(`[Instagram] Connected: @${profileRes.data.username}`);
    return true;
  } catch (err) {
    console.error("[Instagram] Connect failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

class InstagramPublisher implements IPublisher {
  readonly platform = "instagram";

  isConfigured(): boolean {
    return !!loadTokens()?.igUserId;
  }

  async publish(input: PublishInput): Promise<PublishOutput> {
    const tokens = loadTokens();
    if (!tokens) {
      return { status: "failed", platform: this.platform, error: "Instagram not connected. Link via Facebook in Settings." };
    }

    if (input.mediaType !== "video") {
      return { status: "failed", platform: this.platform, error: "Instagram Reels require video content." };
    }

    // Instagram API requires the video to be at a publicly accessible URL.
    // The app serves media files via /api/media/[...path] — construct that URL.
    const relativePath = path.relative(path.resolve(env.storagePath), input.mediaPath).replace(/\\/g, "/");
    const videoUrl = `${env.appUrl}/api/media/${relativePath}`;

    const caption = [input.title, input.caption, input.tags?.map(t => `#${t}`).join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);

    try {
      // Step 1: Create media container (Reel)
      const containerRes = await axios.post(`${GRAPH_API}/${tokens.igUserId}/media`, null, {
        params: {
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          access_token: tokens.accessToken,
        },
      });
      const containerId = containerRes.data.id;
      console.log(`[Instagram] Container created: ${containerId}`);

      // Step 2: Wait for processing (poll status)
      let ready = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await axios.get(`${GRAPH_API}/${containerId}`, {
          params: { fields: "status_code", access_token: tokens.accessToken },
        });
        const status = statusRes.data.status_code;
        if (status === "FINISHED") { ready = true; break; }
        if (status === "ERROR") {
          return { status: "failed", platform: this.platform, error: "Instagram rejected the video" };
        }
        console.log(`[Instagram] Processing: ${status}...`);
      }

      if (!ready) {
        return { status: "failed", platform: this.platform, error: "Instagram processing timed out" };
      }

      // Step 3: Publish the container
      const publishRes = await axios.post(`${GRAPH_API}/${tokens.igUserId}/media_publish`, null, {
        params: { creation_id: containerId, access_token: tokens.accessToken },
      });

      const postId = publishRes.data.id;
      const postUrl = `https://www.instagram.com/reel/${postId}/`;
      console.log(`[Instagram] Published: ${postUrl}`);
      return { status: "published", platform: this.platform, postId, postUrl };
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `Instagram API ${err.response.status}: ${JSON.stringify(err.response.data?.error?.message ?? err.message)}`
        : err instanceof Error ? err.message : String(err);
      console.error("[Instagram] Failed:", message);
      return { status: "failed", platform: this.platform, error: message };
    }
  }
}

export const instagramPublisher: IPublisher = new InstagramPublisher();
