import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Calendar, CreditCard, Building2, Receipt, Info } from "lucide-react";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";
import PeriodFilter, { filterMonths } from "./PeriodFilter";
import { formatCurrency } from "../utils/format";

export default function PaymentsTab({ data }) {
  const [period, setPeriod] = useState({ type: "all" });
  const report = data?.report || {};
  const forecast = data?.forecast || {};
  const payments = report?.paymentRuns || {};
  const vendors = payments?.vendors || [];
  const relatedParty = payments?.relatedParty || [];
  const taxes = payments?.taxes || [];
  const topVendors = payments?.topVendors || [];
  const reserves = report?.reserves || {};

  const allForecastMonthly = forecast?.monthly || [];
  const forecastMonthly = filterMonths(allForecastMonthly, period);

  // Top vendors chart data
  const vendorChartData = (topVendors.length > 0 ? topVendors : vendors)
    .filter((v) => v.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Tax calendar data from reserves
  const taxCalendar = taxes.length > 0 ? taxes : (reserves?.components || []).filter((c) => c.amount > 0);

  const hasReportData = vendors.length > 0 || relatedParty.length > 0 || taxes.length > 0 || topVendors.length > 0;
  const hasForecastData = allForecastMonthly.length > 0;
  const forecastOnly = !hasReportData && hasForecastData;

  // Forecast cost breakdown by month (for fallback display)
  const forecastCostData = forecastMonthly.map((m) => ({
    month: m.month,
    directCosts: Math.abs(m.totalDirectCosts || 0),
    opex: Math.abs(m.totalOpex || 0),
    gamingTaxes: Math.abs(m.gamingTaxes || 0),
    personnel: Math.abs(m.personnelCosts || 0),
    marketing: Math.abs(m.marketingCosts || 0),
  }));

  // Forecast line items table data
  const forecastLineItems = [
    { label: "Gaming Taxes", key: "gamingTaxes" },
    { label: "SPS Sportsoft", key: "spsSportsoft" },
    { label: "VAS & USSD", key: "vasUssd" },
    { label: "Bulk USSD", key: "bulkUssd" },
    { label: "Business Licence", key: "businessLicence" },
    { label: "Personnel Costs", key: "personnelCosts" },
    { label: "Marketing Costs", key: "marketingCosts" },
    { label: "Rent & Utilities", key: "rentUtilities" },
    { label: "Bank Charges", key: "bankCharges" },
    { label: "Agency OpEx", key: "agencyOpex" },
    { label: "Social Media", key: "socialMedia" },
    { label: "Sponsorships", key: "sponsorships" },
    { label: "Staff Costs", key: "staffCosts" },
  ].filter((item) => forecastMonthly.some((m) => Math.abs(m[item.key] || 0) > 0));

  if (!hasReportData && !hasForecastData) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        No payment data available. Upload a Cashflow Report file.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <PeriodFilter value={period} onChange={setPeriod} />

      {/* Forecast-only banner */}
      {forecastOnly && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/20 border border-amber-800/50 rounded-lg text-amber-300 text-sm">
          <Info className="w-4 h-4" />
          Showing forecast cost projections. Upload a Cashflow Report file for actual payment data.
        </div>
      )}

      {/* Forecast Cost Breakdown (when no report data) */}
      {forecastOnly && forecastCostData.length > 0 && (
        <>
          <ChartCard title="Forecast Direct Costs & OpEx by Month">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={forecastCostData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="directCosts" name="Direct Costs" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={18} />
                <Bar dataKey="opex" name="Operating Expenses" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Forecast Expense Breakdown by Month">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={forecastCostData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gamingTaxes" name="Gaming Taxes" stackId="a" fill="#ef4444" />
                <Bar dataKey="personnel" name="Personnel" stackId="a" fill="#a78bfa" />
                <Bar dataKey="marketing" name="Marketing" stackId="a" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Forecast Cost Line Items Table */}
          <ChartCard title="Forecast Cost Line Items by Month">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-700">
                    <th className="pb-3 pr-4 font-medium sticky left-0 bg-navy-800">Line Item</th>
                    {forecastMonthly.map((m) => (
                      <th key={m.month} className="pb-3 pr-3 font-medium text-right">{m.month}</th>
                    ))}
                    <th className="pb-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastLineItems.map((item) => {
                    const total = forecastMonthly.reduce((s, m) => s + Math.abs(m[item.key] || 0), 0);
                    return (
                      <tr key={item.key} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="py-2.5 pr-4 font-medium text-gray-300 sticky left-0 bg-navy-800 whitespace-nowrap">{item.label}</td>
                        {forecastMonthly.map((m) => (
                          <td key={m.month} className="py-2.5 pr-3 text-right font-mono text-gray-400">
                            {formatCurrency(Math.abs(m[item.key] || 0))}
                          </td>
                        ))}
                        <td className="py-2.5 text-right font-mono font-medium text-red-400">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-600 font-medium">
                    <td className="py-2.5 pr-4 text-gray-200 text-sm sticky left-0 bg-navy-800">Total</td>
                    {forecastMonthly.map((m) => {
                      const monthTotal = Math.abs(m.totalDirectCosts || 0) + Math.abs(m.totalOpex || 0);
                      return (
                        <td key={m.month} className="py-2.5 pr-3 text-right font-mono text-red-400">{formatCurrency(monthTotal)}</td>
                      );
                    })}
                    <td className="py-2.5 text-right font-mono font-bold text-red-400">
                      {formatCurrency(forecastMonthly.reduce((s, m) => s + Math.abs(m.totalDirectCosts || 0) + Math.abs(m.totalOpex || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ChartCard>
        </>
      )}

      {/* Report-based payment data */}
      {hasReportData && (<>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Payment Runs - Vendors */}
        <ChartCard title="Vendor Payment Runs">
          <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <CreditCard className="w-3.5 h-3.5" />
            Scheduled vendor payments
          </div>
          {vendors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="pb-2 text-left font-medium">Description</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                    <th className="pb-2 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2.5 text-gray-300 max-w-[200px] truncate">{v.label}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(v.amount)}</td>
                      <td className="py-2.5 text-right text-gray-500">{v.date || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-sm">No vendor payment data</div>
          )}
        </ChartCard>

        {/* Related Party Payments */}
        <ChartCard title="Related Party Payments">
          <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <Building2 className="w-3.5 h-3.5" />
            Related party obligations
          </div>
          {relatedParty.length > 0 ? (
            <div className="space-y-3">
              {relatedParty.map((rp, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-navy-900 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-300">{rp.label}</div>
                    {rp.date && <div className="text-xs text-gray-500 mt-0.5">{rp.date}</div>}
                  </div>
                  <div className="font-mono text-sm font-medium text-amber-400" title={formatCurrency(rp.amount, false)}>
                    {formatCurrency(rp.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-sm">No related party data</div>
          )}
        </ChartCard>
      </div>

      {/* Top Vendors Chart */}
      {vendorChartData.length > 0 && (
        <ChartCard title="Top Vendor Payments">
          <ResponsiveContainer width="100%" height={Math.max(200, vendorChartData.length * 40 + 40)}>
            <BarChart data={vendorChartData} layout="vertical" margin={{ left: 30, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="label"
                type="category"
                width={180}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" name="Amount" fill="#22d3ee" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tax Calendar */}
        <ChartCard title="Tax Obligations">
          <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            Upcoming tax payments
          </div>
          {taxCalendar.length > 0 ? (
            <div className="space-y-3">
              {taxCalendar.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-navy-900 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-300">{t.label || t.category}</div>
                    {t.date && <div className="text-xs text-gray-500 mt-0.5">{t.date}</div>}
                  </div>
                  <div className="font-mono text-sm font-medium text-red-400" title={formatCurrency(t.amount, false)}>
                    {formatCurrency(t.amount)}
                  </div>
                </div>
              ))}
              {reserves.totalTaxLiability > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                  <span className="text-sm font-medium text-gray-200">Total Tax Liability</span>
                  <span className="font-mono text-sm font-bold text-red-400">{formatCurrency(reserves.totalTaxLiability)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-sm">No tax obligation data</div>
          )}
        </ChartCard>

        {/* Tax Payments */}
        <ChartCard title="Scheduled Tax Payments">
          <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <Receipt className="w-3.5 h-3.5" />
            From payments schedule
          </div>
          {taxes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="pb-2 text-left font-medium">Tax Type</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                    <th className="pb-2 text-right font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.map((t, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-2.5 text-gray-300">{t.label}</td>
                      <td className="py-2.5 text-right font-mono text-red-400">{formatCurrency(t.amount)}</td>
                      <td className="py-2.5 text-right text-gray-500">{t.date || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-sm">No scheduled tax payment data</div>
          )}
        </ChartCard>
      </div>
      </>
      )}
    </div>
  );
}
