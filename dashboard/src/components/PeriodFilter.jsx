import React from "react";
import { Calendar } from "lucide-react";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PERIOD_OPTIONS = [
  { label: "All Year", type: "all" },
  { label: "Q1", type: "quarter", value: 1 },
  { label: "Q2", type: "quarter", value: 2 },
  { label: "Q3", type: "quarter", value: 3 },
  { label: "Q4", type: "quarter", value: 4 },
  { label: "H1", type: "half", value: 1 },
  { label: "H2", type: "half", value: 2 },
  { label: "YTD", type: "ytd" },
  ...MONTH_NAMES.map((m, i) => ({ label: m, type: "month", value: i })),
];

/**
 * Returns an array of month indices (0-11) for a given period selection.
 */
export function getMonthIndices(period) {
  if (!period || period.type === "all") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  switch (period.type) {
    case "quarter": {
      const start = (period.value - 1) * 3;
      return [start, start + 1, start + 2];
    }
    case "half": {
      const start = (period.value - 1) * 6;
      return [start, start + 1, start + 2, start + 3, start + 4, start + 5];
    }
    case "ytd": {
      const currentMonth = new Date().getMonth();
      const months = [];
      for (let i = 0; i <= currentMonth; i++) months.push(i);
      return months;
    }
    case "month":
      return [period.value];
    default:
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  }
}

/**
 * Filter an array of monthly data (indexed 0-11) based on the selected period.
 * Assumes data is an array where index corresponds to month (0=Jan, 11=Dec).
 */
export function filterMonths(data, period) {
  if (!data || data.length === 0) return data;
  const indices = getMonthIndices(period);
  return data.filter((_, i) => indices.includes(i));
}

function isActive(option, value) {
  if (!value && option.type === "all") return true;
  if (!value) return false;
  if (option.type !== value.type) return false;
  if (option.type === "all" || option.type === "ytd") return true;
  return option.value === value.value;
}

export default function PeriodFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs">
        <Calendar className="w-3.5 h-3.5" />
        <span>Period</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {PERIOD_OPTIONS.map((opt) => {
          const active = isActive(opt, value);
          return (
            <button
              key={`${opt.type}-${opt.value ?? ""}`}
              onClick={() => onChange({ type: opt.type, value: opt.value })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? "bg-cyan-400/20 text-cyan-400 border border-cyan-400/40"
                  : "bg-navy-900 text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
