"use client";
// Henry 2026-06-04: alias path /storage/scrapfiles -> the storage cleanup tool.
// He asked for this URL specifically as the "scrap files" page.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScrapFilesAlias() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/storage-cleanup");
  }, [router]);
  return (
    <div style={{ background: "#0e0e10", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <p>Opening Storage Cleanup…</p>
    </div>
  );
}
