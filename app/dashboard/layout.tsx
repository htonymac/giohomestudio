// Dashboard pages must always reflect the latest deploy — Next was statically
// prerendering them with Cache-Control: s-maxage=31536000 (1 year), so every
// update needed a hard-refresh (Henry 2026-07-17). force-dynamic opts the whole
// /dashboard/* tree out of static generation → Next serves them no-store, so a
// normal reload always gets the newest version. Transparent pass-through layout:
// returns children unchanged, adds no DOM.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
