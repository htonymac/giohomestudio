# HENRY — check-in / blocked-on-Henry queue (GHS)

Terry writes here when something is genuinely blocked on you. Read on return, clear in a batch.
Last cleaned: 2026-07-04 (removed stale: #4 prod build shipped 2026-06-19 PR #157; #1/#3 long live).

## ⏸ PARKED — needs Henry

### A — ghs.service KillMode fix — NEEDS YOUR SUDO, 60 seconds (do this first)
- **Why:** `ghs.service` has `KillMode=process` — every `systemctl restart` kills only the npm wrapper and ORPHANS the real `next-server`, which keeps holding :3200. The new instance then crash-loops "activating" while the OLD code keeps serving. Caused the deploy failures on 2026-06-19 and twice on 2026-07-04. Agents kill orphans by PID each time (agent sudo scope can't edit units).
- **Fix (run as admin on the server):**
  ```
  sudo mkdir -p /etc/systemd/system/ghs.service.d
  printf '[Service]\nKillMode=control-group\n' | sudo tee /etc/systemd/system/ghs.service.d/override.conf
  sudo systemctl daemon-reload && sudo systemctl restart ghs.service
  ```
  Also worth deleting the duplicate `KillMode=process` lines from the main unit file. After this, deploys stop orphaning servers permanently.

### B — Test the 2026-07-03 fixes (your eyeball, ~10 min)
1. **Paste your real 18-scene ChatGPT script** into Hybrid Planner → Expand. Expect: "Script used exactly as written — 18 scenes, ~60 min total, no AI rewrite." Same in Children planner.
2. **Type your 4-topic brief** ("60 MIN - SPELLING 2 TO 5 LETTER 20 MIN - ALPHABET 10 MIN - PLAY 15 MIN - 3 BEDTIME STORIES") in Children Video → expect topic-by-topic build: spelling card rounds, ABC cards, play segment, 3 separate bedtime stories.
3. **Open andiostudio.com on your phone** — hamburger menu, single-column cards, everything tappable. Desktop unchanged.

### C — BullMQ + Redis render queue — NEEDS REDIS PASSWORD
- Redis runs on the box but needs auth (`NOAUTH`); GHS `.env` has no `REDIS_*` keys.
- Set in `/home/ghs/giohomestudio/.env`: `REDIS_URL=redis://:<password>@127.0.0.1:6379`
- Then say **`redis ready`** → I install BullMQ, build queue+worker (cap 2, retries, survives restart), wire the ~10 sync assemble planners behind a flag.

### D — Mara/Cobra subject-object swap — NEEDS YOUR REGEN-CONFIRM
- Fix shipped earlier; regenerate the handcuff/tackle scene and confirm no swap. Still swaps → I escalate to per-scene doer/receiver fields or 2-image composite.

### E — Other standing triggers (say the phrase when you want it)
- **`deploy r2 ok`** — flip media storage to R2 (code merged since 2026-06-19, flag-off no-op; runbook in brain ghs/next-session-todo).
- **`do per-item tts`** — exact per-second card timing + synced narration (needs a supervised render).
- **`go flashcard`** — flashcard builder UI + add-more-topics generator (needs your kid-content safety/design sign-off).

## ✅ Recently shipped (no action needed)
- 2026-07-03/04: story pipeline restructure (verbatim scripts + duration honored + multi-topic builder) + phone/mobile fix — PRs #213–#216, live, browser-verified.
- Earlier: prod build (`next start`, #157), idempotency (#150), temp sweeper (#151), resumable jobs (#152), R2 code (#158).
