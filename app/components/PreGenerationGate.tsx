"use client";

// PreGenerationGate — Gemini-style rights confirmation before any generation.
//
// Usage in any page:
//   const { requireGate, GateModal } = useGate();
//   ...
//   async function onGenerate() {
//     try { await requireGate(); } catch { return; }  // user cancelled
//     await fetch("/api/...");
//   }
//   ...
//   return <><GateModal />{...rest}</>;

import { useState, useCallback, useRef } from "react";
import { ds } from "../../lib/designSystem";
import ButtonPrimary from "./ui/ButtonPrimary";

const SKIP_KEY = "ghs_pregen_skip_until";

function shouldSkip(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = sessionStorage.getItem(SKIP_KEY);
    if (!v) return false;
    return Date.now() < parseInt(v, 10);
  } catch {
    return false;
  }
}

function setSkip24h() {
  try {
    sessionStorage.setItem(SKIP_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

type Resolver = { resolve: () => void; reject: () => void };

interface GateModalProps {
  open: boolean;
  onConfirm: (skip24h: boolean) => void;
  onCancel: () => void;
}

function GateModalUI({ open, onConfirm, onCancel }: GateModalProps) {
  const [checked, setChecked] = useState(false);
  const [skip24h, setSkip24h_] = useState(false);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 9998,
        }}
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm before generating"
        data-testid="pregen-gate-modal"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
        }}
      >
        <div
          style={{
            background: ds.color.card,
            border: `1px solid ${ds.color.line2}`,
            borderRadius: ds.radius.lg,
            padding: "28px 24px",
            width: "100%",
            maxWidth: 440,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: ds.color.ink,
              marginBottom: 16,
              letterSpacing: "-0.02em",
              fontFamily: ds.font.sans,
            }}
          >
            Confirm before generating
          </h2>

          <ul
            style={{
              paddingLeft: 20,
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[
              "I own the rights to all uploaded media OR have explicit permission from the rights holder.",
              "I am not impersonating real people without their verifiable consent.",
              "I will not use this output to deceive or harm others.",
              "This output is mine to publish and I take full responsibility for it.",
            ].map((text, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13,
                  color: ds.color.ink2,
                  lineHeight: 1.6,
                  fontFamily: ds.font.sans,
                }}
              >
                {text}
              </li>
            ))}
          </ul>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              color: ds.color.ink2,
              cursor: "pointer",
              marginBottom: 12,
              lineHeight: 1.5,
              fontFamily: ds.font.sans,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ marginTop: 2, accentColor: ds.color.lilac, flexShrink: 0 }}
            />
            I confirm the above statements are true.
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: ds.color.mute,
              cursor: "pointer",
              marginBottom: 20,
              fontFamily: ds.font.mono,
            }}
          >
            <input
              type="checkbox"
              checked={skip24h}
              onChange={e => setSkip24h_(e.target.checked)}
              style={{ accentColor: ds.color.mute2 }}
            />
            Don&apos;t show again for 24h
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: ds.radius.sm,
                border: `1px solid ${ds.color.line2}`,
                background: "none",
                color: ds.color.mute,
                fontSize: 13,
                fontFamily: ds.font.sans,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <ButtonPrimary
              type="button"
              disabled={!checked}
              onClick={() => onConfirm(skip24h)}
              size="sm"
              style={{ flex: 2, justifyContent: "center" }}
            >
              Generate
            </ButtonPrimary>
          </div>
        </div>
      </div>
    </>
  );
}

export function useGate() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<Resolver | null>(null);

  const requireGate = useCallback((): Promise<void> => {
    if (shouldSkip()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      resolverRef.current = { resolve, reject };
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback((skip24h: boolean) => {
    if (skip24h) setSkip24h();
    setOpen(false);
    resolverRef.current?.resolve();
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolverRef.current?.reject();
    resolverRef.current = null;
  }, []);

  const GateModal = useCallback(
    () => (
      <GateModalUI
        open={open}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [open, handleConfirm, handleCancel],
  );

  return { requireGate, GateModal };
}
