// GioHomeStudio — Facebook Pages Publisher
// Posts videos to a Facebook Page via Graph API.
//
// Setup:
// 1. Create app at https://developers.facebook.com
// 2. Add Facebook Login + Pages API permissions
// 3. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env
// 4. User authorizes → we get a Page Access Token (long-lived)
//
// Token storage: storage/config/facebook-tokens.json

import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import FormData from "form-data";
import { env } from "@/config/env";
import type { IPublisher, PublishInput, PublishOutput } from "../types";

const TOKEN_FILE = () => path.resolve(env.storagePath, "config", "facebook-tokens.json");
const GRAPH_API = "https://graph.facebook.com/v21.0";

interface FacebookTokens {
  userAccessToken: string;
  pageAccessToken: string;
  pageId: string;
  pageName: string;
  expiresAt: number;
}

function loadTokens(): FacebookTokens | null {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE(), "utf-8")); } catch { return null; }
}

function saveTokens(tokens: FacebookTokens) {
  const dir = path.dirname(TOKEN_FILE());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE(), JSON.stringify(tokens, null, 2));
}

function getCredentials() {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return null;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${env.appUrl}/api/publish/facebook/callback`;
  return { appId, appSecret, redirectUri };
}

export function getFacebookAuthUrl(): string | null {
  const creds = getCredentials();
  if (!creds) return null;
  const params = new URLSearchParams({
    client_id: creds.appId,
    redirect_uri: creds.redirectUri,
    scope: "pages_manage_posts,pages_read_engagement,pages_show_list",
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export async function exchangeFacebookCode(code: string): Promise<boolean> {
  const creds = getCredentials();
  if (!creds) return false;

  try {
    // Exchange code for short-lived user token
    const tokenRes = await axios.get(`${GRAPH_API}/oauth/access_token`, {
      params: { client_id: creds.appId, client_secret: creds.appSecret, redirect_uri: creds.redirectUri, code },
    });
    const shortToken = tokenRes.data.access_token;

    // Exchange for long-lived token (60 days)
    const longRes = await axios.get(`${GRAPH_API}/oauth/access_token`, {
      params: { grant_type: "fb_exchange_token", client_id: creds.appId, client_secret: creds.appSecret, fb_exchange_token: shortToken },
    });
    const longToken = longRes.data.access_token;

    // Get user's pages
    const pagesRes = await axios.get(`${GRAPH_API}/me/accounts`, {
      params: { access_token: longToken },
    });
    const pages = pagesRes.data.data;
    if (!pages?.length) {
      console.error("[Facebook] No pages found for this user");
      return false;
    }

    // Use the first page (user can change later)
    const page = pages[0];
    saveTokens({
      userAccessToken: longToken,
      pageAccessToken: page.access_token,
      pageId: page.id,
      pageName: page.name,
      expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000, // ~60 days
    });
    console.log(`[Facebook] Connected to page: ${page.name} (${page.id})`);
    return true;
  } catch (err) {
    console.error("[Facebook] Auth failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

class FacebookPublisher implements IPublisher {
  readonly platform = "facebook";

  isConfigured(): boolean {
    const creds = getCredentials();
    const tokens = loadTokens();
    return !!(creds && tokens?.pageAccessToken);
  }

  async publish(input: PublishInput): Promise<PublishOutput> {
    const tokens = loadTokens();
    if (!tokens?.pageAccessToken) {
      return { status: "failed", platform: this.platform, error: "Facebook not connected. Authorize in Settings." };
    }

    if (!fs.existsSync(input.mediaPath)) {
      return { status: "failed", platform: this.platform, error: `File not found: ${input.mediaPath}` };
    }

    const description = [input.title, input.caption, input.tags?.map(t => `#${t}`).join(" ")].filter(Boolean).join("\n\n");

    try {
      if (input.mediaType === "video") {
        // Upload video via resumable upload
        const form = new FormData();
        form.append("source", fs.createReadStream(input.mediaPath));
        form.append("description", description.slice(0, 5000));
        form.append("access_token", tokens.pageAccessToken);

        const res = await axios.post(`${GRAPH_API}/${tokens.pageId}/videos`, form, {
          headers: form.getHeaders(),
          maxContentLength: 256 * 1024 * 1024,
          timeout: 300000,
        });

        const postId = res.data.id;
        console.log(`[Facebook] Video published: ${postId}`);
        return { status: "published", platform: this.platform, postId, postUrl: `https://www.facebook.com/${postId}` };
      } else {
        // Audio: post as a link/text post (Facebook doesn't support direct audio upload)
        const res = await axios.post(`${GRAPH_API}/${tokens.pageId}/feed`, {
          message: description,
          access_token: tokens.pageAccessToken,
        });
        return { status: "published", platform: this.platform, postId: res.data.id };
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response
        ? `Facebook API ${err.response.status}: ${JSON.stringify(err.response.data?.error?.message ?? err.message)}`
        : err instanceof Error ? err.message : String(err);
      console.error("[Facebook] Publish failed:", message);
      return { status: "failed", platform: this.platform, error: message };
    }
  }
}

export const facebookPublisher: IPublisher = new FacebookPublisher();
