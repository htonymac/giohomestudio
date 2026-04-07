"use client";

import { useEffect, useState } from "react";

interface BudgetData {
  totalEstimated: number;
  totalItems: number;
  costPerItem: number;
  byProvider: { provider: string; count: number; estimatedCost: number }[];
  monthly: { month: string; count: number; cost: number }[];
}

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/budget")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[#6060a0] text-center py-12">Loading budget data...</p>;
  if (!data) return <p className="text-red-400 text-center py-12">Failed to load budget data.</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Budget Tracker</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-[10px] text-[#6060a0] uppercase tracking-wider font-medium">Estimated Total Spend</p>
          <p className="text-2xl font-bold text-white mt-1">${data.totalEstimated.toFixed(2)}</p>
          <p className="text-[10px] text-[#404060] mt-0.5">Based on per-use estimates</p>
        </div>
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-[10px] text-[#6060a0] uppercase tracking-wider font-medium">Total Items</p>
          <p className="text-2xl font-bold text-[#7c5cfc] mt-1">{data.totalItems}</p>
        </div>
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-[10px] text-[#6060a0] uppercase tracking-wider font-medium">Avg Cost / Item</p>
          <p className="text-2xl font-bold text-[#a855f7] mt-1">${data.costPerItem.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Provider breakdown */}
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#b090ff] mb-3">Cost by Provider</p>
          <div className="space-y-2">
            {data.byProvider.map(p => (
              <div key={p.provider} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.estimatedCost > 0 ? "bg-orange-400" : "bg-green-500"}`} />
                  <span className="text-xs text-gray-300">{p.provider}</span>
                  <span className="text-[10px] text-gray-600">({p.count} uses)</span>
                </div>
                <span className={`text-xs font-mono ${p.estimatedCost > 0 ? "text-orange-400" : "text-green-400"}`}>
                  ${p.estimatedCost.toFixed(2)}
                </span>
              </div>
            ))}
            {data.byProvider.length === 0 && (
              <p className="text-[#404060] text-xs text-center py-4">No provider data yet</p>
            )}
          </div>
        </div>

        {/* Monthly breakdown */}
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#b090ff] mb-3">Monthly Spend</p>
          <div className="space-y-2">
            {data.monthly.map(m => {
              const maxCost = Math.max(1, ...data.monthly.map(x => x.cost));
              const pct = (m.cost / maxCost) * 100;
              return (
                <div key={m.month}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-400">{m.month}</span>
                    <span className="text-xs text-gray-300">${m.cost.toFixed(2)} ({m.count} items)</span>
                  </div>
                  <div className="w-full h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#a855f7] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.monthly.length === 0 && (
              <p className="text-[#404060] text-xs text-center py-4">No monthly data yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#b090ff] mb-2">Cost Savings</p>
        <p className="text-xs text-[#8080b0]">
          Free providers used: <span className="text-green-400 font-medium">{data.byProvider.filter(p => p.estimatedCost === 0).length}</span> providers at $0.
          {" "}Piper TTS and mock providers save you money every render.
        </p>
      </div>
    </div>
  );
}
