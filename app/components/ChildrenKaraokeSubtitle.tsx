"use client";

// C5 — Children Karaoke Subtitle Renderer
// Depends on C1: import types once src/types/children.ts is committed by sister agent
import type { ChildrenPacingEntry } from "@/types/children";

import { useMemo, useEffect, useState } from "react";

interface ChildrenKaraokeSubtitleProps {
  entry: ChildrenPacingEntry | null;
  elapsedMs: number;
  mode: "story" | "learning";
  accumulatedLetters?: string[];
}

const PULSE_DURATION_MS = 400;

const pulseKeyframes = `
@keyframes children-letter-pulse {
  0%   { transform: scale(1.0); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1.0); }
}
`;

function StyleInjector() {
  return <style>{pulseKeyframes}</style>;
}

function FullHighlight({ text }: { text: string }) {
  return (
    <span
      style={{
        color: "#FFE600",
        fontWeight: 700,
        fontSize: 28,
        textShadow: "0 2px 8px rgba(0,0,0,0.7)",
      }}
    >
      {text}
    </span>
  );
}

function WordByWord({
  words,
  activeIndex,
}: {
  words: string[];
  activeIndex: number;
}) {
  return (
    <span style={{ fontSize: 28, fontWeight: 700 }}>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            color: i === activeIndex ? "#FFFFFF" : "#888888",
            marginRight: i < words.length - 1 ? "0.35em" : 0,
            transition: "color 80ms linear",
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

function LetterByLetter({
  letter,
  accumulated,
}: {
  letter: string;
  accumulated: string[] | undefined;
}) {
  return (
    <>
      <StyleInjector />
      {accumulated && accumulated.length > 0 && (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#FFE600",
            letterSpacing: "0.15em",
            marginBottom: 8,
          }}
        >
          {accumulated.join(" ")}
        </div>
      )}
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#FFFFFF",
          animation: `children-letter-pulse ${PULSE_DURATION_MS}ms ease-in-out infinite`,
          display: "inline-block",
          textShadow: "0 4px 16px rgba(0,0,0,0.9)",
        }}
      >
        {letter}
      </div>
    </>
  );
}

export default function ChildrenKaraokeSubtitle({
  entry,
  elapsedMs,
  accumulatedLetters,
}: ChildrenKaraokeSubtitleProps) {
  // Tick state drives re-render for word-by-word progress without requestAnimationFrame overhead
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!entry || entry.subtitleHighlightMode !== "word_by_word") return;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [entry]);

  const words = useMemo(() => {
    if (!entry || entry.subtitleHighlightMode !== "word_by_word") return [];
    return entry.text.trim().split(/\s+/);
  }, [entry]);

  if (!entry || entry.subtitleHighlightMode === "none") return null;

  const activeWordIndex =
    entry.subtitleHighlightMode === "word_by_word" && words.length > 0
      ? Math.min(
          Math.floor((elapsedMs / entry.durationMs) * words.length),
          words.length - 1
        )
      : 0;

  let content: React.ReactNode;

  switch (entry.subtitleHighlightMode) {
    case "full":
      content = <FullHighlight text={entry.text} />;
      break;
    case "word_by_word":
      content = <WordByWord words={words} activeIndex={activeWordIndex} />;
      break;
    case "letter_by_letter":
      content = (
        <LetterByLetter
          letter={entry.text}
          accumulated={accumulatedLetters}
        />
      );
      break;
    default:
      return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        width: "100%",
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: "rgba(0, 0, 0, 0.62)",
          borderRadius: 8,
          padding: "6px 20px",
          lineHeight: 1.4,
        }}
      >
        {content}
      </div>
    </div>
  );
}
