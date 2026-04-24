"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

interface CalendarItem {
  id: string;
  originalInput: string;
  status: string;
  mode: string;
  createdAt: string;
  approvedAt: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  destinationPage: { name: string; platform: string } | null;
}

const STATUS_DOT: Record<string, string> = {
  IN_REVIEW: ds.color.gold,
  APPROVED:  ds.color.mint,
  FAILED:    "#ef4444",
  PUBLISHED: ds.color.sky,
  REJECTED:  "#dc2626",
  PENDING:   ds.color.mute2,
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar?month=${year}-${String(month).padStart(2, "0")}`)
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [year, month]);

  const { days, firstDayOfWeek, daysInMonth } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();
    return { days: Array.from({ length: totalDays }, (_, i) => i + 1), firstDayOfWeek: firstDay, daysInMonth: totalDays };
  }, [year, month]);

  const itemsByDay = useMemo(() => {
    const map: Record<number, CalendarItem[]> = {};
    for (const item of items) {
      const dateStr = item.scheduledAt ?? item.createdAt;
      const d = new Date(dateStr);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(item);
      }
    }
    return map;
  }, [items, year, month]);

  const selectedItems = selectedDay ? (itemsByDay[selectedDay] ?? []) : [];
  const monthLabel = new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const btnNav: React.CSSProperties = {
    padding: "6px 14px", borderRadius: ds.radius.sm,
    border: `1px solid ${ds.color.line2}`,
    background: ds.color.card, color: ds.color.mute,
    fontSize: 12, cursor: "pointer", fontFamily: ds.font.sans,
  };

  return (
    <div style={{ maxWidth: 900, fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Content Schedule" title="Content" italic="Calendar" sub="Publishing timeline and scheduled content at a glance" />

      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={prevMonth} style={btnNav}>Prev</button>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, margin: 0 }}>{monthLabel}</h2>
        <button onClick={nextMonth} style={btnNav}>Next</button>
      </div>

      {loading && (
        <p style={{ color: ds.color.mute, textAlign: "center", padding: "32px 0", fontFamily: ds.font.mono, fontSize: 12 }}>
          Loading…
        </p>
      )}

      {!loading && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1, background: ds.color.line2,
          borderRadius: ds.radius.md, overflow: "hidden",
          border: `1px solid ${ds.color.line2}`,
        }}>
          {/* Day headers */}
          {DAY_NAMES.map(d => (
            <div key={d} style={{
              background: ds.color.sidebar,
              padding: "8px 4px", textAlign: "center",
              fontSize: 10, color: ds.color.mute,
              fontFamily: ds.font.mono, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>
              {d}
            </div>
          ))}

          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ background: ds.color.paper, minHeight: 80 }} />
          ))}

          {/* Day cells */}
          {days.map(day => {
            const dayItems = itemsByDay[day] ?? [];
            const isToday = day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();
            const isSelected = day === selectedDay;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                style={{
                  background: isSelected ? ds.color.alert : ds.color.card,
                  minHeight: 80, padding: 6, textAlign: "left",
                  border: isSelected ? `1px solid ${ds.color.lilac}` : "none",
                  cursor: "pointer", display: "block", width: "100%",
                  outline: "none",
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: isToday ? 800 : 500,
                  fontFamily: ds.font.mono,
                  color: isToday ? ds.color.lilac : ds.color.mute,
                }}>
                  {day}
                </span>
                {dayItems.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 2 }}>
                    {dayItems.slice(0, 4).map(item => (
                      <span
                        key={item.id}
                        style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[item.status] ?? ds.color.lilac, display: "inline-block" }}
                        title={`${item.originalInput?.slice(0, 30)} (${item.status})`}
                      />
                    ))}
                    {dayItems.length > 4 && (
                      <span style={{ fontSize: 8, color: ds.color.mute, fontFamily: ds.font.mono }}>+{dayItems.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {/* Empty cells after last day */}
          {Array.from({ length: (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
            <div key={`end-${i}`} style={{ background: ds.color.paper, minHeight: 80 }} />
          ))}
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <div style={{
          marginTop: 16, background: ds.color.card,
          border: `1px solid ${ds.color.line2}`,
          borderRadius: ds.radius.md, padding: 16,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, marginBottom: 12 }}>
            {new Date(year, month - 1, selectedDay).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}
            <span style={{ marginLeft: 8, color: ds.color.mute, fontWeight: 400 }}>
              ({selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""})
            </span>
          </h3>
          {selectedItems.length === 0 ? (
            <p style={{ fontSize: 12, color: ds.color.mute2 }}>No content on this day.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/dashboard/content/${item.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: ds.radius.sm,
                    background: ds.color.paper,
                    border: `1px solid ${ds.color.line}`,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: STATUS_DOT[item.status] ?? ds.color.lilac }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: ds.color.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.originalInput}
                    </p>
                    <p style={{ fontSize: 10, color: ds.color.mute, margin: "2px 0 0", fontFamily: ds.font.mono }}>
                      {item.mode} · {item.status}
                      {item.destinationPage && ` · ${item.destinationPage.name}`}
                      {item.durationSeconds && ` · ${item.durationSeconds}s`}
                    </p>
                  </div>
                  {item.scheduledAt && (
                    <span style={{
                      fontSize: 9, color: ds.color.lilac,
                      background: `${ds.color.lilac}18`,
                      border: `1px solid ${ds.color.lilac}33`,
                      padding: "2px 6px", borderRadius: ds.radius.xs,
                      fontFamily: ds.font.mono, fontWeight: 700,
                    }}>
                      SCHEDULED
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
