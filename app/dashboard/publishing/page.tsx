"use client";

import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ConnectedChannel {
  id: string;
  platform: string;
  icon: string;
  accountName: string;
  connected: boolean;
  lastPublish?: string;
  color: string;
}

interface QueueItem {
  id: string;
  title: string;
  type: string;
  status: "draft" | "approved" | "scheduled" | "published" | "failed";
  destination: string;
  scheduledAt?: string;
  createdAt: string;
  thumbnail?: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PublishingPage() {
  const [channels, setChannels] = useState<ConnectedChannel[]>([
    { id: "yt", platform: "YouTube", icon: "📺", accountName: "", connected: false, color: "#FF0000" },
    { id: "ig", platform: "Instagram", icon: "📷", accountName: "", connected: false, color: "#E1306C" },
    { id: "tt", platform: "TikTok", icon: "🎵", accountName: "", connected: false, color: "#00F2EA" },
    { id: "fb", platform: "Facebook", icon: "📘", accountName: "", connected: false, color: "#1877F2" },
    { id: "tg", platform: "Telegram", icon: "✈️", accountName: "", connected: false, color: "#0088CC" },
    { id: "wa", platform: "WhatsApp", icon: "💬", accountName: "", connected: false, color: "#25D366" },
  ]);

  const [queue] = useState<QueueItem[]>([]);
  const [approveConfirm, setApproveConfirm] = useState<string | null>(null);
  const [tab, setTab] = useState<"channels" | "queue" | "export">("channels");

  function connectChannel(id: string) {
    const platform = channels.find(c => c.id === id);
    if (!platform) return;

    if (id === "yt") {
      window.open("/api/publish/youtube/auth", "_blank");
      setChannels(prev => prev.map(c =>
        c.id === id ? { ...c, connected: true, accountName: "Connecting..." } : c
      ));
    } else {
      // Don't set connected=true for platforms without OAuth yet
      alert(`${platform.platform} connection requires OAuth credentials. Go to Settings → add your ${platform.platform} API key first.`);
    }
  }

  function disconnectChannel(id: string) {
    setChannels(prev => prev.map(c =>
      c.id === id ? { ...c, connected: false, accountName: "" } : c
    ));
  }

  // Styles
  const card: React.CSSProperties = { background: "#0e0e1a", border: "1px solid #1e1e30", borderRadius: 12, padding: 20 };
  const btnSm: React.CSSProperties = { fontSize: 11, padding: "6px 12px", borderRadius: 8, border: "1px solid #2a2a40", background: "#1a1a2e", color: "#a080ff", cursor: "pointer", fontWeight: 600 };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#6060a0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 };

  const statusColors: Record<string, string> = {
    draft: "#6b7280", approved: "#10b981", scheduled: "#3b82f6", published: "#22c55e", failed: "#ef4444",
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
          Publishing & Channels
        </h1>
        <p style={{ fontSize: 13, color: "#6060a0" }}>
          Connect your social accounts, manage your posting queue, and export content.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {([
          { key: "channels", label: "Connected Channels" },
          { key: "queue", label: "Posting Queue" },
          { key: "export", label: "Manual Export" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              ...btnSm,
              background: tab === t.key ? "rgba(124,92,252,0.15)" : "#1a1a2e",
              borderColor: tab === t.key ? "#7c5cfc" : "#2a2a40",
              color: tab === t.key ? "#7c5cfc" : "#6060a0",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Connected Channels ── */}
      {tab === "channels" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {channels.map(ch => (
            <div key={ch.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{ch.icon}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{ch.platform}</p>
                    {ch.connected && ch.accountName && (
                      <p style={{ fontSize: 10, color: "#6060a0" }}>{ch.accountName}</p>
                    )}
                  </div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: ch.connected ? "#22c55e" : "#404060",
                }} />
              </div>

              {ch.connected ? (
                <div>
                  <p style={{ fontSize: 10, color: "#404060", marginBottom: 10 }}>
                    {ch.lastPublish ? `Last post: ${ch.lastPublish}` : "No posts yet"}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => alert(`Test post to ${ch.platform} — this will send a test message when OAuth is configured.`)}
                      style={{ ...btnSm, flex: 1, textAlign: "center", fontSize: 10 }}>
                      Test Post
                    </button>
                    <button onClick={() => disconnectChannel(ch.id)}
                      style={{ ...btnSm, flex: 1, textAlign: "center", fontSize: 10, color: "#f87171", borderColor: "#4a1a1a" }}>
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => connectChannel(ch.id)}
                  style={{
                    ...btnSm, width: "100%", textAlign: "center",
                    background: `${ch.color}20`, color: ch.color, borderColor: `${ch.color}40`,
                  }}>
                  Connect {ch.platform}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Posting Queue ── */}
      {tab === "queue" && (
        <div style={card}>
          <p style={label}>Posting Queue</p>

          {queue.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
              <p style={{ fontSize: 13, color: "#6060a0" }}>No content in the queue yet.</p>
              <p style={{ fontSize: 11, color: "#404060", marginTop: 4 }}>
                Go to <a href="/dashboard/auto-creator" style={{ color: "#7c5cfc", textDecoration: "none" }}>Auto Creator</a> or <a href="/dashboard/review" style={{ color: "#7c5cfc", textDecoration: "none" }}>Review Queue</a> to approve content for posting.
              </p>
            </div>
          ) : (
            <div>
              {queue.map(item => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 8, marginBottom: 6,
                  background: "#1a1a2e", border: "1px solid #2a2a40",
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0" }}>{item.title}</p>
                    <p style={{ fontSize: 10, color: "#6060a0" }}>{item.type} &middot; {item.destination}</p>
                    {item.scheduledAt && <p style={{ fontSize: 9, color: "#3b82f6" }}>Scheduled: {item.scheduledAt}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 9, padding: "3px 8px", borderRadius: 20,
                      background: `${statusColors[item.status]}20`,
                      color: statusColors[item.status],
                      fontWeight: 600, textTransform: "capitalize",
                    }}>
                      {item.status}
                    </span>
                    {item.status === "approved" && (
                      <>
                        {approveConfirm === item.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, color: "#f59e0b" }}>Confirm publish?</span>
                            <button style={{ ...btnSm, fontSize: 9, padding: "2px 8px", background: "#22c55e20", color: "#22c55e", borderColor: "#22c55e40" }}>
                              Yes
                            </button>
                            <button onClick={() => setApproveConfirm(null)} style={{ ...btnSm, fontSize: 9, padding: "2px 8px" }}>
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setApproveConfirm(item.id)} style={{ ...btnSm, fontSize: 9 }}>
                            Publish
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Manual Export ── */}
      {tab === "export" && (
        <div style={card}>
          <p style={label}>Manual Share & Export</p>
          <p style={{ fontSize: 12, color: "#6060a0", marginBottom: 20 }}>
            Download or share your approved content directly.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #2a2a40", textAlign: "center" }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>💬</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0", marginBottom: 4 }}>WhatsApp Share</p>
              <p style={{ fontSize: 10, color: "#6060a0" }}>Share directly via WhatsApp link</p>
            </div>
            <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #2a2a40", textAlign: "center" }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>✈️</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0", marginBottom: 4 }}>Telegram Send</p>
              <p style={{ fontSize: 10, color: "#6060a0" }}>Send to your Telegram for review</p>
            </div>
            <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #2a2a40", textAlign: "center" }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>💾</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0", marginBottom: 4 }}>Download</p>
              <p style={{ fontSize: 10, color: "#6060a0" }}>Save to your device</p>
            </div>
            <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, border: "1px solid #2a2a40", textAlign: "center" }}>
              <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>📋</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0", marginBottom: 4 }}>Copy Caption</p>
              <p style={{ fontSize: 10, color: "#6060a0" }}>Copy text to clipboard for manual paste</p>
            </div>
          </div>

          <div style={{ marginTop: 20, background: "rgba(124,92,252,0.06)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(124,92,252,0.15)" }}>
            <p style={{ fontSize: 10, color: "#7c5cfc" }}>
              Go to <a href="/dashboard/assets" style={{ color: "#a080ff", textDecoration: "none", fontWeight: 600 }}>Asset Library</a> to find all your exported content.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
