export function formatCurrency(value, short = true) {
  if (value === null || value === undefined || isNaN(value)) return "\u2014";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (short) {
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${abs.toFixed(0)}`;
  }

  return `TZS ${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return "\u2014";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return "\u2014";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
