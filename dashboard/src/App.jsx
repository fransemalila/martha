import React, { useState } from "react";
import { LayoutDashboard, TrendingUp, GitCompare, CreditCard, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import useDashboardData from "./hooks/useDashboardData";
import OverviewTab from "./components/OverviewTab";
import ForecastTab from "./components/ForecastTab";
import ActualsTab from "./components/ActualsTab";
import PaymentsTab from "./components/PaymentsTab";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "forecast", label: "Cash Flow Forecast", icon: TrendingUp },
  { id: "actuals", label: "Actuals & Variance", icon: GitCompare },
  { id: "payments", label: "Payments & Obligations", icon: CreditCard },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const { data, loading, error, lastUpdated, refetch } = useDashboardData(30000);

  const hasData = data && (data.hasForecast || data.hasReport);

  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-navy-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-[1920px] mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-400 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-navy-900" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Treasury Cashflow</h1>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === id
                    ? "bg-cyan-400/10 text-cyan-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Status */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {lastUpdated && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refetch}
              className="text-gray-400 hover:text-cyan-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1920px] mx-auto px-6 py-6">
        {loading && !data ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading dashboard data...</p>
            </div>
          </div>
        ) : error && !data ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <p className="text-red-300 mb-2">Failed to load data</p>
              <p className="text-gray-500 text-sm">{error}</p>
              <button onClick={refetch} className="mt-4 px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">
                Retry
              </button>
            </div>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LayoutDashboard className="w-8 h-8 text-gray-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
              <p className="text-gray-400">
                Upload Excel cashflow files in the Upload Portal to see your dashboard come alive.
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab data={data} />}
            {activeTab === "forecast" && <ForecastTab data={data} />}
            {activeTab === "actuals" && <ActualsTab data={data} />}
            {activeTab === "payments" && <PaymentsTab data={data} />}
          </>
        )}
      </main>
    </div>
  );
}
