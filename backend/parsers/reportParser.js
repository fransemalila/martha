const XLSX = require("xlsx");

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function parseNumeric(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const s = String(val).replace(/,/g, "").replace(/\s/g, "").trim();
  if (!s || s === "-" || /^-+$/.test(s) || s === "N/A") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function norm(label) {
  if (!label) return "";
  return String(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(label, pattern) {
  const nl = norm(label);
  const np = norm(pattern);
  if (!nl || !np) return false;
  if (nl.includes(np) || nl === np) return true;
  const words = np.split(" ").filter((w) => w.length > 2);
  return words.length > 0 && words.every((w) => nl.includes(w));
}

function findSheet(workbook, name) {
  const n = norm(name);
  return workbook.SheetNames.find((s) => norm(s) === n)
    || workbook.SheetNames.find((s) => norm(s).includes(n) || n.includes(norm(s)));
}

// Scan rows and find label-value pairs from any column layout
function scanKeyValuePairs(rows, maxRows) {
  const pairs = [];
  const limit = maxRows ? Math.min(rows.length, maxRows) : rows.length;

  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row) continue;

    // Try every column as a potential label
    for (let c = 0; c < Math.min(row.length, 15); c++) {
      const cell = row[c];
      if (cell === null || cell === undefined) continue;
      if (typeof cell !== "string" || cell.trim().length < 2) continue;

      const label = cell.trim();
      const normalized = norm(label);
      if (!normalized || normalized.length < 2) continue;

      // Look for numeric value in the next few columns
      for (let v = c + 1; v < Math.min(c + 5, row.length); v++) {
        const val = row[v];
        if (val === null || val === undefined) continue;
        if (typeof val === "number" || (typeof val === "string" && /^-?[\d,]+\.?\d*$/.test(val.replace(/\s/g, "")))) {
          pairs.push({
            label,
            normalized,
            value: parseNumeric(val),
            row: i,
            labelCol: c,
            valueCol: v,
            fullRow: row,
          });
          break;
        }
      }
    }
  }
  return pairs;
}

function findPair(pairs, patterns) {
  if (!Array.isArray(patterns)) patterns = [patterns];
  for (const pattern of patterns) {
    // Exact norm match
    const exact = pairs.find((p) => p.normalized === norm(pattern));
    if (exact) return exact;
    // Fuzzy match
    const fuzzy = pairs.find((p) => fuzzyMatch(p.label, pattern));
    if (fuzzy) return fuzzy;
  }
  return null;
}

function findAllPairs(pairs, patterns) {
  const results = [];
  const used = new Set();
  if (!Array.isArray(patterns)) patterns = [patterns];

  for (const pattern of patterns) {
    for (const p of pairs) {
      if (used.has(p.row)) continue;
      if (fuzzyMatch(p.label, pattern)) {
        results.push(p);
        used.add(p.row);
      }
    }
  }
  return results;
}

// ===================== SHEET PARSERS =====================

function parseDataSheet(workbook) {
  const sheetName = findSheet(workbook, "DATA");
  if (!sheetName) return { data: null, warning: "Sheet 'DATA' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const pairs = scanKeyValuePairs(rows);

  const summary = {};

  // Extract summary values using fuzzy matching
  const openingPair = findPair(pairs, ["OPENING BALANCE", "OPENING BAL"]);
  if (openingPair) summary.openingBalance = openingPair.value;

  const receiptsPair = findPair(pairs, ["TOTAL RECEIPTS"]);
  if (receiptsPair) summary.totalReceipts = receiptsPair.value;

  const disbPair = findPair(pairs, ["TOTAL DISBURSEMENTS"]);
  if (disbPair) summary.totalDisbursements = disbPair.value;

  const netPair = findPair(pairs, ["NET CASH FLOW", "NET CASHFLOW"]);
  if (netPair) summary.netCashFlow = netPair.value;

  const closingPair = findPair(pairs, ["CLOSING BALANCE", "CLOSING BAL"]);
  if (closingPair) summary.closingBalance = closingPair.value;

  const taxesPair = findPair(pairs, ["TAXES"]);
  if (taxesPair) summary.taxes = taxesPair.value;

  // Receipt breakdown
  const receiptPatterns = [
    "MPESA", "M-PESA", "TIGO PESA", "TIGOPESA",
    "AIRTEL MONEY USSD PUSH", "AIRTEL MONEY-USSD PUSH",
    "AIRTEL MONEY",
    "HALOPESA", "HALO PESA",
    "SELCOM",
    "LIQUIDATION OF CALL DEPOSIT", "LIQUIDATION CALL DEPOSIT",
    "LIQUIDATION OF FIXED DEPOSIT", "LIQUIDATION FIXED DEPOSIT",
    "INTEREST EARNED ON CALL", "INTEREST EARNED CALL DEPOSIT",
    "INTEREST EARNED ON FIXED", "INTEREST EARNED FIXED DEPOSIT",
    "INTEREST EARNED ON MNO", "INTEREST EARNED MNO COLLECTION",
    "CASH DEPOSIT",
    "UNSECURED LOAN",
    "ACCOUNT TO ACCOUNT RECEIVED",
    "BANK TO BANK RECEIVED",
  ];

  const receiptBreakdown = [];
  const usedReceiptRows = new Set();
  for (const pattern of receiptPatterns) {
    for (const p of pairs) {
      if (usedReceiptRows.has(p.row)) continue;
      if (fuzzyMatch(p.label, pattern) && p.value !== 0) {
        // Avoid "AIRTEL MONEY" matching "AIRTEL MONEY USSD PUSH"
        if (norm(pattern) === "AIRTEL MONEY" && norm(p.label).includes("USSD")) continue;
        receiptBreakdown.push({ category: p.label, amount: p.value });
        usedReceiptRows.add(p.row);
        break;
      }
    }
  }

  // Disbursement breakdown
  const disbPatterns = [
    "RELATED PARTY PAYMENTS", "RELATED PARTY",
    "JACKPOT TOP UP", "JACKPOT TOP-UP",
    "DIRECTORS",
    "VENDOR PAYMENTS",
    "PAYROLL", "SALARY",
    "PAYMENT TO WINNERS", "PAYMENTS TO WINNERS",
  ];
  const disbursementBreakdown = [];
  const usedDisbRows = new Set();
  for (const pattern of disbPatterns) {
    for (const p of pairs) {
      if (usedDisbRows.has(p.row)) continue;
      if (fuzzyMatch(p.label, pattern) && p.value !== 0) {
        disbursementBreakdown.push({ category: p.label, amount: p.value });
        usedDisbRows.add(p.row);
        break;
      }
    }
  }

  // Side data: scan all rows for tax/reserves/cash position info
  const sideData = {};
  for (const row of rows) {
    if (!row) continue;
    for (let c = 0; c < Math.min(row.length, 15); c++) {
      const cell = row[c];
      if (!cell || typeof cell !== "string") continue;
      const n = norm(cell);
      if (n.includes("TAX DUE") && !n.includes("DATE")) {
        for (let v = c + 1; v < Math.min(c + 4, row.length); v++) {
          const val = parseNumeric(row[v]);
          if (val !== 0) { sideData.taxDue = val; break; }
        }
      }
      if (n.includes("RESERVE") && !n.includes("LIQUIDATION")) {
        for (let v = c + 1; v < Math.min(c + 4, row.length); v++) {
          const val = parseNumeric(row[v]);
          if (val !== 0) { sideData.reserves = val; break; }
        }
      }
      if (n.includes("NET CASH POSITION")) {
        for (let v = c + 1; v < Math.min(c + 4, row.length); v++) {
          const val = parseNumeric(row[v]);
          if (val !== 0) { sideData.netCashPosition = val; break; }
        }
      }
      if (n.includes("PAYMENT RUN")) {
        for (let v = c + 1; v < Math.min(c + 4, row.length); v++) {
          const val = parseNumeric(row[v]);
          if (val !== 0) { sideData.paymentRun = val; break; }
        }
      }
    }
  }

  return {
    data: { summary, receiptBreakdown, disbursementBreakdown, sideData },
    warning: Object.keys(summary).length < 2 ? "Incomplete summary data in DATA sheet" : null,
  };
}

function parseReservesSheet(workbook) {
  const sheetName = findSheet(workbook, "Reserves");
  if (!sheetName) return { data: null, warning: "Sheet 'Reserves' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const pairs = scanKeyValuePairs(rows);

  const taxPatterns = [
    "GAMING TAX ON WINNINGS",
    "GAMING TAX ON GGR",
    "GAMING LEVY",
    "GAMING TAX ON VIRTUAL",
    "GAMING TAX ON CASINO",
    "WHT VENDORS", "WHT",
    "PAYE", "PAYE & SDL",
  ];

  const components = [];
  const usedRows = new Set();
  for (const pattern of taxPatterns) {
    for (const p of pairs) {
      if (usedRows.has(p.row)) continue;
      if (fuzzyMatch(p.label, pattern)) {
        components.push({ category: p.label, amount: p.value });
        usedRows.add(p.row);
        break;
      }
    }
  }

  const totalPair = findPair(pairs, ["TOTAL TAX LIABILITY", "TOTAL TAX"]);
  const totalTaxLiability = totalPair ? totalPair.value : components.reduce((s, c) => s + c.amount, 0);

  return {
    data: { totalTaxLiability, components },
    warning: components.length === 0 ? "No tax components found in Reserves sheet" : null,
  };
}

function parseGridSheet(workbook, sheetName) {
  const found = findSheet(workbook, sheetName);
  if (!found) return { data: null, warning: `Sheet '${sheetName}' not found` };

  const sheet = workbook.Sheets[found];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  if (rows.length < 3) return { data: null, warning: `${sheetName} sheet has insufficient data` };

  // Detect label column
  let labelCol = 0;
  for (let c = 0; c < Math.min(5, (rows[2] || []).length); c++) {
    const cell = rows[2] ? rows[2][c] : null;
    if (cell && typeof cell === "string" && cell.trim().length > 2) {
      labelCol = c;
      break;
    }
  }

  const dailyData = [];
  const monthlyTotals = [];
  let inMonthlySection = false;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { inMonthlySection = false; continue; }

    const rawLabel = row[labelCol];
    if (!rawLabel || typeof rawLabel !== "string") continue;
    const label = norm(rawLabel);
    if (!label) continue;

    // Detect sections by blank rows or "MONTHLY TOTAL" headers
    if (label.includes("MONTHLY") && label.includes("TOTAL")) {
      inMonthlySection = true;
      continue;
    }

    // Collect month totals if category followed by 12 month values
    if (inMonthlySection) {
      const categoryTotals = { category: rawLabel.trim() };
      let hasData = false;
      for (let m = 0; m < 12; m++) {
        const val = parseNumeric(row[labelCol + 1 + m]);
        categoryTotals[MONTH_NAMES[m]] = val;
        if (val !== 0) hasData = true;
      }
      if (hasData) monthlyTotals.push(categoryTotals);
    } else {
      // Daily data
      const entry = { category: rawLabel.trim(), values: [] };
      let hasNonZero = false;
      for (let c = labelCol + 1; c < Math.min(row.length, 400); c++) {
        const val = parseNumeric(row[c]);
        if (val !== 0) {
          entry.values.push({ col: c, amount: val });
          hasNonZero = true;
        }
      }
      if (hasNonZero) dailyData.push(entry);
    }
  }

  return {
    data: { dailyData: dailyData.slice(0, 50), monthlyTotals },
    warning: null,
  };
}

function parseBBalancesSheet(workbook) {
  const sheetName = findSheet(workbook, "BBalances");
  if (!sheetName) return { data: null, warning: "Sheet 'BBalances' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const accounts = [];
  let headerRow = -1;
  let colMap = {};

  // Find header row by scanning for keywords
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;

    let hits = 0;
    for (let c = 0; c < row.length; c++) {
      const h = norm(row[c]);
      if (!h) continue;
      if (h.includes("ACCOUNT") || h.includes("BANK NAME")) { colMap.account = c; hits++; }
      if (h.includes("STATUS")) { colMap.status = c; hits++; }
      if (h.includes("OPENING")) { colMap.opening = c; hits++; }
      if (h.includes("RECEIVED") || h.includes("CASH IN")) { colMap.received = c; hits++; }
      if (h.includes("SPENT") || h.includes("CASH OUT")) { colMap.spent = c; hits++; }
      if (h.includes("REVALUATION")) { colMap.revaluation = c; hits++; }
      if (h.includes("CLOSING")) {
        if (h.includes("TZS") || !colMap.closingTZS) colMap.closingTZS = c;
        if (h.includes("FX") || h.includes("FOREIGN")) colMap.closingFX = c;
        hits++;
      }
    }
    if (hits >= 3) { headerRow = i; break; }
  }

  if (headerRow === -1) {
    return { data: null, warning: "Could not find header row in BBalances sheet" };
  }

  const acctCol = colMap.account !== undefined ? colMap.account : 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[acctCol]) continue;

    const accountName = String(row[acctCol]).trim();
    if (!accountName || norm(accountName).includes("TOTAL") || accountName.length < 3) continue;

    accounts.push({
      account: accountName,
      status: colMap.status !== undefined ? String(row[colMap.status] || "Active").trim() : "Active",
      openingBalance: colMap.opening !== undefined ? parseNumeric(row[colMap.opening]) : 0,
      cashReceived: colMap.received !== undefined ? parseNumeric(row[colMap.received]) : 0,
      cashSpent: colMap.spent !== undefined ? parseNumeric(row[colMap.spent]) : 0,
      revaluation: colMap.revaluation !== undefined ? parseNumeric(row[colMap.revaluation]) : 0,
      closingBalanceTZS: colMap.closingTZS !== undefined ? parseNumeric(row[colMap.closingTZS]) : 0,
      closingBalanceFX: colMap.closingFX !== undefined ? parseNumeric(row[colMap.closingFX]) : 0,
    });
  }

  return {
    data: accounts.length > 0 ? accounts : null,
    warning: accounts.length === 0 ? "No bank accounts found in BBalances sheet" : null,
  };
}

