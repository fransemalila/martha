import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Calendar, CreditCard, Building2, Receipt } from "lucide-react";
import ChartCard from "./ChartCard";
import CustomTooltip from "./CustomTooltip";
import { formatCurrency } from "../utils/format";

export default function PaymentsTab({ data }) {
  const report = data?.report || {};
  const payments = report?.paymentRuns || {};
  const vendors = payments?.vendors || [];
  const relatedParty = payments?.relatedParty || [];
  const taxes = payments?.taxes || [];
  const topVendors = payments?.topVendors || [];
  const reserves = report?.reserves || {};

  // Top vendors chart data
  const vendorChartData = (topVendors.length > 0 ? topVendors : vendors)
    .filter((v) => v.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Tax calendar data from reserves
  const taxCalendar = taxes.length > 0 ? taxes : (reserves?.components || []).filter((c) => c.amount > 0);

  const hasAnyData = vendors.length > 0 || relatedParty.length > 0 || taxes.length > 0 || topVendors.length > 0;

  if (!hasAnyData) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        No payment data available. Upload a Cashflow Report file.
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
    </div>
  );
}
