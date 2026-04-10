import React from "react";

export default function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-navy-800 rounded-xl border border-gray-800 ${className}`}>
      {title && (
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        </div>
      )}
      <div className="p-5 pt-2">{children}</div>
    </div>
  );
}
