"use client";

import { useState } from "react";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

interface ConnectedChannel {
  id: string;
  platform: string;
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

export default function PublishingPage() {
  const [channels, setChannels] = useState<ConnectedChannel[]>([
    { id: "yt", platform: "YouTube",   accountName: "", connected: false, color: "#FF0000" },
    { id: "ig", platform: "Instagram", accountName: "", connected: false, color: "#E1306C" },
    { id: "tt", platform: "TikTok",    accountName: "", connected: false, color: "#00F2EA" },
    { id: "fb", platform: "Facebook",  accountName: "", connected: false, color: "#1877F2" },
    { id: "tg", platform: "Telegram",  accountName: "", connected: false, color: "#0088CC" },
    { id: "wa", platform: "WhatsApp",  accountName: "", connected: false, color: "#25D366" },
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
      alert(`${platform.platform} connection requires OAuth credentials. Go to Settings > add your ${platform.platform} API key first.`);
    }
  }

  function disconnectChannel(id: string) {
    setChannels(prev => prev.map(c =>
      c.id === id ? { ...c, connected: false, accountName: "" } : c
    ));
  }

  const card: React.CSSProperties = {
    background: ds.color.card, border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.md, padding: 18,
  };

  const btnSm: React.CSSProperties = {
    fontSize: 11, padding: "6px 12px", borderRadius: ds.radius.xs,
    border: `1px solid ${ds.color.line2}`, background: ds.color.alert,
    color: ds.color.lilac, cursor: "pointer", fontWeight: 600, fontFamily: ds.font.sans,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontFamily: ds.font.mono, fontWeight: 700,
    color: ds.color.mute, textTransform: "uppercase",
    letterSpacing: "0.12em", marginBottom: 10,
  };

  const statusColors: Record<string, string> = {
    draft: ds.color.mute2, approved: ds.color.mint,
    scheduled: ds.color.sky, published: ds.color.mint, failed: "#ef4444",
  };

  return (
    <div style={{ fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Distribution" title="Publishing" italic="& Channels" sub="Connect social accounts, manage queue, and export content" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {([
          { key: "channels", label: "Connected Channels" },
          { key: "queue",    label: "Posting Queue" },
          { key: "export",   label: "Manual Export" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              ...btnSm,
              background:   tab === t.key ? `${ds.color.lilac}18` : ds.color.alert,
              borderColor:  tab === t.key ? ds.color.lilac : ds.color.line2,
              color:        tab === t.key ? ds.color.lilac : ds.color.mute,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Connected Channels */}
      {tab === "channels" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {channels.map(ch => (
            <div key={ch.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: ds.radius.sm, background: `${ch.color}22`, border: `1px solid ${ch.color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: ch.color, fontFamily: ds.font.mono }}>{ch.platform.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, margin: 0 }}>{ch.platform}</p>
                    {ch.connected && ch.accountName && (
                      <p style={{ fontSize: 10, color: ds.color.mute, margin: 0, fontFamily: ds.font.mono }}>{ch.accountName}</p>
                    )}
                  </div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: ch.connected ? ds.color.mint : ds.color.mute2,
                }} />
              </div>

              {ch.connected ? (
                <div>
                  <p style={{ fontSize: 10, color: ds.color.mute2, marginBottom: 10 }}>
                    {ch.lastPublish ? `Last post: ${ch.lastPublish}` : "No posts yet"}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => alert(`Test post to ${ch.platform} — configure OAuth first.`)}
                      style={{ ...btnSm, flex: 1, textAlign: "center", fontSize: 10 }}>
                      Test Post
                    </button>
                    <button
                      onClick={() => disconnectChannel(ch.id)}
                      style={{ ...btnSm, flex: 1, textAlign: "center", fontSize: 10, color: "#f87171", borderColor: "#4a1a1a" }}>
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => connectChannel(ch.id)}
                  style={{
                    ...btnSm, width: "100%", textAlign: "center",
                    background: `${ch.color}18`, color: ch.color, borderColor: `${ch.color}44`,
                  }}>
                  Connect {ch.platform}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Posting Queue */}
      {tab === "queue" && (
        <div style={card}>
          <p style={sectionLabel}>Posting Queue</p>

          {queue.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 13, color: ds.color.mute }}>No content in the queue yet.</p>
              <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>
                Go to{" "}
                <a href="/dashboard/auto-creator" style={{ color: ds.color.lilac, textDecoration: "none" }}>Auto Creator</a>
                {" "}or{" "}
                <a href="/dashboard/review" style={{ color: ds.color.lilac, textDecoration: "none" }}>Review Queue</a>
                {" "}to approve content for posting.
              </p>
            </div>
          ) : (
            <div>
              {queue.map(item => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", borderRadius: ds.radius.sm, marginBottom: 6,
                  background: ds.color.paper, border: `1px solid ${ds.color.line2}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink }}>{item.title}</p>
                    <p style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>{item.type} &middot; {item.destination}</p>
                    {item.scheduledAt && <p style={{ fontSize: 9, color: ds.color.sky, fontFamily: ds.font.mono }}>Scheduled: {item.scheduledAt}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 9, padding: "3px 8px", borderRadius: 20,
                      background: `${statusColors[item.status]}20`,
                      color: statusColors[item.status],
                      fontWeight: 700, textTransform: "capitalize",
                      fontFamily: ds.font.mono,
                    }}>
                      {item.status}
                    </span>
                    {item.status === "approved" && (
                      <>
                        {approveConfirm === item.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9, color: ds.color.gold, fontFamily: ds.font.mono }}>Confirm publish?</span>
                            <button style={{ ...btnSm, fontSize: 9, padding: "2px 8px", background: `${ds.color.mint}20`, color: ds.color.mint, borderColor: `${ds.color.mint}44` }}>Yes</button>
                            <button onClick={() => setApproveConfirm(null)} style={{ ...btnSm, fontSize: 9, padding: "2px 8px" }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setApproveConfirm(item.id)} style={{ ...btnSm, fontSize: 9 }}>Publish</button>
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

      {/* Manual Export */}
      {tab === "export" && (
        <div style={card}>
          <p style={sectionLabel}>Manual Share & Export</p>
          <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 20 }}>
            Download or share your approved content directly.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { title: "WhatsApp Share",  sub: "Share directly via WhatsApp link" },
              { title: "Telegram Send",   sub: "Send to your Telegram for review" },
              { title: "Download",        sub: "Save to your device" },
              { title: "Copy Caption",    sub: "Copy text to clipboard for manual paste" },
            ].map(({ title, sub }) => (
              <div key={title} style={{
                background: ds.color.paper, borderRadius: ds.radius.sm,
                padding: 16, border: `1px solid ${ds.color.line}`, textAlign: "center",
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink2, marginBottom: 4 }}>{title}</p>
                <p style={{ fontSize: 10, color: ds.color.mute }}>{sub}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, background: `${ds.color.lilac}08`, borderRadius: ds.radius.sm, padding: "10px 14px", border: `1px solid ${ds.color.lilac}20` }}>
            <p style={{ fontSize: 10, color: ds.color.lilac }}>
              Go to{" "}
              <a href="/dashboard/assets" style={{ color: ds.color.magenta, textDecoration: "none", fontWeight: 700 }}>Asset Library</a>
              {" "}to find all your exported content.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
