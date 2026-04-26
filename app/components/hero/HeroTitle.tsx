"use client";

import { ds } from "../../../lib/designSystem";

// HeroTitle — kicker pill + Geist 900 hero title + serif italic gradient em + optional sub.
// <em> uses v14 gradient sweep (linear-gradient 100deg, btn-a→btn-b→btn-c→btn-d→btn-a).
// Caret blink via .h1 em::after in globals.css (typeCursor keyframe).

type Props = {
  kicker: string;
  title: string;
  italic: string;
  rest?: string;
  sub?: string;
};

export function HeroTitle({ kicker, title, italic, rest, sub }: Props) {
  return (
    <div>
      {/* Kicker pill — mono uppercase */}
      <div
        style={{
          fontFamily: ds.font.mono,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.24em",
          color: ds.color.lilac,
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 22,
            height: 2,
            background: ds.grad.hero,
            backgroundSize: ds.grad.heroSize,
            borderRadius: 2,
            flexShrink: 0,
          }}
        />
        {kicker}
      </div>

      {/* Hero title */}
      <h1
        className="h1"
        style={{
          fontFamily: ds.font.sans,
          color: ds.color.ink,
          margin: 0,
        }}
      >
        {title}{" "}
        {/* serif italic with animated gradient sweep + caret via CSS */}
        <em
          style={{
            fontFamily: ds.font.serif,
            fontStyle: "italic",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            backgroundImage:
              "linear-gradient(100deg,var(--btn-a),var(--btn-b),var(--btn-c),var(--btn-d),var(--btn-a))",
            backgroundSize: "300% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            animation: "btnSweep 6s linear infinite",
          }}
        >
          {italic}
        </em>
        {rest && (
          <>
            <br />
            {rest}
          </>
        )}
      </h1>

      {sub && (
        <p
          style={{
            marginTop: 12,
            fontSize: 15,
            color: ds.color.ink2,
            fontWeight: 500,
            maxWidth: "48ch",
            lineHeight: 1.5,
            fontFamily: ds.font.sans,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export default HeroTitle;
