"use client";

// GioHomeStudio — CoordinatorProvider (BUG-01)
// Wraps dashboard subtree. Auto-detects plannerType from pathname.
// Exposes useCoordinator() hook. Shows advisory banner on blocked stage advance.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCoordinatorStore, type PlannerType } from "../../src/modules/coordinator/index";

export { useCoordinator } from "../../src/modules/coordinator/index";

// Map URL pathname segments → PlannerType
function detectPlannerType(pathname: string): PlannerType {
  if (pathname.includes("hybrid-planner")) return "hybrid";
  if (pathname.includes("children-planner") || pathname.includes("children-video")) return "children";
  if (pathname.includes("movie-planner") || pathname.includes("movie-creator")) return "movie";
  if (pathname.includes("commercial")) return "commercial";
  if (pathname.includes("free-mode")) return "free-mode";
  if (pathname.includes("music-video")) return "music-video";
  return null;
}

export function CoordinatorProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setPlannerType = useCoordinatorStore((s) => s.setPlannerType);

  // Auto-set planner type when route changes
  useEffect(() => {
    const detected = detectPlannerType(pathname || "");
    setPlannerType(detected);
  }, [pathname, setPlannerType]);

  return <>{children}</>;
}
