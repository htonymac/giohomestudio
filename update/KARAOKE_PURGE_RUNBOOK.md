# Karaoke 30-Day Purge — Runbook

## What it does

Daily 04:00 cron deletes `karaoke_recordings` rows where `purgeAt < now()` (and legacy rows older than 31 days with no `purgeAt`) plus all on-disk files for those rows.

Spec reference: karaoke canvas §19 — "Maximum 30 days, auto purge after completion."

---

## Install (one-time, on server)

```bash
ssh hmk
cd /home/ghs/giohomestudio
sudo bash scripts/install_karaoke_purge_timer.sh
```

The script is idempotent — re-running it is safe.

---

## Verify

```bash
# Show timer state + next trigger time
systemctl list-timers ghs-karaoke-purge.timer

# Check service health
systemctl status ghs-karaoke-purge.timer

# Read today's purge log
journalctl -u ghs-karaoke-purge.service --since=today --no-pager
```

---

## Manual run (no timer wait)

```bash
# Dry run — see what WOULD be deleted, nothing touched
sudo -u ghs node /home/ghs/giohomestudio/scripts/karaoke_purge.mjs --dry

# Live run
sudo -u ghs node /home/ghs/giohomestudio/scripts/karaoke_purge.mjs
```

---

## Rollback

```bash
sudo systemctl disable --now ghs-karaoke-purge.timer
sudo rm /etc/systemd/system/ghs-karaoke-purge.{service,timer}
sudo systemctl daemon-reload
```

---

## Output format

Each successful run emits one line to stdout / journal:

```
[karaoke-purge] 2026-06-30T04:00:01Z  rows=12  files=83  freed=412.4 MB  duration=1841ms
```

Search for it:

```bash
journalctl -u ghs-karaoke-purge.service --no-pager | grep '\[karaoke-purge\]'
```

---

## Safety rules

- **Per-row try/catch** — one bad row does NOT abort the run.
- **Files before row** — disk files are unlinked first, then the DB row is deleted. If an unlink throws, the row stays and the next daily run retries.
- **--dry flag** — prints `WOULD DELETE: <path>` and `WOULD DELETE ROW: id=...` for every candidate without acting. Always dry-run first after a deploy or schema change.
- **Legacy guard** — rows with no `purgeAt` are only caught if older than 31 days, preventing accidental purge of brand-new rows.

---

## What gets deleted per row

1. `fileUrl` → disk path (the original voice recording upload)
2. `generatedMusicUrl` → disk path (AI-generated music track)
3. `mixedOutputUrl` → disk path (final mixed output)
4. `storage/karaoke/exports/<id>*` — all export files named with the row id
5. `storage/karaoke/assembled/<id>*` — all assembled mix files
6. `storage/karaoke/demucs/<id>/` — Demucs vocal isolation working directory
7. `storage/karaoke/midi/<id>/` — Basic Pitch MIDI working directory

---

## Systemd unit files (for reference)

`/etc/systemd/system/ghs-karaoke-purge.service`

```ini
[Unit]
Description=GHS karaoke 30-day purge
After=network.target

[Service]
Type=oneshot
User=ghs
WorkingDirectory=/home/ghs/giohomestudio
ExecStart=/usr/bin/node scripts/karaoke_purge.mjs
StandardOutput=journal
StandardError=journal
```

`/etc/systemd/system/ghs-karaoke-purge.timer`

```ini
[Unit]
Description=Run GHS karaoke purge daily at 04:00

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true
Unit=ghs-karaoke-purge.service

[Install]
WantedBy=timers.target
```
