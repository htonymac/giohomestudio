"use client";

// Redirect: /dashboard/overview → /dashboard (same content as the new dashboard index)
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OverviewRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return null;
}
