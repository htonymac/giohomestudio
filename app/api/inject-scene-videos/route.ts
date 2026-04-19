// One-time helper: scans storage/videos/ for generated scene videos
// and returns an HTML page that injects them into localStorage when opened in Chrome.
// Visit http://localhost:3200/api/inject-scene-videos to update your project.

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const videoDir = path.join(process.cwd(), "storage", "videos");
  const videos: Record<string, string> = {};

  if (fs.existsSync(videoDir)) {
    const files = fs.readdirSync(videoDir)
      .filter(f => f.match(/scene_SC\d+_\d+\.mp4/))
      .map(f => {
        const m = f.match(/scene_(SC\d+)_(\d+)\.mp4/);
        return m ? { id: m[1], ts: parseInt(m[2]), file: f } : null;
      })
      .filter(Boolean) as { id: string; ts: number; file: string }[];

    // Keep only the latest version per scene
    const latest: Record<string, { ts: number; file: string }> = {};
    for (const v of files) {
      if (!latest[v.id] || v.ts > latest[v.id].ts) {
        latest[v.id] = { ts: v.ts, file: v.file };
      }
    }

    for (const [id, v] of Object.entries(latest)) {
      videos[id] = `/api/media/videos/${v.file}`;
    }
  }

  const videoJson = JSON.stringify(videos, null, 2);
  const sceneList = Object.keys(videos).join(", ") || "none";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GioHomeStudio — Inject Scene Videos</title>
  <style>
    body { font-family: monospace; background: #0a0a0a; color: #e0e0e0; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #00e5ff; }
    pre { background: #1a1a1a; padding: 16px; border-radius: 8px; overflow: auto; font-size: 13px; }
    .success { color: #00ff88; font-size: 18px; font-weight: bold; }
    .error { color: #ff4444; font-size: 18px; font-weight: bold; }
    button { background: #00e5ff; color: #000; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; margin-top: 20px; }
    button:hover { background: #00b8d4; }
    #status { margin-top: 20px; }
  </style>
</head>
<body>
  <h1>GioHomeStudio — Inject Scene Videos</h1>
  <p>Videos found on disk: <strong style="color:#ffd700">${sceneList}</strong></p>
  <pre>${videoJson}</pre>
  <button onclick="injectVideos()">Inject into localStorage → Update Project</button>
  <div id="status"></div>

  <script>
    const videos = ${JSON.stringify(videos)};

    function injectVideos() {
      const status = document.getElementById('status');
      try {
        const ACTIVE_KEY = 'ghs_hybrid_active_proj';
        const activeId = localStorage.getItem(ACTIVE_KEY);
        const projKey = activeId ? 'ghs_hybrid_proj_' + activeId : 'ghs_hybrid_workshop_v2';
        const raw = localStorage.getItem(projKey) || localStorage.getItem('ghs_hybrid_workshop_v2');

        if (!raw) {
          status.innerHTML = '<p class="error">✗ No project found in localStorage. Make sure you have a project loaded in the Hybrid Planner.</p>';
          return;
        }

        const data = JSON.parse(raw);
        if (!data.sceneVideos) data.sceneVideos = {};

        // Merge in new videos (don't overwrite existing ones unless empty)
        let updated = 0;
        for (const [sceneId, url] of Object.entries(videos)) {
          if (!data.sceneVideos[sceneId]) {
            data.sceneVideos[sceneId] = url;
            updated++;
          }
        }

        // Save back to all relevant keys
        const json = JSON.stringify(data);
        localStorage.setItem('ghs_hybrid_workshop_v2', json);
        if (activeId) {
          localStorage.setItem('ghs_hybrid_proj_' + activeId, json);
        }
        if (projKey !== 'ghs_hybrid_workshop_v2') {
          localStorage.setItem(projKey, json);
        }

        const sceneIds = Object.keys(data.sceneVideos).join(', ');
        status.innerHTML = \`
          <p class="success">✓ Done! \${updated} video URL(s) injected.</p>
          <p>All scene videos in project: <strong>\${sceneIds}</strong></p>
          <p><a href="/dashboard/hybrid-planner" style="color:#00e5ff">→ Go to Hybrid Planner to see your videos</a></p>
        \`;
      } catch(e) {
        status.innerHTML = '<p class="error">✗ Error: ' + e.message + '</p>';
      }
    }

    // Auto-inject on load
    window.addEventListener('load', () => {
      if (Object.keys(videos).length > 0) {
        injectVideos();
      } else {
        document.getElementById('status').innerHTML = '<p class="error">✗ No video files found in storage/videos/</p>';
      }
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
