"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: "rgba(34,209,138,0.12)", border: "rgba(34,209,138,0.25)", text: "var(--success)", icon: "✓" },
    error:   { bg: "rgba(255,87,87,0.12)", border: "rgba(255,87,87,0.25)", text: "var(--danger)", icon: "✕" },
    warning: { bg: "rgba(245,200,66,0.12)", border: "rgba(245,200,66,0.25)", text: "var(--warning)", icon: "⚠" },
    info:    { bg: "rgba(77,184,255,0.12)", border: "rgba(77,184,255,0.25)", text: "var(--info)", icon: "ℹ" },
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 300, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map(t => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                backdropFilter: "blur(12px)",
                animation: "toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                pointerEvents: "auto",
                minWidth: 240,
                maxWidth: 400,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                style={{ background: "none", border: "none", color: c.text, opacity: 0.5, cursor: "pointer", fontSize: 12 }}
              >✕</button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
