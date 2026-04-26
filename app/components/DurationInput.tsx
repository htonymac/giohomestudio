"use client";

// DurationInput — Time duration input with unit selector and converter
// User can input in seconds, minutes, or hours with instant conversion
// Used across all GHS sections: planners, editor, video settings

import { useState, useEffect } from "react";

interface DurationInputProps {
  value: number; // always stored as seconds
  onChange: (seconds: number) => void;
  label?: string;
  compact?: boolean;
}

export default function DurationInput({ value, onChange, label, compact }: DurationInputProps) {
  const [unit, setUnit] = useState<"sec" | "min" | "hr">("sec");
  const [displayVal, setDisplayVal] = useState(String(value));

  useEffect(() => {
    if (unit === "sec") setDisplayVal(String(Math.round(value * 10) / 10));
    else if (unit === "min") setDisplayVal(String(Math.round((value / 60) * 100) / 100));
    else setDisplayVal(String(Math.round((value / 3600) * 1000) / 1000));
  }, [value, unit]);

  function handleChange(val: string) {
    setDisplayVal(val);
    const n = parseFloat(val) || 0;
    if (unit === "sec") onChange(n);
    else if (unit === "min") onChange(n * 60);
    else onChange(n * 3600);
  }

  const toSec = value;
  const toMin = Math.round((value / 60) * 100) / 100;
  const toHr = Math.round((value / 3600) * 1000) / 1000;

  const s = { background: "#080b10", border: "1px solid #1e2a35", borderRadius: 6, padding: compact ? "4px 6px" : "6px 10px", color: "#fff", fontSize: compact ? 10 : 12, outline: "none" };

  return (
    <div>
      {label && <p style={{ fontSize: 9, color: "#5a7080", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 }}>{label}</p>}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input type="number" value={displayVal} onChange={e => handleChange(e.target.value)}
          style={{ ...s, width: compact ? 60 : 80 }} step="0.1" min="0" />
        <select value={unit} onChange={e => setUnit(e.target.value as "sec" | "min" | "hr")}
          style={{ ...s, cursor: "pointer", width: compact ? 50 : 60 }}>
          <option value="sec" style={{ background: "#080b10" }}>sec</option>
          <option value="min" style={{ background: "#080b10" }}>min</option>
          <option value="hr" style={{ background: "#080b10" }}>hr</option>
        </select>
        {/* Converter display */}
        <span style={{ fontSize: compact ? 8 : 9, color: "#3d5060", whiteSpace: "nowrap" }}>
          {unit !== "sec" && `${toSec}s`}
          {unit !== "min" && ` ${toMin}m`}
          {unit !== "hr" && value >= 3600 && ` ${toHr}h`}
        </span>
      </div>
    </div>
  );
}
