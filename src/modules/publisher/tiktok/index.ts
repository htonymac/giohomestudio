// GioHomeStudio — TikTok Publisher
// Posts videos to TikTok via Content Posting API.
//
// Setup:
// 1. Register at https://developers.tiktok.com
// 2. Create app, request "Video Upload" scope
// 3. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env
// 4. User authorizes via OAuth2
//
// Token storage: storage/config/tiktok-tokens.json
// Docs: https://developers.tiktok.com/doc/content-posting-api-get-started

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { env } from "@/config/env";
import type { IPublisher, PublishInput, PublishOutput } from "../types";

const TOKEN_FILE = () => path.resolve(env.storagePath, "config", "tiktok-tokens.json");
const API_BASE = "https://open.tiktokapis.com/v2";

interface TikTokTokens {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_at: number;
}

function loadTokens(): TikTokTokens | null {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE(), "utf-8")); } catch { return null; }
}

function saveTokens(tokens: TikTokTokens) {
  const dir = path.dirname(TOKEN_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE(), JSON.stringify(tokens, null, 2));
}

function getCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) return null;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${env.appUrl}/api/publish/tiktok/callback`;
  return { clientKey, clientSecret, redirectUri };
}

export function getTikTokAuthUrl(): string | null {
  const creds = getCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_key: creds.clientKey,
    redirect_uri: creds.redirectUri,
    scope: "video.upload,video.publish",
    response_type: "code",
    state: "giohomestudio",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

export async function exchangeTikTokCode(code: string): Promise<boolean> {
  const creds = getCredentials();
  if (!creds) return false;

  try {
    const res = await axios.post(`${API_BASE}/oauth/token/`, {
      client_key: creds.clientKey,
      client_secret: creds.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
    });

    const data = res.data;
    if (data.error?.error_code) {
      console.error("[TikTok] Auth error:", data.error);
      return false;
    }

    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      open_id: data.open_id,
      expires_at: Date.now() + (data.expires_in ?? 86400) * 1000,
    });
    console.log("[TikTok] OAuth tokens saved");
    return true;
  } catch (err) {
    console.error("[TikTok] Code exchange failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function refreshToken(): Promise<string | null> {
  const creds = getCredentials();
  const tokens = loadTokens();
  if (!creds || !tokens) return null;

  if (tokens.expires_at > Date.now() + 300000) return tokens.access_token;

  try {
    const res = await axios.post(`${API_BASE}/oauth/token/`, {
      client_key: creds.clientKey,
      client_secret: creds.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    });

    const newTokens: TikTokTokens = {
      ...tokens,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + (res.data.expires_in ?? 86400) * 1000,
    };
    saveTokens(newTokens);
    return newTokens.access_token;
  } catch {
    return null;
  }
}

class TikTokPublisher implements IPublisher {
  readonly platform = "tiktok";

  isConfigured(): boolean {
    return !!(getCredentials() && loadTokens()?.access_token);
  }

  async publish(input: PublishInput): Promise<PublishOutput> {
    const accessToken = await refreshToken();
    if (!accessToken) {
      return { status: "failed", platform: this.platform, error: "TikTok not authorized. Connect in Settings." };
    }

    if (input.mediaType !== "video") {
      return { status: "failed", platform: this.platform, error: "TikTok only accepts video content." };
    }

    if (!fs.existsSync(input.mediaPath)) {
      return { status: "failed", platform: this.platform, error: `File not found: ${input.mediaPath}` };
    }

    const fileSize = fs.statSync(input.mediaPath).size;
    const title = [input.title, input.caption, input.tags?.map(t => `#${t}`).join(" ")].filter(Boolean).join(" ").slice(0, 150);

    try {
      // Step 1: Initialize upload
      const initRes = await axios.post(`${API_BASE}/post/publish/video/init/`, {
        post_info: {
          title,
          privacy_level: "SELF_ONLY", // Start private, user changes later
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: fileSize,
          chunk_size: fileSize, // single chunk for files under 64MB
          total_chunk_count: 1,
        },
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const uploadUrl = initRes.data.data?.upload_url;
      const publishId = initRes.data.data?.publish_id;

      if (!uploadUrl) {
        return { status: "failed", platform: this.platform, error: `No upload URL: ${JSON.stringify(initRes.data)}` };
      }

      // Step 2: Upload video chunk
      console.log(`[TikTok] Uploading ${(fileSize / 1024 / 1024).toFixed(1)}MB...`);
      await axios.put(uploadUrl, fs.createReadStream(input.mediaPath), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(fileSize),
          "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
        },
        maxContentLength: 256 * 1024 * 1024,
        timeout: 300000,
      });

      // Step 3: Check publish status
      let postId: string | undefined;
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await axios.post(`${API_BASE}/post/publish/status/fetch/`, {
          publish_id: publishId,
        }, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const status = statusRes.data.data?.status;
        if (status === "PUBLISH_COMPLETE") {
          postId = statusRes.data.data?.publicaly_available_post_id?.[0];
          break;
        }
        if (status === "FAILED") {
          const reason = statusRes.data.data?.fail_reason;
          return { status: "failed", platform: this.platform, error: `TikTok rejected: ${reason}` };
        }
        console.log(`[TikTok] Processing: ${status}...`);
      }

      const postUrl = postId ? `https://www.tiktok.com/@/video/${postId}` : undefined;
      console.log(`[TikTok] Published: ${postUrl ?? publishId}`);
      return { status: "published", platform: this.platform, postId: postId ?? publishId, postUrl };
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `TikTok API ${err.response.status}: ${JSON.stringify(err.response.data?.error?.message ?? err.response.data ?? err.message)}`
        : err instanceof Error ? err.message : String(err);
      console.error("[TikTok] Failed:", message);
      return { status: "failed", platform: this.platform, error: message };
    }
  }
}

export const tiktokPublisher: IPublisher = new TikTokPublisher();
