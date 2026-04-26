"use client";

import { useEffect, useRef, useState } from "react";
import { ds } from "../../../lib/designSystem";

// StatCard — dark card (#151518), mono label, big tabular number (counts up on mount),
// delta chip + subtext, tiny inline sparkline SVG.
// Variants a/b/c/d differ only in accent color for delta/sparkline.
// Card surface stays solid #151518 — NO gradient backgrounds.

const ACCENT: Record<"a" | "b" | "c" | "d", string> = {
  a: ds.color.lilac,  // purple
  b: ds.color.sky,    // sky blue
  c: ds.color.mint,   // mint
  d: ds.color.gold,   // gold
};

// Deterministic sparkline data per variant (purely decorative)
const SPARK_DATA: Record<"a" | "b" | "c" | "d", number[]> = {
  a: [4, 7, 5, 9, 6, 11, 9, 14],
  b: [3, 6, 4, 8, 7, 5, 10, 9],
  c: [6, 8, 7, 10, 9, 12, 11, 14],
  d: [2, 3, 5, 4, 6, 5, 7, 8],
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const W = 52, H = 22;
  const pad = 2;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2));
  const ys = data.map((v) => H - pad - ((v - min) / (max - min + 0.01)) * (H - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  return (
    <svg
      className="spark"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path d={d} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      {/* last dot */}
      <circle cx={xs[xs.length - 1].toFixed(1)} cy={ys[ys.length - 1].toFixed(1)} r="2.5" fill={color} opacity={0.9} />
    </svg>
  );
}

function useCountUp(target: number, active: boolean): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || typeof target !== "number") return;
    const start = performance.now();
    const duration = 900; // ms

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, active]);

  return count;
}

type Props = {
  variant: "a" | "b" | "c" | "d";
  label: string;
  value: number | string;
  delta?: string;
  sub?: string;
};

export function StatCard({ variant, label, value, delta, sub }: Props) {
  const accent = ACCENT[variant];
  const sparkData = SPARK_DATA[variant];

  // IntersectionObserver triggers count-up on mount
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const numericValue = typeof value === "number" ? value : NaN;
  const isNumeric = !isNaN(numericValue);
  const displayCount = useCountUp(isNumeric ? numericValue : 0, visible && isNumeric);
  const displayValue = isNumeric ? displayCount : value;

  return (
    <div
      ref={ref}
      className="stat"
      style={{
        background: ds.color.card,
        border: `1px solid ${ds.color.line}`,
        borderRadius: ds.radius.lg,
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent top bar */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 2,
          background: accent,
          borderRadius: "0 0 2px 2px",
          opacity: 0.5,
        }}
      />

      {/* Label */}
      <div
        style={{
          fontFamily: ds.font.mono,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: ds.color.mute,
          marginBottom: 10,
          marginTop: 4,
        }}
      >
        {label}
      </div>

      {/* Value row: big number + sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span
          className="val"
          style={{
            fontFamily: ds.font.sans,
            fontSize: 30,
            fontWeight: 900,
            color: ds.color.ink,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {displayValue}
        </span>
        <Sparkline data={sparkData} color={accent} />
      </div>

      {/* Delta + sub */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        {delta && (
          <span
            style={{
              fontFamily: ds.font.mono,
              fontSize: 10,
              fontWeight: 700,
              color: accent,
              background: `${accent}18`,
              border: `1px solid ${accent}30`,
              borderRadius: 999,
              padding: "2px 8px",
              letterSpacing: "0.1em",
            }}
          >
            {delta}
          </span>
        )}
        {sub && (
          <span
            style={{
              fontFamily: ds.font.sans,
              fontSize: 11,
              color: ds.color.mute,
              fontWeight: 500,
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
