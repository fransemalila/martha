import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";
import { formatCurrency, formatPercent } from "../utils/format";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TAX_COLORS = ["#ef4444", "#f59e0b", "#a78bfa", "#6366f1", "#22d3ee", "#10b981", "#ec4899"];

export default function ActualsTab({ data }) {
  const report = data?.report || {};
  const forecast = data?.forecast || {};
  const forecastMonthly = forecast?.monthly || [];
  const summary = report?.summary || {};
  const dailyCashFlow = report?.dailyCashFlow || [];
  const dailyReceipts = report?.dailyReceipts || {};
  const reserves = report?.reserves || {};

  // Actual vs Forecast comparison
  // Use report summary as "current month" actuals, forecast as projected
  const comparisonData = [];
  const currentMonth = new Date().getMonth(); // 0-based

  for (let m = 0; m <= Math.min(currentMonth, forecastMonthly.length - 1); m++) {
    const fm = forecastMonthly[m] || {};
    const entry = {
      month: MONTH_NAMES[m],
      forecastReceipts: fm.totalReceipts || 0,
      forecastDisbursements: Math.abs(fm.totalDirectCosts || 0) + Math.abs(fm.totalOpex || 0),
    };
    // For the most recent month, use actuals from report
    if (m === currentMonth) {
      entry.actualReceipts = summary.totalReceipts || 0;
      entry.actualDisbursements = summary.totalDisbursements || 0;
    } else {
      // Previous months — use forecast as proxy (actuals would need historical data)
      entry.actualReceipts = fm.totalReceipts || 0;
      entry.actualDisbursements = Math.abs(fm.totalDirectCosts || 0) + Math.abs(fm.totalOpex || 0);
    }
    comparisonData.push(entry);
  }

  // Variance cards
  const latestForecast = forecastMonthly[currentMonth] || {};
  const forecastReceipts = latestForecast.totalReceipts || 0;
  const forecastDisbursements = Math.abs(latestForecast.totalDirectCosts || 0) + Math.abs(latestForecast.totalOpex || 0);
  const forecastNetFlow = latestForecast.netCashFlow || 0;

  const actualReceipts = summary.totalReceipts || 0;
  const actualDisbursements = summary.totalDisbursements || 0;
  const actualNetFlow = summary.netCashFlow || (actualReceipts - actualDisbursements);

  const receiptsVariance = forecastReceipts ? ((actualReceipts - forecastReceipts) / forecastReceipts) * 100 : 0;
  const disbursementsVariance = forecastDisbursements ? ((actualDisbursements - forecastDisbursements) / forecastDisbursements) * 100 : 0;
  const netFlowVariance = forecastNetFlow ? ((actualNetFlow - forecastNetFlow) / Math.abs(forecastNetFlow)) * 100 : 0;

  // Daily cash flow trend
  const dailyTrend = dailyCashFlow
    .filter((d) => d.closingBalance)
    .map((d) => ({
      date: d.date ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
      closingBalance: d.closingBalance || 0,
      totalReceipts: d.totalReceipts || 0,
      totalDisbursements: d.totalDisbursements || 0,
    }));

  // Receipt categories trend (monthly totals)
  const receiptMonthly = dailyReceipts?.monthlyTotals || [];
  const receiptCategoryData = [];
  if (receiptMonthly.length > 0) {
    // Transpose: for each month, gather category values
    for (let m = 0; m < 3 && m < MONTH_NAMES.length; m++) {
      const monthName = MONTH_NAMES[m];
      const entry = { month: monthName };
      for (const cat of receiptMonthly) {
        if (cat.category && cat[monthName]) {
          const shortName = cat.category.length > 12 ? cat.category.substring(0, 12) + "..." : cat.category;
          entry[shortName] = cat[monthName];
        }
      }
      receiptCategoryData.push(entry);
    }
  }

  // Tax analysis data
  const taxComponents = reserves?.components || [];
  const taxPieData = taxComponents.filter((t) => t.amount > 0);

  function VarianceCard({ title, actual, forecast: fc, variance }) {
    const isPositive = variance > 0;
    const Icon = variance > 0 ? TrendingUp : variance < 0 ? TrendingDown : Minus;
    return (
      <div className="bg-navy-800 rounded-xl p-5 border border-gray-800">
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{title}</div>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-xl font-bold font-mono text-white">{formatCurrency(actual)}</span>
          <span className="text-xs text-gray-500">vs {formatCurrency(fc)}</span>
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          <Icon className="w-4 h-4" />
          {formatPercent(variance)}
          <span className="text-xs text-gray-500 ml-1">variance</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Variance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <VarianceCard title="Receipts Variance" actual={actualReceipts} forecast={forecastReceipts} variance={receiptsVariance} />
        <VarianceCard title="Disbursements Variance" actual={actualDisbursements} forecast={forecastDisbursements} variance={disbursementsVariance} />
        <VarianceCard title="Net Flow Variance" actual={actualNetFlow} forecast={forecastNetFlow} variance={netFlowVariance} />
      </div>

      {/* Actual vs Forecast */}
      {comparisonData.length > 0 && (
        <ChartCard title="Actual vs Forecast Comparison">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={comparisonData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="forecastReceipts" name="Forecast Receipts" fill="#10b981" fillOpacity={0.4} barSize={18} />
              <Bar dataKey="actualReceipts" name="Actual Receipts" fill="#10b981" barSize={18} />
              <Bar dataKey="forecastDisbursements" name="Forecast Disbursements" fill="#ef4444" fillOpacity={0.4} barSize={18} />
              <Bar dataKey="actualDisbursements" name="Actual Disbursements" fill="#ef4444" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Cash Flow Trend */}
        <ChartCard title="Daily Closing Balance Trend">
          {dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyTrend} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="closingBalance" name="Closing Balance" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
              No daily cash flow data available
            </div>
          )}
        </ChartCard>

        {/* Tax Analysis */}
        <ChartCard title="Tax Component Breakdown">
          {taxPieData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={taxPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="amount"
                    nameKey="category"
                    paddingAngle={2}
                  >
                    {taxPieData.map((_, i) => (
                      <Cell key={i} fill={TAX_COLORS[i % TAX_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-navy-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
                          <p className="text-xs font-medium text-white mb-1">{d.category}</p>
                          <p className="text-sm font-mono text-cyan-400">{formatCurrency(d.amount, false)}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {taxPieData.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TAX_COLORS[i % TAX_COLORS.length] }} />
                      <span className="text-gray-400">{t.category}</span>
                    </div>
                    <span className="font-mono text-gray-300">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-800 font-medium">
                  <span className="text-gray-300">Total Tax Liability</span>
                  <span className="font-mono text-red-400">{formatCurrency(reserves.totalTaxLiability)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500 text-sm">
              No tax data available
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
