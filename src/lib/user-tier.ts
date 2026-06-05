// GHS user tier — controls which voice / model tiers a user can access.
// Phase 5 of voice unification (Henry 2026-06-04 trigger: 'gate voice tier').
//
// Read order:
//   1. URL query ?dev_tier=paid (admin / Playwright override for testing)
//   2. localStorage 'ghs_user_tier' (client persistence)
//   3. Cookie 'ghs_user_tier' (set by future session/billing webhook)
//   4. Default 'free'
//
// Free users see only GHS Standard + GHS Standard+ in pickers. Paid voices
// (Pro / Premium / Best) are visible but locked with an Upgrade CTA.
//
// Daily $ budget cap (FAL spend per user) lives separately in
// src/lib/rate-limit.ts (already exists for image gen).

export type UserTier = "free" | "paid" | "admin";

const LS_KEY = "ghs_user_tier";

export function getUserTier(): UserTier {
  if (typeof window === "undefined") return "free"; // SSR default

  // 1. URL override (admin / Playwright)
  const params = new URLSearchParams(window.location.search);
  const devTier = params.get("dev_tier");
  if (devTier === "paid" || devTier === "admin" || devTier === "free") {
    try { window.localStorage.setItem(LS_KEY, devTier); } catch { /* ignore */ }
    return devTier;
  }

  // 2. localStorage
  try {
    const stored = window.localStorage.getItem(LS_KEY);
    if (stored === "paid" || stored === "admin" || stored === "free") return stored;
  } catch { /* ignore */ }

  // 3. Cookie (set by future session/billing webhook)
  const cookieMatch = document.cookie.match(/(?:^|;\s*)ghs_user_tier=([^;]+)/);
  if (cookieMatch) {
    const v = decodeURIComponent(cookieMatch[1]);
    if (v === "paid" || v === "admin" || v === "free") return v;
  }

  return "free";
}

export function setUserTier(tier: UserTier): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, tier); } catch { /* ignore */ }
}

// Bridge for VoiceTierSelector — collapses 'admin' → 'paid' since admins get everything.
export function voiceTierGate(t: UserTier): "free" | "paid" {
  return t === "free" ? "free" : "paid";
}
