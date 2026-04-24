"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ds } from "../../../lib/designSystem";
import ButtonPrimary from "../../components/ui/ButtonPrimary";

// ── Input style ────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: ds.radius.xs,
  border: `1px solid ${ds.color.line2}`,
  background: ds.color.wallet,
  color: ds.color.ink,
  fontSize: 13,
  fontFamily: ds.font.sans,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: ds.color.mute,
  display: "block",
  marginBottom: 4,
  fontFamily: ds.font.mono,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

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
    <div
      style={{
        minHeight: "100vh",
        background: ds.color.paper,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: ds.font.sans,
        padding: "24px 16px",
      }}
    >
      {/* Brand mark */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          className="brand-dot"
          style={{ margin: "0 auto 14px" }}
        />
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: ds.color.ink,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          GioHomeStudio
        </div>
        <div
          style={{
            fontSize: 12,
            color: ds.color.mute,
            marginTop: 5,
            fontFamily: ds.font.mono,
          }}
        >
          AI Content Studio
        </div>
      </div>

      {/* Auth card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: ds.color.card,
          border: `1px solid ${ds.color.line}`,
          borderRadius: ds.radius.lg,
          padding: "32px 28px",
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: ds.color.ink,
            marginBottom: 24,
            textAlign: "center",
            letterSpacing: "-0.02em",
          }}
        >
          Welcome back
        </h2>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          style={{
            width: "100%",
            padding: "11px 16px",
            borderRadius: ds.radius.sm,
            border: `1px solid ${ds.color.line2}`,
            background: ds.color.wallet,
            color: ds.color.ink2,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: ds.font.sans,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: ds.color.line }} />
          <span style={{ fontSize: 11, color: ds.color.mute2, fontFamily: ds.font.mono }}>or</span>
          <div style={{ flex: 1, height: 1, background: ds.color.line }} />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle} htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: 12,
                color: "#f87171",
                marginBottom: 14,
                textAlign: "center",
                fontFamily: ds.font.sans,
              }}
            >
              {error}
            </p>
          )}

          <ButtonPrimary
            type="submit"
            disabled={loading}
            size="md"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </ButtonPrimary>
        </form>

        {/* Register link */}
        <p
          style={{
            fontSize: 12,
            color: ds.color.mute,
            textAlign: "center",
            marginTop: 20,
            fontFamily: ds.font.sans,
          }}
        >
          Don&apos;t have an account?{" "}
          <a
            href="/register"
            style={{
              color: ds.color.lilac,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Create one
          </a>
        </p>
      </div>

      {/* Footer */}
      <p
        style={{
          fontSize: 10,
          color: ds.color.mute2,
          textAlign: "center",
          marginTop: 16,
          lineHeight: 1.7,
          fontFamily: ds.font.sans,
        }}
      >
        By signing in, you agree to our{" "}
        <a href="/terms" style={{ color: ds.color.mute, textDecoration: "underline" }}>Terms</a>
        {" "}and{" "}
        <a href="/privacy" style={{ color: ds.color.mute, textDecoration: "underline" }}>Privacy Policy</a>
      </p>
    </div>
  );
}