function parsePaymentsSheet(workbook) {
  const sheetName = findSheet(workbook, "Payments");
  if (!sheetName) return { data: null, warning: "Sheet 'Payments' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const vendors = [];
  const relatedParty = [];
  const taxes = [];
  const topVendors = [];

  let currentSection = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Find first non-empty cell as label
    let rawLabel = null;
    let labelCol = -1;
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      if (row[c] && typeof row[c] === "string" && row[c].trim().length > 2) {
        rawLabel = row[c].trim();
        labelCol = c;
        break;
      }
    }
    if (!rawLabel) continue;
    const label = norm(rawLabel);

    // Detect sections
    if (label.includes("NET VENDOR") || label.includes("VENDOR PAYMENT RUN")) {
      currentSection = "vendors"; continue;
    }
    if (label.includes("RELATED PARTY")) {
      currentSection = "relatedParty"; continue;
    }
    if ((label.includes("TAX") && !label.includes("GAMING TAX ON")) ||
        label.includes("STATUTORY")) {
      currentSection = "taxes"; continue;
    }
    if (label.includes("TOP 5") || label.includes("TOP VENDOR")) {
      currentSection = "topVendors"; continue;
    }

    // Find amount in subsequent columns
    let amount = 0;
    let date = null;
    for (let c = labelCol + 1; c < Math.min(row.length, 15); c++) {
      const cell = row[c];
      if (cell instanceof Date) {
        date = cell.toISOString().split("T")[0];
      } else if (typeof cell === "number" && cell > 40000 && cell < 50000) {
        const d = XLSX.SSF.parse_date_code(cell);
        if (d) date = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      } else if (typeof cell === "string" && /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(cell)) {
        date = cell;
      } else {
        const num = parseNumeric(cell);
        if (num !== 0 && amount === 0) amount = num;
      }
    }

    if (amount === 0) continue;

    const entry = { label: rawLabel, amount, date };
    switch (currentSection) {
      case "vendors": vendors.push(entry); break;
      case "relatedParty": relatedParty.push(entry); break;
      case "taxes": taxes.push(entry); break;
      case "topVendors": topVendors.push(entry); break;
    }
  }

  return {
    data: { vendors, relatedParty, taxes, topVendors },
    warning: null,
  };
}

