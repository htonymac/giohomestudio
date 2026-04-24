"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Card } from "../ui/Card";
import { ds } from "../../../lib/designSystem";

// Panel — generic panel wrapper with gradient-icon header and optional "View all →" link.
// Card surface: solid #151518. No glass, no backdrop-filter.

type Props = {
  title: string;
  icon?: ReactNode;
  iconGrad?: string;
  action?: string;
  actionHref?: string;
  children: ReactNode;
};

export function Panel({ title, icon, iconGrad, action, actionHref, children }: Props) {
  const grad = iconGrad ?? ds.grad.tile.active;

  return (
    <Card padding={20} radius={18} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon && (
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: grad,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
                boxShadow: ds.shadow.tile,
              }}
            >
              {icon}
            </span>
          )}
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: ds.color.ink,
              fontFamily: ds.font.sans,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </span>
        </div>

        {action && actionHref && (
          <Link
            href={actionHref}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: ds.color.lilac,
              fontFamily: ds.font.sans,
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "opacity .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {action}
          </Link>
        )}

        {action && !actionHref && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: ds.color.lilac,
              fontFamily: ds.font.sans,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {action}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </Card>
  );
}

export default Panel;
