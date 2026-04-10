import React from "react";
import { formatCurrency } from "../utils/format";

export default function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-navy-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="font-mono font-medium text-white">{formatCurrency(entry.value, false)}</span>
        </div>
      ))}
    </div>
  );
}
