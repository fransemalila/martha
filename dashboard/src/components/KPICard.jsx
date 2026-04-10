import React from "react";
import { formatCurrency } from "../utils/format";

export default function KPICard({ title, value, icon: Icon, color = "cyan", subtitle }) {
  const colorMap = {
    cyan: "text-cyan-400 bg-cyan-400/10",
    green: "text-emerald-400 bg-emerald-400/10",
    red: "text-red-400 bg-red-400/10",
    amber: "text-amber-400 bg-amber-400/10",
    purple: "text-purple-400 bg-purple-400/10",
  };

  const valueColor = value < 0 ? "text-red-400" : "text-white";
  const [iconColor, iconBg] = (colorMap[color] || colorMap.cyan).split(" ");

  return (
    <div className="bg-navy-800 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold font-mono ${valueColor}`} title={formatCurrency(value, false)}>
        {formatCurrency(value)}
      </div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
