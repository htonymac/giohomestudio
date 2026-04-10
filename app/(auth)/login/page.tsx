"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  }

  return (
    <div style={{ width: "100%", maxWidth: 400, padding: 24 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
          GioHomeStudio
        </h1>
        <p style={{ fontSize: 13, color: "#6060a0", marginTop: 4 }}>
          AI Content Studio
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: "#0e0e1a",
        border: "1px solid #1e1e30",
        borderRadius: 16,
        padding: "32px 28px",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 24, textAlign: "center" }}>
          Welcome back
        </h2>

        {/* Google Sign In */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #2a2a40",
            background: "#1a1a2e",
            color: "#e0e0f0",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#1e1e30" }} />
          <span style={{ fontSize: 11, color: "#404060" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "#1e1e30" }} />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "#6060a0", display: "block", marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #2a2a40",
                background: "#1a1a2e",
                color: "#e0e0f0",
                fontSize: 13,
                outline: "none",
              }}
              placeholder="you@example.com"
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, color: "#6060a0", display: "block", marginBottom: 4 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #2a2a40",
                background: "#1a1a2e",
                color: "#e0e0f0",
                fontSize: 13,
                outline: "none",
              }}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "#f87171", marginBottom: 12, textAlign: "center" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#2a2a40" : "#7c5cfc",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Register link */}
        <p style={{ fontSize: 12, color: "#6060a0", textAlign: "center", marginTop: 20 }}>
          Don&apos;t have an account?{" "}
          <a href="/register" style={{ color: "#7c5cfc", textDecoration: "none", fontWeight: 600 }}>Create one</a>
        </p>
      </div>

      {/* Footer */}
      <p style={{ fontSize: 10, color: "#303050", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        By signing in, you agree to our{" "}
        <a href="/terms" style={{ color: "#404060", textDecoration: "underline" }}>Terms</a>
        {" "}and{" "}
        <a href="/privacy" style={{ color: "#404060", textDecoration: "underline" }}>Privacy Policy</a>
      </p>
    </div>
  );
}
