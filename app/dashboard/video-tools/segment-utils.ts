// GioHomeStudio — Timeline segment helpers.
// Phase 1: simulate scene boundaries by dividing duration into equal parts.
// Phase 2 will replace this with real scene detection via ffmpeg scdet filter.

export interface Segment {
  id: string;
  start: number;
  end: number;
}

export function generateSegments(durationSec: number): Segment[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];

  // Target 4 segments; enforce minimum 2s each. For very short videos return fewer.
  const minLen = 2;
  const targetCount = 4;
  const maxCount = Math.max(1, Math.floor(durationSec / minLen));
  const count = Math.min(targetCount, Math.max(1, maxCount));

  const segLen = durationSec / count;
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const start = +(i * segLen).toFixed(2);
    const end = i === count - 1 ? +durationSec.toFixed(2) : +((i + 1) * segLen).toFixed(2);
    segs.push({ id: `seg_${i + 1}`, start, end });
  }
  return segs;
}

export function formatTimestamp(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatTimestamp(start)}–${formatTimestamp(end)}`;
}
