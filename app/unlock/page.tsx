"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function UnlockForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const to = searchParams.get("to") || "/dashboard/children-planner";
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setErr("Enter the access code"); return; }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), to }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; to?: string };
      if (data.ok) {
        router.push(data.to || to);
      } else {
        setErr(data.error || "Unlock failed");
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Network error");
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0e0e10", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ background: "#151518", border: "1px solid #ffffff15", borderRadius: 16, padding: 32, width: "min(420px, 100%)", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Andio</h1>
        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 24 }}>Private preview. Enter your access code.</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #ffffff25", background: "#0e0e10", color: "#fff", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }}
          />
          {err && <p style={{ color: "#ff8a8a", fontSize: 11, marginBottom: 10 }}>{err}</p>}
          <button
            type="submit"
            disabled={busy}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "none", background: "#fbbf24", color: "#000", fontSize: 14, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
        <p style={{ fontSize: 10, color: "#666", marginTop: 16 }}>If you don&apos;t have a code, ask Henry.</p>
      </div>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0e0e10", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>}>
      <UnlockForm />
    </Suspense>
  );
}
