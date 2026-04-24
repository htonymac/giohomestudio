"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ds } from "../../../lib/designSystem";

// AlertBar — elevated alert bar (#1a1a1e), purple→orange gradient CTA pill on right.
// No glass, no blur, no gradient background. Alert surface is solid var(--alert).

type Props = {
  icon: ReactNode;
  message: ReactNode;
  cta: string;
  href: string;
  className?: string;
};

export function AlertBar({ icon, message, cta, href, className }: Props) {
  return (
    <div
      className={className}
      style={{
        background: ds.color.alert,
        border: `1px solid rgba(167,139,250,0.18)`,
        borderRadius: ds.radius.md,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Icon */}
      <span
        style={{
          color: ds.color.lilac,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {icon}
      </span>

      {/* Message */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: ds.color.ink2,
          fontFamily: ds.font.sans,
          lineHeight: 1.4,
        }}
      >
        {message}
      </span>

      {/* CTA pill */}
      <Link
        href={href}
        style={{
          flexShrink: 0,
          background: "linear-gradient(120deg,var(--btn-a),var(--btn-b),var(--btn-c),var(--btn-d),var(--btn-a))",
          backgroundSize: "300% 100%",
          animation: "btnSweep 6s linear infinite",
          color: "#fff",
          borderRadius: 999,
          padding: "6px 16px",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: ds.font.sans,
          textDecoration: "none",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          transition: "transform .18s var(--e-soft), box-shadow .2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
          e.currentTarget.style.boxShadow = ds.shadow.pop;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(.96)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "";
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

export default AlertBar;
