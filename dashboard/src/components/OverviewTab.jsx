import React from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Wallet, ArrowDownLeft, ArrowUpRight, TrendingDown, Landmark, Shield, AlertTriangle } from "lucide-react";
import KPICard from "./KPICard";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";
import { formatCurrency } from "../utils/format";

const PIE_COLORS = ["#22d3ee", "#10b981", "#a78bfa", "#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#14b8a6"];

export default function OverviewTab({ data }) {
  const report = data?.report;
  const summary = report?.summary || {};
  const receipts = report?.receiptBreakdown || [];
  const disbursements = report?.disbursementBreakdown || [];
  const reserves = report?.reserves || {};
  const sideData = report?.sideData || {};
  const bankBalances = report?.bankBalances || [];

  // KPI values
  const openingBalance = summary.openingBalance || 0;
  const totalReceipts = summary.totalReceipts || 0;
  const totalDisbursements = summary.totalDisbursements || 0;
  const netCashFlow = summary.netCashFlow || (totalReceipts - totalDisbursements);
  const closingBalance = summary.closingBalance || 0;

  // Receipt pie data
  const receiptPieData = receipts
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // Disbursement bar data
  const disbursementBarData = disbursements
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Opening Balance" value={openingBalance} icon={Wallet} color="cyan" />
        <KPICard title="Total Receipts MTD" value={totalReceipts} icon={ArrowDownLeft} color="green" />
        <KPICard title="Total Disbursements MTD" value={totalDisbursements} icon={ArrowUpRight} color="red" />
        <KPICard title="Net Cash Flow" value={netCashFlow} icon={TrendingDown} color={netCashFlow >= 0 ? "green" : "red"} />
        <KPICard title="Closing Balance" value={closingBalance} icon={Landmark} color="purple" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receipt Breakdown Donut */}
        <ChartCard title="Receipt Breakdown by Channel">
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
        <ChartCard title="Disbursement Breakdown">
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

      {/* Cash Position & Reserves */}
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

        {/* Bank Balances Table */}
        <ChartCard title="Bank Account Balances" className="lg:col-span-2">
          {bankBalances.length > 0 ? (
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
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">No bank balance data</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
