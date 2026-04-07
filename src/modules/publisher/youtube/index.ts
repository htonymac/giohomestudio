// GioHomeStudio — YouTube Publisher
// Uploads videos to YouTube via Data API v3 with OAuth2.
//
// Setup:
// 1. Create project at https://console.cloud.google.com
// 2. Enable YouTube Data API v3
// 3. Create OAuth2 credentials (Desktop app or Web app)
// 4. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env
// 5. User authorizes via /api/publish/youtube/auth → stores refresh token
//
// Token storage: storage/config/youtube-tokens.json

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { env } from "@/config/env";
import type { IPublisher, PublishInput, PublishOutput } from "../types";

const TOKEN_FILE = () => path.resolve(env.storagePath, "config", "youtube-tokens.json");

interface YouTubeTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

function loadTokens(): YouTubeTokens | null {
  try {
    const raw = fs.readFileSync(TOKEN_FILE(), "utf-8");
    return JSON.parse(raw);
  } catch { return null; }
}

function saveTokens(tokens: YouTubeTokens) {
  const dir = path.dirname(TOKEN_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE(), JSON.stringify(tokens, null, 2));
}

// Get YouTube OAuth2 credentials from env
function getCredentials(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${env.appUrl}/api/publish/youtube/callback`;
  return { clientId, clientSecret, redirectUri };
}

async function refreshAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  const tokens = loadTokens();
  if (!creds || !tokens?.refresh_token) return null;

  // If token is still valid (with 5-min buffer), return it
  if (tokens.access_token && tokens.expires_at > Date.now() + 300000) {
    return tokens.access_token;
  }

  try {
    const res = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    });

    const newTokens: YouTubeTokens = {
      access_token: res.data.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (res.data.expires_in ?? 3600) * 1000,
    };
    saveTokens(newTokens);
    return newTokens.access_token;
  } catch (err) {
    console.error("[YouTube] Token refresh failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Build OAuth2 authorization URL
export function getAuthUrl(): string | null {
  const creds = getCredentials();
  if (!creds) return null;

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: creds.redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube",
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange authorization code for tokens
export async function exchangeCode(code: string): Promise<boolean> {
  const creds = getCredentials();
  if (!creds) return false;

  try {
    const res = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: creds.redirectUri,
      grant_type: "authorization_code",
    });

    const tokens: YouTubeTokens = {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_at: Date.now() + (res.data.expires_in ?? 3600) * 1000,
    };
    saveTokens(tokens);
    console.log("[YouTube] OAuth tokens saved successfully");
    return true;
  } catch (err) {
    console.error("[YouTube] Code exchange failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

class YouTubePublisher implements IPublisher {
  readonly platform = "youtube";

  isConfigured(): boolean {
    const creds = getCredentials();
    const tokens = loadTokens();
    return !!(creds && tokens?.refresh_token);
  }

  async publish(input: PublishInput): Promise<PublishOutput> {
    const accessToken = await refreshAccessToken();
    if (!accessToken) {
      return { status: "failed", platform: this.platform, error: "YouTube not authorized. Go to Settings → connect YouTube." };
    }

    if (!fs.existsSync(input.mediaPath)) {
      return { status: "failed", platform: this.platform, error: `Media file not found: ${input.mediaPath}` };
    }

    const fileSize = fs.statSync(input.mediaPath).size;
    const description = [input.caption, input.tags?.map(t => `#${t}`).join(" ")].filter(Boolean).join("\n\n");

    try {
      // Step 1: Initiate resumable upload
      const initRes = await axios.post(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          snippet: {
            title: input.title.slice(0, 100),
            description: description.slice(0, 5000),
            tags: input.tags?.slice(0, 30),
            categoryId: "22", // People & Blogs
          },
          status: {
            privacyStatus: "private", // Start as private, user can change later
            selfDeclaredMadeForKids: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Length": String(fileSize),
            "X-Upload-Content-Type": "video/mp4",
          },
        }
      );

      const uploadUrl = initRes.headers.location;
      if (!uploadUrl) {
        return { status: "failed", platform: this.platform, error: "No upload URL returned" };
      }

      // Step 2: Upload video data
      console.log(`[YouTube] Uploading ${(fileSize / 1024 / 1024).toFixed(1)}MB...`);
      const uploadRes = await axios.put(uploadUrl, fs.createReadStream(input.mediaPath), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(fileSize),
        },
        maxContentLength: 256 * 1024 * 1024, // 256MB
        timeout: 600000, // 10 min timeout
      });

      const videoId = uploadRes.data?.id;
      const postUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined;

      console.log(`[YouTube] Published: ${postUrl}`);
      return { status: "published", platform: this.platform, postId: videoId, postUrl };
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `YouTube API ${err.response.status}: ${JSON.stringify(err.response.data?.error?.message ?? err.message)}`
        : err instanceof Error ? err.message : String(err);
      console.error(`[YouTube] Publish failed:`, message);
      return { status: "failed", platform: this.platform, error: message };
    }
  }
}

export const youtubePublisher: IPublisher = new YouTubePublisher();
