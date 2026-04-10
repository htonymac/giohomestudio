"use client";

// Commercial Planner — entry for ongoing commercial projects
// Users with existing projects come here directly

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommercialPlannerPage() {
  const router = useRouter();

  useEffect(() => {
    // Route to existing Commercial Maker which already has project-based flow
    router.replace("/dashboard/commercial");
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: "center", color: "#6060a0" }}>
      Loading Commercial Planner...
    </div>
  );
}
