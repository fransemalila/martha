import React, { useState, useEffect, useCallback } from "react";
import {
  Upload, FileSpreadsheet, Trash2, CheckCircle2, AlertTriangle,
  LogOut, RefreshCw, Info
} from "lucide-react";

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function UploadPage({ onLogout }) {
  const [files, setFiles] = useState([]);
  const [fileType, setFileType] = useState("forecast");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState("");

  const password = sessionStorage.getItem("upload_password") || "";

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const hasForecast = files.some((f) => f.type === "forecast" && f.status === "parsed");
  const hasReport = files.some((f) => f.type === "report" && f.status === "parsed");

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", fileType);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-upload-password": password },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResult(data);
        fetchFiles();
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this file?")) return;
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (res.ok) fetchFiles();
    } catch {
      // ignore
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleUpload(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Treasury Upload Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Upload Excel cashflow files for the dashboard</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      {/* Status Banner */}
      <div className="flex gap-4 mb-6">
        <div className={`flex-1 p-4 rounded-xl border ${hasForecast ? "bg-emerald-900/20 border-emerald-700" : "bg-amber-900/20 border-amber-700"}`}>
          <div className="flex items-center gap-2">
            {hasForecast ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
            <span className="font-medium">{hasForecast ? "Forecast Uploaded" : "Forecast Missing"}</span>
          </div>
        </div>
        <div className={`flex-1 p-4 rounded-xl border ${hasReport ? "bg-emerald-900/20 border-emerald-700" : "bg-amber-900/20 border-amber-700"}`}>
          <div className="flex items-center gap-2">
            {hasReport ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
            <span className="font-medium">{hasReport ? "Report Uploaded" : "Report Missing"}</span>
          </div>
        </div>
      </div>

      {/* File Type Selector */}
      <div className="bg-navy-800 rounded-xl p-6 border border-gray-800 mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">File Type</label>
        <div className="flex gap-4">
          <label className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-colors ${fileType === "forecast" ? "border-cyan-400 bg-cyan-400/5" : "border-gray-700 hover:border-gray-500"}`}>
            <input
              type="radio"
              name="fileType"
              value="forecast"
              checked={fileType === "forecast"}
              onChange={(e) => setFileType(e.target.value)}
              className="sr-only"
            />
            <div className="font-medium">Cash Flow Forecast</div>
            <div className="text-xs text-gray-400 mt-1">SPL_CASHFLOW_FORECAST_2026.xlsx</div>
          </label>
          <label className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-colors ${fileType === "report" ? "border-cyan-400 bg-cyan-400/5" : "border-gray-700 hover:border-gray-500"}`}>
            <input
              type="radio"
              name="fileType"
              value="report"
              checked={fileType === "report"}
              onChange={(e) => setFileType(e.target.value)}
              className="sr-only"
            />
            <div className="font-medium">Cashflow Report</div>
            <div className="text-xs text-gray-400 mt-1">SPL_Cashflow_Report_*.xlsx</div>
          </label>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`bg-navy-800 rounded-xl border-2 border-dashed p-12 text-center transition-colors mb-6 ${
          dragActive ? "border-cyan-400 bg-cyan-400/5" : "border-gray-700 hover:border-gray-500"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
            <p className="text-lg font-medium">Uploading & parsing...</p>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-3">
            <Upload className="w-12 h-12 text-gray-500" />
            <p className="text-lg font-medium">Drop your Excel file here</p>
            <p className="text-sm text-gray-400">or click to browse (.xlsx files only, max 50MB)</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInput}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">Upload Successful</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">File:</span>{" "}
              <span className="font-mono">{uploadResult.fileName}</span>
            </div>
            <div>
              <span className="text-gray-400">Type:</span>{" "}
              <span className="capitalize">{uploadResult.type}</span>
            </div>
            <div>
              <span className="text-gray-400">Sheets Found:</span>{" "}
              <span className="font-mono">{uploadResult.sheetsFound?.join(", ")}</span>
            </div>
            <div>
              <span className="text-gray-400">Data Points:</span>{" "}
              <span className="font-mono">{uploadResult.dataPoints}</span>
            </div>
          </div>
          {uploadResult.warnings?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-800">
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
                <AlertTriangle className="w-4 h-4" /> Warnings
              </div>
              <ul className="text-sm text-amber-300 list-disc list-inside">
                {uploadResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 mb-6 flex items-center gap-2 text-red-300">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Upload History */}
      <div className="bg-navy-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            Upload History
          </h2>
          <button onClick={fetchFiles} className="text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {files.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No files uploaded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="px-4 py-3 font-medium">Filename</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Uploaded</th>
                  <th className="px-4 py-3 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-mono text-xs">{f.filename}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${f.type === "forecast" ? "bg-purple-900/40 text-purple-300" : "bg-blue-900/40 text-blue-300"}`}>
                        {f.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{formatFileSize(f.filesize)}</td>
                    <td className="px-4 py-3">
                      {f.status === "parsed" ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Parsed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(f.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
