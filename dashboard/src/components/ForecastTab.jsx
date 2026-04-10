import React, { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, BarChart,
} from "recharts";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";
import PeriodFilter, { filterMonths } from "./PeriodFilter";
import { formatCurrency } from "../utils/format";

export default function ForecastTab({ data }) {
  const [period, setPeriod] = useState({ type: "all" });
  const forecast = data?.forecast;
  const allMonthly = forecast?.monthly || [];

  if (allMonthly.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        No forecast data available. Upload a Cash Flow Forecast file.
      </div>
    );
  }

  const monthly = filterMonths(allMonthly, period);

  // Monthly trend data for composed chart
  const trendData = monthly.map((m) => ({
    month: m.month,
    receipts: m.totalReceipts || 0,
    directCosts: Math.abs(m.totalDirectCosts || 0),
    opex: Math.abs(m.totalOpex || 0),
    closingBalance: m.closingBalance || 0,
  }));

  // Balance trajectory
  const balanceData = monthly.map((m) => ({
    month: m.month,
    opening: m.beginningBalance || 0,
    closing: m.closingBalance || 0,
  }));

  // Expense stack
  const expenseData = monthly.map((m) => ({
    month: m.month,
    gamingTaxes: Math.abs(m.gamingTaxes || 0),
    spsSportsoft: Math.abs(m.spsSportsoft || 0),
    personnelCosts: Math.abs(m.personnelCosts || 0),
    marketingCosts: Math.abs(m.marketingCosts || 0),
    other: Math.abs((m.totalOpex || 0) - (m.personnelCosts || 0) - (m.marketingCosts || 0)),
  }));

  // Revenue composition
  const revenueData = monthly.map((m) => ({
    month: m.month,
    c2bMobile: m.c2bMobile || 0,
    interestIncome: (m.interestIncome || 0) + (m.interestMNO || 0),
    fixedDeposit: m.fixedDepositMaturity || 0,
    otherRevenue: (m.otherIncome || 0) + (m.cashDeposit || 0) + (m.unsecuredLoan || 0),
  }));

  // Summary table
  const summaryData = monthly.map((m) => ({
    month: m.month,
    receipts: m.totalReceipts || 0,
    directCosts: m.totalDirectCosts || 0,
    opex: m.totalOpex || 0,
    netFlow: m.netCashFlow || 0,
    closing: m.closingBalance || 0,
  }));

  // Period totals
  const periodTotals = {
    receipts: summaryData.reduce((s, r) => s + r.receipts, 0),
    directCosts: summaryData.reduce((s, r) => s + r.directCosts, 0),
    opex: summaryData.reduce((s, r) => s + r.opex, 0),
    netFlow: summaryData.reduce((s, r) => s + r.netFlow, 0),
    closing: summaryData.length > 0 ? summaryData[summaryData.length - 1].closing : 0,
  };

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <PeriodFilter value={period} onChange={setPeriod} />

      {/* Monthly Trend Chart */}
      <ChartCard title="Monthly Cash Flow Trend">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={trendData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="receipts" name="Receipts" fill="#10b981" radius={[2, 2, 0, 0]} barSize={20} />
            <Bar dataKey="directCosts" name="Direct Costs" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={20} />
            <Bar dataKey="opex" name="Operating Expenses" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={20} />
            <Line type="monotone" dataKey="closingBalance" name="Closing Balance" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balance Trajectory */}
        <ChartCard title="Balance Trajectory">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={balanceData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="opening" name="Opening Balance" fill="#a78bfa" fillOpacity={0.15} stroke="#a78bfa" strokeWidth={2} />
              <Area type="monotone" dataKey="closing" name="Closing Balance" fill="#22d3ee" fillOpacity={0.15} stroke="#22d3ee" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Expense Stack */}
        <ChartCard title="Expense Breakdown">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expenseData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="gamingTaxes" name="Gaming Taxes" stackId="a" fill="#ef4444" />
              <Bar dataKey="spsSportsoft" name="SPS Sportsoft" stackId="a" fill="#f59e0b" />
              <Bar dataKey="personnelCosts" name="Personnel" stackId="a" fill="#a78bfa" />
              <Bar dataKey="marketingCosts" name="Marketing" stackId="a" fill="#6366f1" />
              <Bar dataKey="other" name="Other" stackId="a" fill="#475569" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Revenue Composition */}
      <ChartCard title="Revenue Composition by Month">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="c2bMobile" name="C2B Mobile" fill="#22d3ee" radius={[2, 2, 0, 0]} barSize={16} />
            <Bar dataKey="interestIncome" name="Interest Income" fill="#10b981" radius={[2, 2, 0, 0]} barSize={16} />
            <Bar dataKey="fixedDeposit" name="Fixed Deposit" fill="#a78bfa" radius={[2, 2, 0, 0]} barSize={16} />
            <Bar dataKey="otherRevenue" name="Other Revenue" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Summary Table */}
      <ChartCard title="Monthly Forecast Summary">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 text-left border-b border-gray-700">
                <th className="pb-3 pr-4 font-medium">Month</th>
                <th className="pb-3 pr-4 font-medium text-right">Receipts</th>
                <th className="pb-3 pr-4 font-medium text-right">Direct Costs</th>
                <th className="pb-3 pr-4 font-medium text-right">OpEx</th>
                <th className="pb-3 pr-4 font-medium text-right">Net Flow</th>
                <th className="pb-3 font-medium text-right">Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-2.5 pr-4 font-medium text-gray-300">{row.month}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-emerald-400">{formatCurrency(row.receipts)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-red-400">{formatCurrency(row.directCosts)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-amber-400">{formatCurrency(row.opex)}</td>
                  <td className={`py-2.5 pr-4 text-right font-mono font-medium ${row.netFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(row.netFlow)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium" title={formatCurrency(row.closing, false)}>
                    {formatCurrency(row.closing)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-600 font-medium">
                <td className="py-2.5 pr-4 text-gray-200 text-sm">Selected Period Total</td>
                <td className="py-2.5 pr-4 text-right font-mono text-emerald-400">{formatCurrency(periodTotals.receipts)}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-red-400">{formatCurrency(periodTotals.directCosts)}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-amber-400">{formatCurrency(periodTotals.opex)}</td>
                <td className={`py-2.5 pr-4 text-right font-mono font-medium ${periodTotals.netFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(periodTotals.netFlow)}
                </td>
                <td className="py-2.5 text-right font-mono font-medium" title={formatCurrency(periodTotals.closing, false)}>
                  {formatCurrency(periodTotals.closing)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