function parseCFForecastSheet(workbook) {
  const sheetName = findSheet(workbook, "CF Forecast");
  if (!sheetName) return { data: null, warning: "Sheet 'CF Forecast' not found in report" };

  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  // Find 2026 columns
  const year2026Cols = [];
  const currentYear = new Date().getFullYear();
  const targetYear = currentYear;

  for (let c = range.s.c; c <= Math.min(range.e.c, 3000); c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = sheet[cellAddr];
    if (!cell) continue;

    let dateVal = null;
    if (cell.t === "d" || cell.v instanceof Date) {
      dateVal = new Date(cell.v);
    } else if (cell.t === "n" && cell.v > 40000 && cell.v < 55000) {
      const parsed = XLSX.SSF.parse_date_code(cell.v);
      if (parsed) dateVal = new Date(parsed.y, parsed.m - 1, parsed.d);
    }

    if (dateVal && dateVal.getFullYear() === targetYear) {
      year2026Cols.push({ col: c, date: dateVal.toISOString().split("T")[0] });
    }
  }

  if (year2026Cols.length === 0) {
    return { data: null, warning: `No ${targetYear} date columns found in CF Forecast sheet` };
  }

  // Find key rows
  const keyRows = {};
  for (let r = 0; r <= Math.min(range.e.r, 60); r++) {
    const cellAddr = XLSX.utils.encode_cell({ r, c: 0 });
    const cell = sheet[cellAddr];
    if (!cell) continue;
    const label = norm(cell.v);
    if (label.includes("OPENING BALANCE") || label.includes("OPENING BAL")) keyRows.openingBalance = r;
    if (label.includes("TOTAL RECEIPTS")) keyRows.totalReceipts = r;
    if (label.includes("TOTAL DISBURSEMENTS")) keyRows.totalDisbursements = r;
    if (label.includes("CLOSING BALANCE") || label.includes("CLOSING BAL")) keyRows.closingBalance = r;
  }

  const dailyData = [];
  for (const { col, date } of year2026Cols.slice(0, 120)) {
    const entry = { date };
    for (const [key, row] of Object.entries(keyRows)) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddr];
      entry[key] = cell ? parseNumeric(cell.v) : 0;
    }
    dailyData.push(entry);
  }

  return { data: dailyData, warning: null };
}

