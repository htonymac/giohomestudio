#!/bin/bash
# Install systemd timer for daily karaoke purge.
# Runs once per day at 04:00 server-local time.
# Henry 2026-05-31: 30-day retention enforcement (karaoke spec §19)
#
# Usage: sudo bash scripts/install_karaoke_purge_timer.sh
# Idempotent — safe to re-run.

set -e

SERVICE_FILE=/etc/systemd/system/ghs-karaoke-purge.service
TIMER_FILE=/etc/systemd/system/ghs-karaoke-purge.timer

cat > "$SERVICE_FILE" <<'SERVICE'
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
SERVICE

cat > "$TIMER_FILE" <<'TIMER'
[Unit]
Description=Run GHS karaoke purge daily at 04:00

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true
Unit=ghs-karaoke-purge.service

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now ghs-karaoke-purge.timer
systemctl list-timers --no-pager | grep ghs-karaoke-purge || true
echo "Installed. Next run shown above."
