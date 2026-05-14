# Recover Gen Max state for hybrid project ghs_hybrid_default.
# Reads disk image files, rebuilds sceneBeatImages map, merges into existing saved-state.
import json
import os
import re
import urllib.request
from collections import defaultdict

PROJECT_ID = "ghs_hybrid_default"
IMAGES_DIR = "C:/Users/USER/Desktop/CLAUDE/giohomestudio/storage/images"
API_BASE = "http://localhost:3200"

# 1. Read existing saved-state so we don't wipe non-Gen-Max fields.
print(f"[recover] fetching existing saved-state for {PROJECT_ID}…")
with urllib.request.urlopen(f"{API_BASE}/api/hybrid/saved-state?localId={PROJECT_ID}") as r:
    existing = json.load(r)
data = existing.get("data") or {}
print(f"[recover] existing state has {len(data)} keys, sceneBeatImages currently empty: "
      f"{not data.get('sceneBeatImages') or not any(data['sceneBeatImages'].values())}")

# 2. Scan image files. Pattern: scene_SC<NN>_b<beat>_<ts1>(_a|_r)?_<ts2>.png
groups = defaultdict(list)
file_pattern = re.compile(r"^scene_(SC\d+)_b(\d+)_(\d+)(?:_[ar])?_?(\d+)?\.png$")
for fn in os.listdir(IMAGES_DIR):
    m = file_pattern.match(fn)
    if not m:
        continue
    sid = m.group(1)
    bi = int(m.group(2))
    ts = int(m.group(3))
    groups[sid].append((bi, ts, fn))

# 3. Build sceneBeatImages map. For each scene, sort by (beat, ts) and take URLs.
# Cap at 30 per scene. URL = /api/media/images/<filename>
scene_beat_images = {}
selected_beat_images = {}
for sid in sorted(groups.keys()):
    items = sorted(groups[sid])
    urls = [f"/api/media/images/{fn}" for _, _, fn in items][-30:]
    scene_beat_images[sid] = urls
    selected_beat_images[sid] = [True] * len(urls)
    print(f"[recover] {sid}: {len(urls)} images")

# 4. Merge into existing data + opt every recovered scene into Use Max Image mode.
data["sceneBeatImages"] = scene_beat_images
data["selectedBeatImages"] = selected_beat_images
existing_opt_in = set(data.get("useMaxImageScenes") or [])
existing_opt_in.update(scene_beat_images.keys())
data["useMaxImageScenes"] = sorted(existing_opt_in)
# Set the first beat URL as the active scene image so the scene card thumbnail renders.
# Only fills slots that are empty — won't overwrite a user-chosen active image.
existing_scene_images = data.get("sceneImages") or {}
for sid, urls in scene_beat_images.items():
    if not existing_scene_images.get(sid) and urls:
        existing_scene_images[sid] = urls[0]
data["sceneImages"] = existing_scene_images
data["timestamp"] = int(__import__("time").time() * 1000)

# 5. PATCH saved-state.
body = json.dumps({"localId": PROJECT_ID, "data": data}).encode()
req = urllib.request.Request(
    f"{API_BASE}/api/hybrid/saved-state",
    method="POST",
    headers={"Content-Type": "application/json"},
    data=body,
)
with urllib.request.urlopen(req) as r:
    resp = json.load(r)
print(f"[recover] saved-state response: {resp}")
print(f"[recover] DONE. Hard refresh hybrid-planner — Gen Max images should be back.")
print(f"[recover] Total images recovered: {sum(len(v) for v in scene_beat_images.values())}")
