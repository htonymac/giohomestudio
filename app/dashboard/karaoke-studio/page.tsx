"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Karaoke Studio — redirect to new Karaoke Music Creator
 * Canvas §0: old page kept for backward compat (sidebar Tools entry still links here)
 */
export default function KaraokeStudioRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/karaoke-music-creator"); }, [router]);
  return (
    <div style={{ padding: 32, fontFamily: "'Geist', sans-serif", color: "#7b7b80" }}>
      Redirecting to the new Karaoke Music Creator…
    </div>
  );
}
