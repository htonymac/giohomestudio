# GHS — Linux Migration Runbook

Run this end-to-end on the target Linux box (Contabo VPS 30 / Ubuntu 22.04 per `Linux-Migration\00_MASTER_SERVER_PLAN.md`).

GHS is the **last project** in the onboarding order: Marabiz → HMKSync → GioBiz → Giolog → **GHS**. Don't run this until earlier projects are stable on the server.

---

## 1. System packages (apt)

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  python3 python3-pip python3-venv \
  ffmpeg \
  fonts-dejavu fonts-liberation \
  postgresql-client \
  git curl wget unzip
```

Verify:
```bash
ffmpeg -version | head -1     # ffmpeg N.N
ffprobe -version | head -1
python3 --version             # 3.10+ (3.11 or 3.12 preferred over 3.13 — Tier 2-4 ML deps fragile on 3.13)
```

If `python3 --version` shows 3.13: `sudo apt install -y python3.11 python3.11-venv` and use `python3.11` in the venv command below.

---

## 2. Python venv + audio stack

```bash
cd /home/ghs/giohomestudio          # adjust to actual deploy path
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

# Tier 1 — REQUIRED (Karaoke MVP + Ears Check)
pip install faster-whisper librosa soundfile

# Tier 2 — Karaoke melody → MIDI
pip install basic-pitch
# Note: basic-pitch pulls TensorFlow. On Ubuntu 22.04 + Python 3.11 this works clean.
# On Python 3.13 it may fail — that's why we waited for Linux.

# Tier 3 — Vocal isolation (heavy: ~5GB models, ~10min first run)
pip install demucs torch
# CPU-only torch is fine. For GPU: pip install torch --index-url https://download.pytorch.org/whl/cu121

# Tier 4 — Voice enhancement (RVC) — optional
git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git ~/rvc
cd ~/rvc
pip install -r requirements.txt
cd /home/ghs/giohomestudio
```

Verify all:
```bash
python -c "import librosa, soundfile, basic_pitch, demucs, torch; from faster_whisper import WhisperModel; print('all OK')"
```

---

## 3. Piper TTS

```bash
mkdir -p ~/piper && cd ~/piper
wget https://github.com/rhasspy/piper/releases/latest/download/piper_amd64.tar.gz
tar -xzf piper_amd64.tar.gz
chmod +x piper/piper
ln -s ~/piper/piper /usr/local/bin/piper        # so just `piper` works on PATH

# Voice models — match what the codebase calls (en_US-lessac, en_US-amy, en_US-joe, etc).
# Download from https://rhasspy.github.io/piper-samples/
mkdir -p ~/piper/voices
cd ~/piper/voices
# Example for en_US-lessac-medium:
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
# Repeat for amy, joe, danny, hfc_female (see app/api/hybrid/narrate-piper/route.ts for full list)
```

---

## 4. `.env` — flip to Linux paths

Edit `/home/ghs/giohomestudio/.env`:

```bash
# was: C:\ffmpeg\bin\ffmpeg.exe
FFMPEG_PATH=ffmpeg

# was: C:\ffmpeg\bin\ffprobe.exe
FFPROBE_PATH=ffprobe

# was: C:/Users/USER/AppData/Local/Programs/Python/Python313/python.exe
PYTHON_BIN=/home/ghs/giohomestudio/.venv/bin/python

# was: C:/Users/USER/piper/piper.exe
PIPER_BIN=/usr/local/bin/piper

# was: C:\Windows\Fonts
FONT_DIR=/usr/share/fonts

# Database — point to the Postgres on the same VPS or an external host
DATABASE_URL=postgresql://ghs:CHANGE_ME@localhost:5432/giohomestudio_db
```

Copy other secrets (ANTHROPIC_API_KEY, FAL_KEY, KIE_AI_API_KEY, MUBERT_PAT, ELEVENLABS_API_KEY, NEXTAUTH_SECRET, etc.) from a SOPS-encrypted vault, NOT from the Windows .env file.

---

## 5. Postgres + Prisma

```bash
sudo -u postgres psql -c "CREATE USER ghs WITH PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -c "CREATE DATABASE giohomestudio_db OWNER ghs;"

cd /home/ghs/giohomestudio
npx prisma generate
npx prisma db push --accept-data-loss

# Seed essential data if there's a seed script
[ -f prisma/seed.ts ] && npx prisma db seed
```

---

## 6. Storage

```bash
mkdir -p storage/{audio,music/stock,video/assembled,images,characters,karaoke,continuous-motion/test}
chown -R ghs:ghs storage
```

Copy `storage/music/stock/*.mp3` from the Windows machine — these are the fallback stock-library tracks for the Music Provider's `stock` adapter.

---

## 7. Build + run

```bash
cd /home/ghs/giohomestudio
pnpm install   # or npm install — match what's in CI
pnpm build     # next build — run THIS first, fix any TS errors before going further
pnpm start     # next start -p 3200
```

Behind nginx reverse proxy + systemd service, per the master server plan.

---

## 8. Smoke test (the strict serious test)

Before declaring GHS migrated:

1. `curl http://localhost:3200/dashboard/hybrid-planner` returns 200.
2. Run Playwright: `npx playwright test tests/restore-teddy-project.spec.ts --reporter=list --timeout=600000`. 1 pass = full Teddy & Dog assembly OK.
3. `curl -X POST http://localhost:3200/api/karaoke/analyze` against an existing audio in `storage/` returns valid JSON with `tempo_bpm` + `transcription`.
4. `curl -X POST http://localhost:3200/api/continuous-motion/plan` with `{ providerKey: "wan", prompt:"test", totalDurationSeconds:5, segmentDurationSeconds:5 }` returns scene id (real Wan call requires FAL Wan Pro entitlement).
5. Open `/auth/register` — single bundled legal consent checkbox renders.
6. Open `/dashboard/karaoke-studio` — Voice Recorder + Upload zone render.

If all 6 pass, GHS is live on Linux.

---

## 9. Outstanding post-migration work

These can be deferred until after migration is stable:

- [ ] CMF Sessions 4-5 may need provider-key gates if FAL Wan Pro / Kling 2.5 entitlement still pending — check via `npx playwright test tests/continuous-motion-foundation.spec.ts`. If 4 SKIPS → enable models at fal.ai/dashboard/models.
- [ ] Karaoke Tier 4 (RVC) UI integration — only Tier 1-3 are wired. RVC needs separate `app/api/karaoke/voice-enhance` route + UI button.
- [ ] Phase 6 Continuous Motion: real pause/cancel engine (currently buttons disabled with "Phase 5" tooltip).
- [ ] Music Provider: actual Mubert key (`MUBERT_PAT`) + Kie.ai key (`KIE_API_KEY`) need entry in vault.

---

## 10. Rollback

If migration breaks:
- DNS still points at Windows machine (don't flip DNS until smoke test passes).
- Keep Windows machine running for 7 days after migration.
- All commits in `main` branch — `git checkout <pre-migration-tag>` rolls code back.

Tag the last green Windows build before starting:
```bash
git tag -a windows-final-2026-04-26 -m "Last green build on Windows"
git push origin windows-final-2026-04-26
```
