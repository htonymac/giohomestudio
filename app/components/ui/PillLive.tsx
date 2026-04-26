"use client";

import { HTMLAttributes } from "react";

// v14 PillLive — #151518 bg, #7ae0c3 dot, white text.
// Replaces old pill-green "● Online" pill.

type PillLiveProps = HTMLAttributes<HTMLSpanElement> & {
  label?: string;
};

export function PillLive({ label = "Online", style, className, ...rest }: PillLiveProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        background: "#151518",
        border: "1px solid rgba(255,255,255,.06)",
        color: "#fff",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#7ae0c3",
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

export default PillLive;
