const XLSX = require("xlsx");

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function parseNumeric(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/,/g, "").trim();
  if (!s || s === "-" || /^\s*-\s*$/.test(s)) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeLabel(label) {
  if (!label) return "";
  return String(label).toUpperCase().replace(/[^A-Z0-9&/() -]/g, " ").replace(/\s+/g, " ").trim();
}

function findSheet(workbook, name) {
  const upper = name.toUpperCase().trim();
  return workbook.SheetNames.find((s) => s.toUpperCase().trim() === upper);
}

function parseDataSheet(workbook) {
  const sheetName = findSheet(workbook, "DATA");
  if (!sheetName) return { data: null, warning: "Sheet 'DATA' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const summary = {};
  const receiptBreakdown = [];
  const disbursementBreakdown = [];
  const sideData = { taxDue: null, reserves: null, netCashPosition: null, paymentRun: null };

  const receiptLabels = [
    "MPESA", "TIGO PESA", "AIRTEL MONEY-USSD PUSH", "AIRTEL MONEY",
    "HALOPESA", "SELCOM", "LIQUIDATION OF CALL DEPOSIT",
    "LIQUIDATION OF FIXED DEPOSIT", "INTEREST EARNED ON CALL DEPOSIT",
    "INTEREST EARNED ON FIXED DEPOSIT", "INTEREST EARNED ON MNO COLLECTION",
    "CASH DEPOSIT", "UNSECURED LOAN-PEVANS EA", "UNSECURED LOAN PEVANS EA"
  ];

  const disbursementLabels = [
    "RELATED PARTY PAYMENTS", "JACKPOT TOP-UP", "JACKPOT TOP UP",
    "DIRECTORS", "VENDOR PAYMENTS"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const labelRaw = row[0];
    const label = normalizeLabel(labelRaw);
    if (!label) continue;

    const val = parseNumeric(row[1]);

    // Summary fields
    if (label.includes("OPENING BALANCE")) {
      summary.openingBalance = val;
    } else if (label === "TOTAL RECEIPTS" || label.includes("TOTAL RECEIPTS")) {
      summary.totalReceipts = val;
    } else if (label === "TOTAL DISBURSEMENTS" || label.includes("TOTAL DISBURSEMENTS")) {
      summary.totalDisbursements = val;
    } else if (label.includes("NET CASH FLOW") || label === "NET CASH FLOW") {
      summary.netCashFlow = val;
    } else if (label.includes("CLOSING BALANCE")) {
      summary.closingBalance = val;
    } else if (label.includes("TAXES") && !label.includes("GAMING") && !label.includes("DUE")) {
      summary.taxes = val;
    }

    // Receipt breakdown
    for (const rl of receiptLabels) {
      if (label === rl || label.includes(rl)) {
        // Handle "AIRTEL MONEY" not matching "AIRTEL MONEY-USSD PUSH"
        if (rl === "AIRTEL MONEY" && label.includes("USSD")) continue;
        receiptBreakdown.push({ category: String(labelRaw).trim(), amount: val });
        break;
      }
    }

    // Disbursement breakdown
    for (const dl of disbursementLabels) {
      if (label === dl || label.includes(dl)) {
        disbursementBreakdown.push({ category: String(labelRaw).trim(), amount: val });
        break;
      }
    }

    // Side data (cols E-G)
    if (row[4]) {
      const sideLabel = normalizeLabel(row[4]);
      if (sideLabel.includes("TAX DUE") && !sideLabel.includes("DATE")) {
        sideData.taxDue = parseNumeric(row[5]) || parseNumeric(row[6]);
      }
      if (sideLabel.includes("RESERVE")) {
        sideData.reserves = parseNumeric(row[5]) || parseNumeric(row[6]);
      }
    }

    // Side data (cols H-I)
    if (row[7]) {
      const sideLabel2 = normalizeLabel(row[7]);
      if (sideLabel2.includes("NET CASH POSITION")) {
        sideData.netCashPosition = parseNumeric(row[8]);
      }
      if (sideLabel2.includes("PAYMENT RUN")) {
        sideData.paymentRun = parseNumeric(row[8]);
      }
    }
  }

  return {
    data: {
      summary,
      receiptBreakdown,
      disbursementBreakdown,
      sideData,
    },
    warning: Object.keys(summary).length < 3 ? "Incomplete summary data in DATA sheet" : null,
  };
}

function parseReservesSheet(workbook) {
  const sheetName = findSheet(workbook, "Reserves");
  if (!sheetName) return { data: null, warning: "Sheet 'Reserves' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const components = [];
  let totalTaxLiability = 0;

  const taxLabels = [
    "GAMING TAX ON WINNINGS", "GAMING TAX ON GGR", "GAMING LEVY",
    "GAMING TAX ON VIRTUAL GGR", "GAMING TAX ON CASINO GGR",
    "WHT VENDORS", "PAYE & SDL", "PAYE SDL"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const label = normalizeLabel(row[0]);
    if (!label) continue;

    for (const tl of taxLabels) {
      if (label.includes(tl) || label === tl) {
        const amount = parseNumeric(row[1]);
        components.push({ category: String(row[0]).trim(), amount });
        break;
      }
    }

    if (label.includes("TOTAL TAX LIABILITY") || label.includes("TOTAL TAX")) {
      totalTaxLiability = parseNumeric(row[1]);
    }
  }

  return {
    data: { totalTaxLiability, components },
    warning: components.length === 0 ? "No tax components found in Reserves sheet" : null,
  };
}

function parseReceiptsSheet(workbook) {
  // Note: sheet name has a leading space
  const sheetName = findSheet(workbook, "Receipts");
  if (!sheetName) return { data: null, warning: "Sheet 'Receipts' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  if (rows.length < 3) return { data: null, warning: "Receipts sheet has insufficient data" };

  // Row 0: month labels, Row 1: dates or headers, Row 2+: data
  const monthRow = rows[0];
  const headerRow = rows[1];
  const dailyData = [];
  const monthlyTotals = [];
  let inMonthlySection = false;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const label = normalizeLabel(row[0]);
    if (!label) continue;

    // Detect monthly totals section
    if (label.includes("MONTHLY") || label.includes("TOTAL")) {
      inMonthlySection = true;
    }

    if (inMonthlySection) {
      // Extract monthly totals per category
      const categoryTotals = { category: String(row[0]).trim() };
      for (let m = 0; m < 12; m++) {
        categoryTotals[MONTH_NAMES[m]] = parseNumeric(row[m + 1]);
      }
      monthlyTotals.push(categoryTotals);
    } else {
      // Daily data - collect category name and daily values
      const entry = { category: String(row[0]).trim(), values: [] };
      for (let c = 1; c < row.length && c <= 366; c++) {
        const val = parseNumeric(row[c]);
        if (val !== 0) {
          entry.values.push({ col: c, amount: val });
        }
      }
      if (entry.values.length > 0) {
        dailyData.push(entry);
      }
    }
  }

  return {
    data: { dailyData: dailyData.slice(0, 50), monthlyTotals },
    warning: null,
  };
}

function parseDisbursementsSheet(workbook) {
  const sheetName = findSheet(workbook, "Disbursements");
  if (!sheetName) return { data: null, warning: "Sheet 'Disbursements' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  if (rows.length < 3) return { data: null, warning: "Disbursements sheet has insufficient data" };

  const dailyData = [];
  const monthlyTotals = [];
  let inMonthlySection = false;

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const label = normalizeLabel(row[0]);
    if (!label) continue;

    if (label.includes("MONTHLY") || label.includes("TOTAL")) {
      inMonthlySection = true;
    }

    if (inMonthlySection) {
      const categoryTotals = { category: String(row[0]).trim() };
      for (let m = 0; m < 12; m++) {
        categoryTotals[MONTH_NAMES[m]] = parseNumeric(row[m + 1]);
      }
      monthlyTotals.push(categoryTotals);
    } else {
      const entry = { category: String(row[0]).trim(), values: [] };
      for (let c = 1; c < row.length && c <= 366; c++) {
        const val = parseNumeric(row[c]);
        if (val !== 0) {
          entry.values.push({ col: c, amount: val });
        }
      }
      if (entry.values.length > 0) {
        dailyData.push(entry);
      }
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
  let headerFound = false;
  let colMap = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const label = normalizeLabel(row[0]);

    // Find header row
    if (!headerFound && (label.includes("ACCOUNT") || label.includes("BANK"))) {
      for (let c = 0; c < row.length; c++) {
        const h = normalizeLabel(row[c]);
        if (h.includes("ACCOUNT")) colMap.account = c;
        if (h.includes("STATUS")) colMap.status = c;
        if (h.includes("OPENING")) colMap.opening = c;
        if (h.includes("RECEIVED") || h.includes("CASH RECEIVED")) colMap.received = c;
        if (h.includes("SPENT") || h.includes("CASH SPENT")) colMap.spent = c;
        if (h.includes("REVALUATION")) colMap.revaluation = c;
        if (h.includes("CLOSING") && h.includes("TZS")) colMap.closingTZS = c;
        if (h.includes("CLOSING") && (h.includes("FX") || h.includes("FOREIGN"))) colMap.closingFX = c;
        if (h.includes("CLOSING") && !h.includes("TZS") && !h.includes("FX") && !colMap.closingTZS) colMap.closingTZS = c;
      }
      headerFound = true;
      continue;
    }

    if (headerFound && row[colMap.account || 0]) {
      const accountName = String(row[colMap.account || 0]).trim();
      if (!accountName || normalizeLabel(accountName).includes("TOTAL")) continue;

      accounts.push({
        account: accountName,
        status: row[colMap.status] ? String(row[colMap.status]).trim() : "Active",
        openingBalance: parseNumeric(row[colMap.opening]),
        cashReceived: parseNumeric(row[colMap.received]),
        cashSpent: parseNumeric(row[colMap.spent]),
        revaluation: parseNumeric(row[colMap.revaluation]),
        closingBalanceTZS: parseNumeric(row[colMap.closingTZS]),
        closingBalanceFX: parseNumeric(row[colMap.closingFX]),
      });
    }
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

    const label = normalizeLabel(row[0]);
    if (!label) continue;

    // Detect sections
    if (label.includes("NET VENDOR") || label.includes("VENDOR PAYMENT")) {
      currentSection = "vendors";
      continue;
    }
    if (label.includes("RELATED PARTY")) {
      currentSection = "relatedParty";
      continue;
    }
    if (label.includes("TAX") && !label.includes("GAMING TAX ON")) {
      currentSection = "taxes";
      continue;
    }
    if (label.includes("TOP 5") || label.includes("TOP VENDOR")) {
      currentSection = "topVendors";
      continue;
    }

    // Parse rows based on section
    const entry = {
      label: String(row[0]).trim(),
      amount: parseNumeric(row[1]),
    };

    // Look for date in subsequent columns
    for (let c = 2; c < Math.min(row.length, 10); c++) {
      const cellVal = row[c];
      if (cellVal instanceof Date) {
        entry.date = cellVal.toISOString().split("T")[0];
        break;
      } else if (typeof cellVal === "string" && /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(cellVal)) {
        entry.date = cellVal;
        break;
      }
    }

    if (entry.amount !== 0) {
      switch (currentSection) {
        case "vendors": vendors.push(entry); break;
        case "relatedParty": relatedParty.push(entry); break;
        case "taxes": taxes.push(entry); break;
        case "topVendors": topVendors.push(entry); break;
      }
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

  // This sheet can be very wide - only parse 2026 columns
  // Find columns that correspond to 2026 dates
  const dailyClosingBalance = [];
  const headerRow = 0;

  // Read column headers to find 2026 dates
  const year2026Cols = [];
  for (let c = range.s.c; c <= Math.min(range.e.c, 2500); c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = sheet[cellAddr];
    if (!cell) continue;

    let dateVal = null;
    if (cell.t === "d" || cell.v instanceof Date) {
      dateVal = new Date(cell.v);
    } else if (cell.t === "n" && cell.v > 40000 && cell.v < 50000) {
      dateVal = XLSX.SSF.parse_date_code(cell.v);
      if (dateVal) {
        dateVal = new Date(dateVal.y, dateVal.m - 1, dateVal.d);
      }
    }

    if (dateVal && dateVal.getFullYear() === 2026) {
      year2026Cols.push({
        col: c,
        date: dateVal.toISOString().split("T")[0],
      });
    }
  }

  if (year2026Cols.length === 0) {
    return { data: null, warning: "No 2026 date columns found in CF Forecast sheet" };
  }

  // Find key rows: Opening Balance, Total Receipts, Total Disbursements, Closing Balance
  const keyRows = {};
  for (let r = 0; r <= Math.min(range.e.r, 50); r++) {
    const cellAddr = XLSX.utils.encode_cell({ r, c: 0 });
    const cell = sheet[cellAddr];
    if (!cell) continue;
    const label = normalizeLabel(cell.v);

    if (label.includes("OPENING BALANCE")) keyRows.openingBalance = r;
    if (label.includes("TOTAL RECEIPTS")) keyRows.totalReceipts = r;
    if (label.includes("TOTAL DISBURSEMENTS")) keyRows.totalDisbursements = r;
    if (label.includes("CLOSING BALANCE")) keyRows.closingBalance = r;
  }

  // Extract daily data for 2026
  const dailyData = [];
  for (const { col, date } of year2026Cols.slice(0, 100)) {
    const entry = { date };
    for (const [key, row] of Object.entries(keyRows)) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddr];
      entry[key] = cell ? parseNumeric(cell.v) : 0;
    }
    dailyData.push(entry);
  }

  return {
    data: dailyData,
    warning: null,
  };
}

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

  const receiptsResult = parseReceiptsSheet(workbook);
  if (receiptsResult.warning) warnings.push(receiptsResult.warning);

  const disbursementsResult = parseDisbursementsSheet(workbook);
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
