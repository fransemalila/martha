require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { getDb, closeDb } = require("./db/schema");
const { parseForecast } = require("./parsers/forecastParser");
const { parseReport } = require("./parsers/reportParser");

const app = express();
const PORT = parseInt(process.env.PORT) || 5000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || "changeme";

// Ensure directories
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// CORS
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Multer setup
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.match(/\.xlsx?$/i)) {
      return cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
    }
    cb(null, true);
  },
});

// Auth middleware for upload
function authCheck(req, res, next) {
  const password = req.headers["x-upload-password"] || req.body?.password;
  if (password !== UPLOAD_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }
  next();
}

// POST /api/upload
app.post("/api/upload", authCheck, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileType = req.body?.type;
    if (!fileType || !["forecast", "report"].includes(fileType)) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid file type. Must be "forecast" or "report".' });
    }

    const buffer = fs.readFileSync(req.file.path);
    let parseResult;

    try {
      if (fileType === "forecast") {
        parseResult = parseForecast(buffer);
      } else {
        parseResult = parseReport(buffer);
      }
    } catch (parseErr) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({
        error: "Failed to parse Excel file",
        details: parseErr.message,
      });
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO uploads (filename, type, filepath, filesize, parsed_data, sheets_found, warnings, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      req.file.originalname,
      fileType,
      req.file.path,
      req.file.size,
      JSON.stringify(parseResult.parsedData),
      JSON.stringify(parseResult.sheetsFound),
      JSON.stringify(parseResult.warnings),
      "parsed"
    );

    res.json({
      success: true,
      fileId: result.lastInsertRowid,
      fileName: req.file.originalname,
      type: fileType,
      sheetsFound: parseResult.sheetsFound,
      dataPoints: parseResult.dataPoints,
      warnings: parseResult.warnings,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard-data
app.get("/api/dashboard-data", (_req, res) => {
  try {
    const db = getDb();

    const latestForecast = db.prepare(
      "SELECT * FROM uploads WHERE type = 'forecast' AND status = 'parsed' ORDER BY created_at DESC LIMIT 1"
    ).get();

    const latestReport = db.prepare(
      "SELECT * FROM uploads WHERE type = 'report' AND status = 'parsed' ORDER BY created_at DESC LIMIT 1"
    ).get();

    const response = {
      lastUpdated: new Date().toISOString(),
      hasForecast: !!latestForecast,
      hasReport: !!latestReport,
      forecast: latestForecast ? JSON.parse(latestForecast.parsed_data) : null,
      report: latestReport ? JSON.parse(latestReport.parsed_data) : null,
    };

    res.json(response);
  } catch (err) {
    console.error("Dashboard data error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/files
app.get("/api/files", (_req, res) => {
  try {
    const db = getDb();
    const files = db.prepare(
      "SELECT id, filename, type, filesize, sheets_found, warnings, status, created_at FROM uploads ORDER BY created_at DESC"
    ).all();

    res.json(
      files.map((f) => ({
        ...f,
        sheets_found: JSON.parse(f.sheets_found || "[]"),
        warnings: JSON.parse(f.warnings || "[]"),
      }))
    );
  } catch (err) {
    console.error("Files list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/files/:id
app.delete("/api/files/:id", (req, res) => {
  try {
    const db = getDb();
    const file = db.prepare("SELECT * FROM uploads WHERE id = ?").get(req.params.id);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete physical file
    if (file.filepath && fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    db.prepare("DELETE FROM uploads WHERE id = ?").run(req.params.id);

    res.json({ success: true, message: "File deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/verify
app.post("/api/auth/verify", (req, res) => {
  const password = req.body?.password;
  if (password === UPLOAD_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Debug endpoint — shows parsed data summary
app.get("/api/debug/parsed", (_req, res) => {
  try {
    const db = getDb();
    const files = db.prepare(
      "SELECT id, filename, type, status, created_at, parsed_data FROM uploads ORDER BY created_at DESC"
    ).all();

    const summary = files.map((f) => {
      const parsed = JSON.parse(f.parsed_data || "{}");
      const keys = {};
      function countKeys(obj, prefix = "") {
        for (const [k, v] of Object.entries(obj || {})) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (Array.isArray(v)) {
            keys[path] = `[${v.length} items]`;
          } else if (typeof v === "object" && v !== null) {
            keys[path] = "{object}";
            countKeys(v, path);
          } else {
            keys[path] = v;
          }
        }
      }
      countKeys(parsed);
      return {
        id: f.id,
        filename: f.filename,
        type: f.type,
        status: f.status,
        created_at: f.created_at,
        dataKeys: keys,
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export/csv?section=overview|forecast|actuals|payments
app.get("/api/export/csv", (_req, res) => {
  try {
    const db = getDb();
    const section = _req.query.section || "overview";

    const latestForecast = db.prepare(
      "SELECT parsed_data FROM uploads WHERE type = 'forecast' AND status = 'parsed' ORDER BY created_at DESC LIMIT 1"
    ).get();
    const latestReport = db.prepare(
      "SELECT parsed_data FROM uploads WHERE type = 'report' AND status = 'parsed' ORDER BY created_at DESC LIMIT 1"
    ).get();

    const forecast = latestForecast ? JSON.parse(latestForecast.parsed_data) : null;
    const report = latestReport ? JSON.parse(latestReport.parsed_data) : null;

    let csvContent = "";
    const timestamp = new Date().toISOString().split("T")[0];

    if (section === "overview" && report) {
      csvContent = "Treasury Dashboard - Overview Report\n";
      csvContent += `Generated: ${timestamp}\n\n`;

      // Summary
      const s = report.summary || {};
      csvContent += "SUMMARY\n";
      csvContent += "Metric,Amount (TZS)\n";
      csvContent += `Opening Balance,${s.openingBalance || 0}\n`;
      csvContent += `Total Receipts,${s.totalReceipts || 0}\n`;
      csvContent += `Total Disbursements,${s.totalDisbursements || 0}\n`;
      csvContent += `Net Cash Flow,${s.netCashFlow || 0}\n`;
      csvContent += `Closing Balance,${s.closingBalance || 0}\n`;
      csvContent += `Taxes,${s.taxes || 0}\n\n`;

      // Receipt breakdown
      if (report.receiptBreakdown?.length) {
        csvContent += "RECEIPT BREAKDOWN\n";
        csvContent += "Category,Amount (TZS)\n";
        for (const r of report.receiptBreakdown) {
          csvContent += `"${r.category}",${r.amount}\n`;
        }
        csvContent += "\n";
      }

      // Disbursement breakdown
      if (report.disbursementBreakdown?.length) {
        csvContent += "DISBURSEMENT BREAKDOWN\n";
        csvContent += "Category,Amount (TZS)\n";
        for (const d of report.disbursementBreakdown) {
          csvContent += `"${d.category}",${d.amount}\n`;
        }
        csvContent += "\n";
      }

      // Bank balances
      if (report.bankBalances?.length) {
        csvContent += "BANK BALANCES\n";
        csvContent += "Account,Status,Opening Balance,Cash Received,Cash Spent,Closing Balance (TZS)\n";
        for (const b of report.bankBalances) {
          csvContent += `"${b.account}","${b.status}",${b.openingBalance},${b.cashReceived},${b.cashSpent},${b.closingBalanceTZS}\n`;
        }
      }
    } else if (section === "forecast" && forecast) {
      csvContent = "Treasury Dashboard - Cash Flow Forecast\n";
      csvContent += `Generated: ${timestamp}\n\n`;
      csvContent += "Month,Receipts,Direct Costs,Operating Expenses,Net Cash Flow,Closing Balance\n";
      for (const m of forecast.monthly || []) {
        csvContent += `${m.month},${m.totalReceipts || 0},${m.totalDirectCosts || 0},${m.totalOpex || 0},${m.netCashFlow || 0},${m.closingBalance || 0}\n`;
      }
    } else if (section === "actuals" && report) {
      csvContent = "Treasury Dashboard - Tax Analysis\n";
      csvContent += `Generated: ${timestamp}\n\n`;
      if (report.reserves?.components?.length) {
        csvContent += "TAX COMPONENTS\n";
        csvContent += "Category,Amount (TZS)\n";
        for (const t of report.reserves.components) {
          csvContent += `"${t.category}",${t.amount}\n`;
        }
        csvContent += `\nTotal Tax Liability,${report.reserves.totalTaxLiability || 0}\n`;
      }
    } else if (section === "payments" && report) {
      csvContent = "Treasury Dashboard - Payments & Obligations\n";
      csvContent += `Generated: ${timestamp}\n\n`;
      const pr = report.paymentRuns || {};
      if (pr.vendors?.length) {
        csvContent += "VENDOR PAYMENTS\n";
        csvContent += "Description,Amount (TZS),Date\n";
        for (const v of pr.vendors) {
          csvContent += `"${v.label}",${v.amount},"${v.date || ""}"\n`;
        }
        csvContent += "\n";
      }
      if (pr.relatedParty?.length) {
        csvContent += "RELATED PARTY PAYMENTS\n";
        csvContent += "Description,Amount (TZS),Date\n";
        for (const rp of pr.relatedParty) {
          csvContent += `"${rp.label}",${rp.amount},"${rp.date || ""}"\n`;
        }
        csvContent += "\n";
      }
      if (pr.taxes?.length) {
        csvContent += "TAX PAYMENTS\n";
        csvContent += "Description,Amount (TZS),Date\n";
        for (const t of pr.taxes) {
          csvContent += `"${t.label}",${t.amount},"${t.date || ""}"\n`;
        }
      }
    } else {
      csvContent = "No data available for this section\n";
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="treasury-${section}-${timestamp}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Treasury Dashboard API running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`CORS origins: ${corsOrigins.join(", ")}`);
  console.log(`Upload password configured: ${UPLOAD_PASSWORD ? "yes (" + UPLOAD_PASSWORD.length + " chars)" : "NO - using default"}`);
  // Initialize DB
  getDb();
});

// Graceful shutdown
process.on("SIGINT", () => {
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});