// ===================== MAIN PARSER =====================

function parseReport(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetsFound = workbook.SheetNames;
  const warnings = [];

  const dataResult = parseDataSheet(workbook);
  if (dataResult.warning) warnings.push(dataResult.warning);

  const reservesResult = parseReservesSheet(workbook);
  if (reservesResult.warning) warnings.push(reservesResult.warning);

  const receiptsResult = parseGridSheet(workbook, "Receipts");
  if (receiptsResult.warning) warnings.push(receiptsResult.warning);

  const disbursementsResult = parseGridSheet(workbook, "Disbursements");
  if (disbursementsResult.warning) warnings.push(disbursementsResult.warning);

  const bbalancesResult = parseBBalancesSheet(workbook);
  if (bbalancesResult.warning) warnings.push(bbalancesResult.warning);

  const paymentsResult = parsePaymentsSheet(workbook);
  if (paymentsResult.warning) warnings.push(paymentsResult.warning);

  const cfForecastResult = parseCFForecastSheet(workbook);
  if (cfForecastResult.warning) warnings.push(cfForecastResult.warning);

  let dataPoints = 0;
  if (dataResult.data) dataPoints += Object.keys(dataResult.data.summary || {}).length +
    (dataResult.data.receiptBreakdown?.length || 0) +
    (dataResult.data.disbursementBreakdown?.length || 0);
  if (reservesResult.data) dataPoints += (reservesResult.data.components?.length || 0);
  if (bbalancesResult.data) dataPoints += bbalancesResult.data.length * 7;
  if (cfForecastResult.data) dataPoints += cfForecastResult.data.length * 4;

  return {
    sheetsFound,
    warnings,
    dataPoints,
    parsedData: {
      summary: dataResult.data?.summary || {},
      receiptBreakdown: dataResult.data?.receiptBreakdown || [],
      disbursementBreakdown: dataResult.data?.disbursementBreakdown || [],
      sideData: dataResult.data?.sideData || {},
      reserves: reservesResult.data || { totalTaxLiability: 0, components: [] },
      bankBalances: bbalancesResult.data || [],
      dailyReceipts: receiptsResult.data || { dailyData: [], monthlyTotals: [] },
      dailyDisbursements: disbursementsResult.data || { dailyData: [], monthlyTotals: [] },
      dailyCashFlow: cfForecastResult.data || [],
      paymentRuns: paymentsResult.data || { vendors: [], relatedParty: [], taxes: [], topVendors: [] },
    },
  };
}

module.exports = { parseReport };
