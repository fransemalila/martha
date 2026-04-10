import React, { useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Wallet, ArrowDownLeft, ArrowUpRight, TrendingDown, Landmark, Info } from "lucide-react";
import KPICard from "./KPICard";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";
import PeriodFilter, { filterMonths } from "./PeriodFilter";
import { formatCurrency } from "../utils/format";

const PIE_COLORS = ["#22d3ee", "#10b981", "#a78bfa", "#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

export default function OverviewTab({ data }) {
  const [period, setPeriod] = useState({ type: "all" });
  const report = data?.report;
  const forecast = data?.forecast;
  const summary = report?.summary || {};
  const receipts = report?.receiptBreakdown || [];
  const disbursements = report?.disbursementBreakdown || [];
  const reserves = report?.reserves || {};
  const sideData = report?.sideData || {};
  const bankBalances = report?.bankBalances || [];

  // Use report data first, fall back to filtered forecast data
  const allForecastMonthly = forecast?.monthly || [];
  const forecastMonthly = filterMonths(allForecastMonthly, period);
  const currentMonthIdx = new Date().getMonth();
  const currentForecast = allForecastMonthly[currentMonthIdx] || {};

  const usingForecast = !data?.hasReport && data?.hasForecast;

  // When using forecast, aggregate over selected period
  const openingBalance = summary.openingBalance ||
    (forecastMonthly.length > 0 ? (forecastMonthly[0].beginningBalance || 0) : 0);
  const totalReceipts = summary.totalReceipts ||
    forecastMonthly.reduce((s, m) => s + (m.totalReceipts || 0), 0);
  const totalDisbursements = summary.totalDisbursements ||
    forecastMonthly.reduce((s, m) => s + Math.abs(m.totalDirectCosts || 0) + Math.abs(m.totalOpex || 0), 0);
  const netCashFlow = summary.netCashFlow ||
    forecastMonthly.reduce((s, m) => s + (m.netCashFlow || 0), 0) || (totalReceipts - totalDisbursements);
  const closingBalance = summary.closingBalance ||
    (forecastMonthly.length > 0 ? (forecastMonthly[forecastMonthly.length - 1].closingBalance || 0) : 0);

  // Build receipt pie from report, or from forecast revenue lines (aggregated over selected period)
  let receiptPieData = receipts.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  if (receiptPieData.length === 0 && forecastMonthly.length > 0) {
    const forecastReceipts = [
      { category: "C2B Mobile Money", amount: forecastMonthly.reduce((s, m) => s + (m.c2bMobile || 0), 0) },
      { category: "Interest Income", amount: forecastMonthly.reduce((s, m) => s + (m.interestIncome || 0) + (m.interestMNO || 0), 0) },
      { category: "Fixed Deposit Maturity", amount: forecastMonthly.reduce((s, m) => s + (m.fixedDepositMaturity || 0), 0) },
      { category: "Liquidation Call Deposit", amount: forecastMonthly.reduce((s, m) => s + (m.liquidationCall || 0), 0) },
      { category: "Other Income", amount: forecastMonthly.reduce((s, m) => s + (m.otherIncome || 0) + (m.cashDeposit || 0), 0) },
    ].filter((r) => r.amount > 0);
    receiptPieData = forecastReceipts;
  }

  // Build disbursement breakdown from report, or from forecast (aggregated over selected period)
  let disbursementBarData = disbursements.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  if (disbursementBarData.length === 0 && forecastMonthly.length > 0) {
    const forecastDisb = [
      { category: "Gaming Taxes", amount: forecastMonthly.reduce((s, m) => s + Math.abs(m.gamingTaxes || 0), 0) },
      { category: "SPS Sportsoft", amount: forecastMonthly.reduce((s, m) => s + Math.abs(m.spsSportsoft || 0), 0) },
      { category: "Personnel Costs", amount: forecastMonthly.reduce((s, m) => s + Math.abs(m.personnelCosts || 0), 0) },
      { category: "Marketing", amount: forecastMonthly.reduce((s, m) => s + Math.abs(m.marketingCosts || 0), 0) },
      { category: "Rent & Utilities", amount: forecastMonthly.reduce((s, m) => s + Math.abs(m.rentUtilities || 0), 0) },
      { category: "Bank Charges", amount: forecastMonthly.reduce((s, m) => s + Math.abs(m.bankCharges || 0), 0) },
    ].filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
    disbursementBarData = forecastDisb;
  }

  // Forecast summary for months overview
  const forecastSummaryData = forecastMonthly.map((m) => ({
    month: m.month,
    receipts: m.totalReceipts || 0,
    costs: Math.abs(m.totalDirectCosts || 0) + Math.abs(m.totalOpex || 0),
  }));

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <PeriodFilter value={period} onChange={setPeriod} />

      {/* Data source indicator */}
      {usingForecast && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/20 border border-amber-800/50 rounded-lg text-amber-300 text-sm">
          <Info className="w-4 h-4" />
          Showing forecast data for selected period. Upload a Cashflow Report file for actuals.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Opening Balance" value={openingBalance} icon={Wallet} color="cyan" subtitle={usingForecast ? "Forecast" : "MTD"} />
        <KPICard title="Total Receipts" value={totalReceipts} icon={ArrowDownLeft} color="green" subtitle={usingForecast ? "Forecast" : "MTD"} />
        <KPICard title="Total Disbursements" value={totalDisbursements} icon={ArrowUpRight} color="red" subtitle={usingForecast ? "Forecast" : "MTD"} />
        <KPICard title="Net Cash Flow" value={netCashFlow} icon={TrendingDown} color={netCashFlow >= 0 ? "green" : "red"} />
        <KPICard title="Closing Balance" value={closingBalance} icon={Landmark} color="purple" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receipt Breakdown Donut */}
        <ChartCard title={`Receipt Breakdown ${usingForecast ? "(Forecast)" : "by Channel"}`}>
          {receiptPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={receiptPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  dataKey="amount"
                  nameKey="category"
                  paddingAngle={2}
                >
                  {receiptPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                <Legend
                  formatter={(value) => <span className="text-xs text-gray-400">{value}</span>}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-gray-500 text-sm">No receipt data</div>
          )}
        </ChartCard>

        {/* Disbursement Breakdown */}
        <ChartCard title={`Disbursement Breakdown ${usingForecast ? "(Forecast)" : ""}`}>
          {disbursementBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={disbursementBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={140}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Amount" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-gray-500 text-sm">No disbursement data</div>
          )}
        </ChartCard>
      </div>

      {/* Cash Position & Bank Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Cash Position Summary" className="lg:col-span-1">
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Tax Liability</span>
              <span className="font-mono text-sm text-red-400">{formatCurrency(reserves.totalTaxLiability)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Reserves</span>
              <span className="font-mono text-sm text-emerald-400">{formatCurrency(sideData.reserves)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Tax Due</span>
              <span className="font-mono text-sm text-amber-400">{formatCurrency(sideData.taxDue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Payment Run</span>
              <span className="font-mono text-sm">{formatCurrency(sideData.paymentRun)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-300">Net Cash Position</span>
              <span className={`font-mono text-sm font-bold ${(sideData.netCashPosition || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(sideData.netCashPosition)}
              </span>
            </div>
          </div>
        </ChartCard>

        {/* Bank Balances or Forecast Monthly Overview */}
        {bankBalances.length > 0 ? (
          <ChartCard title="Bank Account Balances" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-800">
                    <th className="pb-2 pr-4 font-medium">Account</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Opening</th>
                    <th className="pb-2 pr-4 font-medium text-right">Received</th>
                    <th className="pb-2 pr-4 font-medium text-right">Spent</th>
                    <th className="pb-2 font-medium text-right">Closing (TZS)</th>
                  </tr>
                </thead>
                <tbody>
                  {bankBalances.map((b, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="py-2 pr-4 font-medium text-gray-300 max-w-[200px] truncate" title={b.account}>{b.account}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${b.status === "Active" ? "bg-emerald-900/40 text-emerald-400" : "bg-gray-800 text-gray-500"}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{formatCurrency(b.openingBalance)}</td>
                      <td className="py-2 pr-4 text-right font-mono text-emerald-400">{formatCurrency(b.cashReceived)}</td>
                      <td className="py-2 pr-4 text-right font-mono text-red-400">{formatCurrency(b.cashSpent)}</td>
                      <td className="py-2 text-right font-mono font-medium" title={formatCurrency(b.closingBalanceTZS, false)}>
                        {formatCurrency(b.closingBalanceTZS)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        ) : forecastSummaryData.length > 0 ? (
          <ChartCard title="Monthly Forecast Overview" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={forecastSummaryData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="receipts" name="Receipts" fill="#10b981" radius={[2, 2, 0, 0]} barSize={14} />
                <Bar dataKey="costs" name="Costs" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <ChartCard title="Bank Account Balances" className="lg:col-span-2">
            <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">No bank balance data</div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
