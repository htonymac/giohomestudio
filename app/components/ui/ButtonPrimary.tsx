"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

// v14 ButtonPrimary — animated gradient sweep CTA.
// Purple → magenta → orange → amber, 6s linear loop.
// Hover: lift + white shine wipe. Active: punch down 80ms.

type ButtonPrimaryProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: { padding: "6px 14px", fontSize: 12 },
  md: { padding: "10px 18px", fontSize: 14 },
  lg: { padding: "13px 24px", fontSize: 15 },
};

const ButtonPrimary = forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  function ButtonPrimary(
    { children, size = "md", style, className, disabled, ...rest },
    ref
  ) {
    const sz = sizeMap[size];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={["btn-primary", className].filter(Boolean).join(" ")}
        style={{
          background:
            "linear-gradient(120deg,#a78bfa,#d17bff,#ff9a3c,#f5a623,#a78bfa)",
          backgroundSize: "300% 100%",
          animation: disabled ? "none" : "btnSweep 6s linear infinite",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: sz.padding,
          fontSize: sz.fontSize,
          fontWeight: 700,
          fontFamily: "'Geist', system-ui, sans-serif",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          overflow: "hidden",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          opacity: disabled ? 0.45 : 1,
          transition: "transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .2s",
          ...style,
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLButtonElement).style.transform =
            "translateY(-2px) scale(1.02)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 12px 28px -8px rgba(209,123,255,.55)";
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
        }}
        onMouseDown={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLButtonElement).style.transform =
            "translateY(1px) scale(.96)";
          (e.currentTarget as HTMLButtonElement).style.transition =
            "transform .08s, box-shadow .08s";
        }}
        onMouseUp={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.transition =
            "transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .2s";
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

ButtonPrimary.displayName = "ButtonPrimary";

export default ButtonPrimary;
export { ButtonPrimary };
