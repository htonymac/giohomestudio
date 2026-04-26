"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

// v14 ButtonTile — secondary card-like tile button.
// Solid #151518 bg, purple-tint border, slide+lift on hover.

type ButtonTileProps = ButtonHTMLAttributes<HTMLButtonElement>;

const ButtonTile = forwardRef<HTMLButtonElement, ButtonTileProps>(
  function ButtonTile({ children, style, className, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={["btn-tile", className].filter(Boolean).join(" ")}
        style={{
          background: "#151518",
          border: "1px solid rgba(167,139,250,.22)",
          borderRadius: 14,
          padding: 14,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          color: "#c5c5c8",
          fontFamily: "'Geist', system-ui, sans-serif",
          fontSize: 14,
          transition:
            "transform .18s cubic-bezier(.22,.61,.36,1), border-color .18s, box-shadow .2s",
          textAlign: "left",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = "translateX(4px) translateY(-1px)";
          el.style.borderColor = "rgba(167,139,250,.5)";
          el.style.boxShadow = "0 8px 20px -6px rgba(167,139,250,.35)";
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = "";
          el.style.borderColor = "rgba(167,139,250,.22)";
          el.style.boxShadow = "";
        }}
        onMouseDown={(e) => {
          if (disabled) return;
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transform = "translateX(2px) translateY(1px) scale(.97)";
          el.style.transition = "transform .08s, border-color .08s, box-shadow .08s";
        }}
        onMouseUp={(e) => {
          if (disabled) return;
          const el = e.currentTarget as HTMLButtonElement;
          el.style.transition =
            "transform .18s cubic-bezier(.22,.61,.36,1), border-color .18s, box-shadow .2s";
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

ButtonTile.displayName = "ButtonTile";

export default ButtonTile;
export { ButtonTile };
