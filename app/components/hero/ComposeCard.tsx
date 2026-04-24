"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { ButtonPrimary } from "../ui/ButtonPrimary";
import { ds } from "../../../lib/designSystem";

// ComposeCard — prompt input card with typewriter placeholder, chip row, Roll CTA.
// onRoll: wired at call site (dashboard page passes a real handler or no-op).
// TODO(@thompson): connect onRoll to the real /api/pipeline trigger from dashboard state.

const DEFAULT_PLACEHOLDERS = [
  "A Nigerian market scene at golden hour, vibrant colors, aerial shot…",
  "Two friends reunite after 10 years at Lagos airport, emotional close-up…",
  "A futuristic Abuja skyline at dusk, cinematic wide angle…",
  "Street vendor sells akara at dawn, steam rising, warm light…",
];

const CHIPS = ["Commercial", "Series", "Reel", "Free Mode"];

type Props = {
  defaultPrompt?: string;
  onRoll: (prompt: string) => void;
  placeholders?: string[];
};

export function ComposeCard({
  defaultPrompt = "",
  onRoll,
  placeholders = DEFAULT_PLACEHOLDERS,
}: Props) {
  const [value, setValue] = useState(defaultPrompt);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [typing, setTyping] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Typewriter effect cycling through placeholders
  useEffect(() => {
    if (value) return; // suppress when user has typed

    const target = placeholders[placeholderIdx];
    let charIdx = typing ? 0 : target.length;

    if (intervalRef.current) clearInterval(intervalRef.current);

    if (typing) {
      intervalRef.current = setInterval(() => {
        charIdx++;
        setDisplayedPlaceholder(target.slice(0, charIdx));
        if (charIdx >= target.length) {
          clearInterval(intervalRef.current!);
          // Pause then erase
          setTimeout(() => setTyping(false), 1800);
        }
      }, 38);
    } else {
      intervalRef.current = setInterval(() => {
        charIdx--;
        setDisplayedPlaceholder(target.slice(0, charIdx));
        if (charIdx <= 0) {
          clearInterval(intervalRef.current!);
          setPlaceholderIdx((i) => (i + 1) % placeholders.length);
          setTyping(true);
        }
      }, 18);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [placeholderIdx, typing, value, placeholders]);

  function handleRoll() {
    if (!value.trim()) return;
    onRoll(value.trim());
  }

  return (
    <Card padding={20} radius={18}>
      {/* Prompt textarea */}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={displayedPlaceholder || "Describe your scene…"}
        rows={4}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "12px 14px",
          color: ds.color.ink,
          fontFamily: ds.font.sans,
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.55,
          resize: "none",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color .18s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(167,139,250,.5)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(167,139,250,.12)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {/* Chips row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 7,
          marginTop: 12,
          marginBottom: 14,
        }}
      >
        {CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setValue((v) => (v ? v + " · " + chip : chip))}
            style={{
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.22)",
              borderRadius: 999,
              padding: "4px 12px",
              color: ds.color.lilac,
              fontFamily: ds.font.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "background .15s, border-color .15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(167,139,250,0.2)";
              e.currentTarget.style.borderColor = "rgba(167,139,250,.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(167,139,250,0.1)";
              e.currentTarget.style.borderColor = "rgba(167,139,250,.22)";
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Roll CTA */}
      <ButtonPrimary
        size="lg"
        style={{ width: "100%", justifyContent: "center" }}
        disabled={!value.trim()}
        onClick={handleRoll}
      >
        Roll Camera
      </ButtonPrimary>
    </Card>
  );
}

export default ComposeCard;
