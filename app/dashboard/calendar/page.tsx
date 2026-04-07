"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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
  IN_REVIEW: "#f59e0b",
  APPROVED: "#22c55e",
  FAILED: "#ef4444",
  PUBLISHED: "#14b8a6",
  REJECTED: "#dc2626",
  PENDING: "#6b7280",
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

  // Build calendar grid
  const { days, firstDayOfWeek, daysInMonth } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const totalDays = new Date(year, month, 0).getDate();
    return { days: Array.from({ length: totalDays }, (_, i) => i + 1), firstDayOfWeek: firstDay, daysInMonth: totalDays };
  }, [year, month]);

  // Group items by day
  const itemsByDay = useMemo(() => {
    const map: Record<number, CalendarItem[]> = {};
    for (const item of items) {
      // Use scheduledAt if set, else createdAt
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">📅 Calendar</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Content schedule and publishing timeline</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg border border-[#2a2a40] text-[#6060a0] hover:text-white text-sm transition-colors">
          ← Prev
        </button>
        <h2 className="text-lg font-semibold text-white">{monthLabel}</h2>
        <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg border border-[#2a2a40] text-[#6060a0] hover:text-white text-sm transition-colors">
          Next →
        </button>
      </div>

      {loading && <p className="text-[#6060a0] text-center py-8">Loading...</p>}

      {!loading && (
        <div className="grid grid-cols-7 gap-px bg-[#2a2a40] rounded-xl overflow-hidden border border-[#2a2a40]">
          {/* Day headers */}
          {DAY_NAMES.map(d => (
            <div key={d} className="bg-[#0a0a18] px-2 py-2 text-center text-[10px] text-[#6060a0] font-semibold uppercase">
              {d}
            </div>
          ))}

          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-[#0d0d1a] min-h-[80px]" />
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
                className={`bg-[#0d0d1a] min-h-[80px] p-1.5 text-left transition-colors hover:bg-[#12121e] ${
                  isSelected ? "ring-1 ring-[#7c5cfc] bg-[#12121e]" : ""
                }`}
              >
                <span className={`text-xs font-medium ${isToday ? "text-[#7c5cfc] font-bold" : "text-[#6060a0]"}`}>
                  {day}
                </span>
                {dayItems.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayItems.slice(0, 4).map(item => (
                      <span
                        key={item.id}
                        className="w-2 h-2 rounded-full"
                        style={{ background: STATUS_DOT[item.status] ?? "#7c5cfc" }}
                        title={`${item.originalInput?.slice(0, 30)} (${item.status})`}
                      />
                    ))}
                    {dayItems.length > 4 && (
                      <span className="text-[8px] text-[#6060a0]">+{dayItems.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {/* Empty cells after last day */}
          {Array.from({ length: (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, i) => (
            <div key={`end-${i}`} className="bg-[#0d0d1a] min-h-[80px]" />
          ))}
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            {new Date(year, month - 1, selectedDay).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}
            <span className="ml-2 text-[#6060a0] font-normal">({selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""})</span>
          </h3>
          {selectedItems.length === 0 ? (
            <p className="text-xs text-[#404060]">No content on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/dashboard/content/${item.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0a0a18] border border-[#1a1a2e] hover:border-[#7c5cfc]/40 cursor-pointer transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[item.status] ?? "#7c5cfc" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{item.originalInput}</p>
                    <p className="text-[10px] text-[#6060a0] mt-0.5">
                      {item.mode} · {item.status}
                      {item.destinationPage && ` · ${item.destinationPage.name}`}
                      {item.durationSeconds && ` · ${item.durationSeconds}s`}
                    </p>
                  </div>
                  {item.scheduledAt && (
                    <span className="text-[9px] text-[#7c5cfc] bg-[#7c5cfc]/10 px-1.5 py-0.5 rounded">scheduled</span>
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
