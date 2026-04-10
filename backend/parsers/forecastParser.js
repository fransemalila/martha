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

// Fuzzy match: check if label contains all key words from a pattern
function fuzzyMatch(label, pattern) {
  const normLabel = norm(label);
  const normPattern = norm(pattern);
  if (!normLabel || !normPattern) return false;
  // Exact contains
  if (normLabel.includes(normPattern)) return true;
  // All words match
  const words = normPattern.split(" ").filter((w) => w.length > 2);
  return words.length > 0 && words.every((w) => normLabel.includes(w));
}

function findSheet(workbook, name) {
  const n = norm(name);
  return workbook.SheetNames.find((s) => norm(s) === n)
    || workbook.SheetNames.find((s) => norm(s).includes(n))
    || workbook.SheetNames.find((s) => n.includes(norm(s)));
}

// Auto-detect which column has labels and which columns have numeric data
function detectLayout(rows, maxScanRows = 30) {
  let labelCol = -1;
  let dataStartCol = -1;
  let dataEndCol = -1;
  let headerRow = -1;

  // Find label column: the column with the most text strings
  const textCounts = {};
  const numCounts = {};
  for (let i = 0; i < Math.min(rows.length, maxScanRows); i++) {
    const row = rows[i];
    if (!row) continue;
    for (let c = 0; c < Math.min(row.length, 20); c++) {
      const cell = row[c];
      if (cell === null || cell === undefined) continue;
      if (typeof cell === "string" && cell.trim().length > 2) {
        textCounts[c] = (textCounts[c] || 0) + 1;
      }
      if (typeof cell === "number" || (typeof cell === "string" && /^-?[\d,]+\.?\d*$/.test(cell.replace(/\s/g, "")))) {
        numCounts[c] = (numCounts[c] || 0) + 1;
      }
    }
  }

  // Label column = column with most text entries (usually col 0 or 1)
  const textEntries = Object.entries(textCounts).sort((a, b) => b[1] - a[1]);
  if (textEntries.length > 0) {
    labelCol = parseInt(textEntries[0][0]);
  }

  // Data columns = columns with numeric entries after the label column
  const numEntries = Object.entries(numCounts)
    .map(([c, n]) => [parseInt(c), n])
    .filter(([c]) => c > labelCol)
    .sort((a, b) => a[0] - b[0]);

  if (numEntries.length > 0) {
    dataStartCol = numEntries[0][0];
    dataEndCol = numEntries[numEntries.length - 1][0];
  }

  // Find header row: look for month names or dates
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!row) continue;
    let monthHits = 0;
    let dateHits = 0;
    for (let c = Math.max(0, dataStartCol - 1); c < Math.min(row.length, 20); c++) {
      const cell = row[c];
      if (cell instanceof Date) dateHits++;
      if (typeof cell === "number" && cell > 40000 && cell < 50000) dateHits++;
      if (typeof cell === "string") {
        const u = cell.toUpperCase().trim();
        if (MONTH_NAMES.some((m) => u.startsWith(m.toUpperCase()))) monthHits++;
      }
    }
    if (monthHits >= 3 || dateHits >= 3) {
      headerRow = i;
      break;
    }
  }

  return { labelCol: Math.max(labelCol, 0), dataStartCol, dataEndCol, headerRow };
}

// Extract labeled rows: scan all rows and build a map of label -> values
function extractLabeledRows(rows, labelCol, dataStartCol, numCols) {
  const result = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const rawLabel = row[labelCol];
    if (!rawLabel || typeof rawLabel !== "string") continue;
    const label = rawLabel.trim();
    if (!label || label.length < 2) continue;

    const values = [];
    for (let c = dataStartCol; c < dataStartCol + numCols && c < row.length; c++) {
      values.push(parseNumeric(row[c]));
    }
    // Also grab a "total" column if it exists after the data columns
    const totalCol = dataStartCol + numCols;
    const yearTotal = totalCol < row.length ? parseNumeric(row[totalCol]) : values.reduce((a, b) => a + b, 0);

    // Handle duplicate labels by appending row index to avoid overwriting
    const key = result[label] ? `${label}__row${i}` : label;
    result[key] = { values, yearTotal, rowIndex: i, rawLabel: label };
  }
  return result;
}

// Match a category to a label using fuzzy matching
function findLabel(labeledRows, patterns) {
  if (!Array.isArray(patterns)) patterns = [patterns];
  for (const pattern of patterns) {
    // Try exact normalized match first
    for (const [label, data] of Object.entries(labeledRows)) {
      if (norm(label) === norm(pattern)) return data;
    }
    // Try fuzzy match
    for (const [label, data] of Object.entries(labeledRows)) {
      if (fuzzyMatch(label, pattern)) return data;
    }
  }
  return null;
}

function parseCFSheet(workbook) {
  const sheetName = findSheet(workbook, "CF FORECAST");
  if (!sheetName) return { data: null, warning: "Sheet 'CF FORECAST' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const warnings = [];

  const layout = detectLayout(rows);
  const labelCol = layout.labelCol;
  let dataStartCol = layout.dataStartCol >= 0 ? layout.dataStartCol : 2;
  let numCols = 12; // Jan-Dec

  // If we detected a header row, refine the data columns
  if (layout.headerRow >= 0) {
    const hRow = rows[layout.headerRow];
    let first = -1, last = -1, count = 0;
    for (let c = 0; c < hRow.length; c++) {
      const cell = hRow[c];
      const isDate = cell instanceof Date ||
        (typeof cell === "number" && cell > 40000 && cell < 50000) ||
        (typeof cell === "string" && MONTH_NAMES.some((m) => cell.toUpperCase().includes(m.toUpperCase())));
      if (isDate) {
        if (first === -1) first = c;
        last = c;
        count++;
      }
    }
    if (count >= 6) {
      dataStartCol = first;
      numCols = Math.min(count, 12);
    }
  }

  const dataStartRow = layout.headerRow >= 0 ? layout.headerRow + 1 : 0;
  const dataRows = rows.slice(dataStartRow);
  const labeledRows = extractLabeledRows(dataRows, labelCol, dataStartCol, numCols);

  // Define categories to match
  const categories = {
    beginningBalance: ["BEGINNING BALANCE", "OPENING BALANCE", "BEG BALANCE", "START BALANCE", "OPENING CASH IN BANK"],
    c2bMobile: ["C2B MOBILE MONEY", "C2B MOBILE MONEY TRANSFERS"],
    liquidationCall: ["LIQUIDATION OF CALL DEPOSIT", "LIQUIDATION CALL DEPOSIT"],
    interestIncome: ["INTEREST INCOME"],
    interestMNO: ["INTEREST INCOME MNO", "INTEREST INCOME - MNO COLLECTION"],
    otherIncome: ["OTHER INCOME"],
    unsecuredLoan: ["UNSECURED LOAN", "UNSECURED LOAN PEVANS"],
    cashDeposit: ["CASH DEPOSIT"],
    fixedDepositMaturity: ["FIXED DEPOSIT MATURITY"],
    totalReceipts: ["TOTAL RECEIPTS"],
    gamingTaxes: ["GAMING TAXES", "GAMING TAX"],
    businessLicence: ["BUSINESS LICENCE", "BUSINESS LICENSE"],
    vasUssd: ["VAS USSD", "VAS & USSD"],
    spsSportsoft: ["SPS SPORTSOFT"],
    bulkUssd: ["BULK USSD", "BULK,USSD"],
    totalDirectCosts: ["TOTAL DIRECT COSTS"],
    marketingCosts: ["MARKETING COSTS", "MARKETING"],
    agencyOpex: ["AGENCY OPEX"],
    socialMedia: ["SOCIAL MEDIA"],
    sponsorships: ["SPONSORSHIPS"],
    miscExpenses: ["MISCELLANEOUS"],
    donations: ["DONATIONS"],
    personnelCosts: ["PERSONNEL COSTS"],
    nssfContrib: ["NSSF"],
    wcfContrib: ["WCF"],
    payeSdl: ["PAYE", "PAYE & SDL"],
    heslb: ["HESLB"],
    staffCosts: ["STAFF COSTS"],
    staffTraining: ["STAFF TRAINING"],
    staffWelfare: ["STAFF WELFARE"],
    fxGainsLosses: ["FOREIGN EXCHANGE"],
    bankCharges: ["BANK CHARGES"],
    rentUtilities: ["RENT", "RENT & UTILITIES"],
    officeSupplies: ["OFFICE SUPPLIES"],
    legalFees: ["LEGAL", "LEGAL & PROFESSIONAL"],
    auditFees: ["AUDIT FEES"],
    totalOpex: ["TOTAL OPERATING EXPENSES", "TOTAL OPEX"],
    netCashFlow: ["NET CASH FLOW", "NET CASHFLOW"],
    closingBalance: ["CLOSING BALANCE", "CLOSING CASH IN BANK", "CLOSING BALANCE CASH IN BANK", "END BALANCE", "ENDING BALANCE", "ENDING CASH"],
  };

  const matched = {};
  for (const [key, patterns] of Object.entries(categories)) {
    const found = findLabel(labeledRows, patterns);
    if (found) {
      matched[key] = found;
    }
  }

  // Build monthly data
  const monthly = [];
  for (let m = 0; m < numCols; m++) {
    const monthData = { month: MONTH_NAMES[m] || `M${m + 1}` };
    for (const [key, item] of Object.entries(matched)) {
      monthData[key] = item.values[m] || 0;
    }
    monthly.push(monthData);
  }

  const yearTotals = {};
  for (const [key, item] of Object.entries(matched)) {
    yearTotals[key] = item.yearTotal;
  }

  if (Object.keys(matched).length < 3) {
    warnings.push(`Only matched ${Object.keys(matched).length} line items in CF FORECAST. Matched: ${Object.keys(matched).join(", ")}`);
  }

  return {
    data: { monthly, yearTotals, lineItems: Object.keys(matched) },
    warning: warnings.length > 0 ? warnings.join("; ") : null,
  };
}

function parseAnnualBudgetSheet(workbook) {
  const sheetName = findSheet(workbook, "ANNUAL BUDGET");
  if (!sheetName) return { data: null, warning: "Sheet 'ANNUAL BUDGET' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const layout = detectLayout(rows);
  const labelCol = layout.labelCol;
  const dataStartCol = layout.dataStartCol >= 0 ? layout.dataStartCol : 1;

  const result = {};
  const keyPatterns = [
    "DEPOSITS", "NET DEPOSITS", "TOTAL BET STAKES", "SPORTSBOOK",
    "CASINO", "VIRTUAL", "PAYOUTS", "TOTAL GGR", "GGR"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const label = norm(row[labelCol]);
    if (!label) continue;

    for (const key of keyPatterns) {
      if (label.includes(norm(key))) {
        const monthlyValues = [];
        for (let c = dataStartCol; c < dataStartCol + 12 && c < row.length; c++) {
          monthlyValues.push(parseNumeric(row[c]));
        }
        const quarterly = [];
        for (let c = dataStartCol + 14; c < dataStartCol + 18 && c < row.length; c++) {
          quarterly.push(parseNumeric(row[c]));
        }
        result[label] = { monthly: monthlyValues, quarterly };
        break;
      }
    }
  }

  return {
    data: Object.keys(result).length > 0 ? result : null,
    warning: Object.keys(result).length === 0 ? "No key rows found in ANNUAL BUDGET sheet" : null,
  };
}

// Parse "CF Forecast" sheet with DAILY columns — aggregate into monthly
function parseDailyCFSheet(workbook) {
  const sheetName = findSheet(workbook, "CF Forecast");
  if (!sheetName) return { data: null, warning: "Sheet 'CF Forecast' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const warnings = [];

  // Find the date row (has "DATE" in col0 and dates in subsequent columns)
  let dateRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    if (norm(row[0]) === "DATE" || norm(row[0]).includes("DATE")) {
      // Verify subsequent columns have dates
      let dateCnt = 0;
      for (let c = 1; c < Math.min(row.length, 20); c++) {
        const v = row[c];
        if (v instanceof Date || (typeof v === "string" && v.includes("T"))) dateCnt++;
        if (typeof v === "number" && v > 40000 && v < 55000) dateCnt++;
      }
      if (dateCnt >= 3) { dateRowIdx = i; break; }
    }
  }

  if (dateRowIdx === -1) return { data: null, warning: "No date row found in CF Forecast sheet" };

  const dateRow = rows[dateRowIdx];

  // Determine the target year (most recent year with data, or 2026)
  const yearCounts = {};
  for (let c = 1; c < dateRow.length; c++) {
    const d = parseDate(dateRow[c]);
    if (d) {
      const y = d.getFullYear();
      yearCounts[y] = (yearCounts[y] || 0) + 1;
    }
  }
  // Pick the latest year with significant data
  const targetYear = Object.keys(yearCounts)
    .map(Number)
    .filter((y) => yearCounts[y] >= 5)
    .sort((a, b) => b - a)[0] || 2026;

  // Build month-to-columns mapping for target year
  const monthColumns = {}; // { 0: [col5, col6, ...], 1: [...], ... }
  for (let c = 1; c < dateRow.length; c++) {
    const d = parseDate(dateRow[c]);
    if (d && d.getFullYear() === targetYear) {
      const month = d.getMonth();
      if (!monthColumns[month]) monthColumns[month] = [];
      monthColumns[month].push(c);
    }
  }

  if (Object.keys(monthColumns).length === 0) {
    return { data: null, warning: `No ${targetYear} date columns found in CF Forecast daily sheet` };
  }

  // Extract all labeled rows and aggregate daily values into monthly
  const categories = {
    beginningBalance: ["OPENING BALANCE", "BEGINNING BALANCE"],
    c2bMobile: ["C2B MOBILE", "C2B"],
    liquidationCall: ["LIQUIDATION OF CALL", "LIQUIDATION CALL"],
    interestIncome: ["INTEREST INCOME"],
    interestMNO: ["INTEREST EARNED ON MNO", "INTEREST MNO"],
    otherIncome: ["OTHER INCOME"],
    unsecuredLoan: ["UNSECURED LOAN"],
    cashDeposit: ["CASH DEPOSIT"],
    fixedDepositMaturity: ["FIXED DEPOSIT MATURITY"],
    totalReceipts: ["TOTAL RECEIPTS"],
    mpesa: ["MPESA", "M PESA"],
    tigoPesa: ["TIGO PESA", "TIGOPESA"],
    airtelMoney: ["AIRTEL MONEY"],
    airtelUssd: ["AIRTEL MONEY USSD", "AIRTEL MONEY-USSD PUSH"],
    halopesa: ["HALOPESA", "HALO PESA"],
    selcom: ["SELCOM"],
    unpaidOutgoing: ["UNPAID OUTGOING"],
    liquidationFixed: ["LIQUIDATION OF FIXED", "LIQUIDATION FIXED"],
    interestCall: ["INTEREST EARNED ON CALL", "INTEREST CALL"],
    interestFixed: ["INTEREST EARNED ON FIXED", "INTEREST FIXED"],
    accountToAccount: ["ACCOUNT TO ACCOUNT RECEIVED"],
    bankToBank: ["BANK TO BANK RECEIVED"],
    gamingTaxes: ["GAMING TAX ON WINNINGS", "GAMING TAXES"],
    gamingTaxGGR: ["GAMING TAX ON GGR"],
    gamingTaxVirtual: ["GAMING TAX ON VIRTUAL"],
    gamingTaxCasino: ["GAMING TAX ON CASINO"],
    gamingLevy: ["GAMING LEVY"],
    spsSportsoft: ["SPS SPORTSOFT"],
    totalDirectCosts: ["TOTAL DIRECT COSTS"],
    totalDisbursements: ["TOTAL DISBURSEMENTS"],
    personnelCosts: ["PERSONNEL COSTS", "PERSONNEL", "PAYROLL"],
    marketingCosts: ["MARKETING"],
    sponsorships: ["SPONSORSHIPS"],
    rentUtilities: ["RENT"],
    bankCharges: ["BANK CHARGES"],
    totalOpex: ["TOTAL OPERATING EXPENSES", "TOTAL OPEX"],
    netCashFlow: ["NET CASH FLOW", "NET CASHFLOW"],
    closingBalance: ["CLOSING BALANCE", "CLOSING BAL"],
  };

  const matched = {};

  for (let i = dateRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || typeof row[0] !== "string") continue;
    const rawLabel = row[0].trim();
    if (!rawLabel || rawLabel.length < 2) continue;

    // Find which category this row matches
    let matchedKey = null;
    for (const [key, patterns] of Object.entries(categories)) {
      if (matched[key]) continue; // Already matched
      for (const pattern of patterns) {
        if (fuzzyMatch(rawLabel, pattern)) {
          // Avoid "AIRTEL MONEY" matching "AIRTEL MONEY-USSD PUSH"
          if (norm(pattern) === "AIRTEL MONEY" && norm(rawLabel).includes("USSD")) continue;
          matchedKey = key;
          break;
        }
      }
      if (matchedKey) break;
    }

    if (!matchedKey) continue;

    // Aggregate daily values into monthly
    const monthlyValues = [];
    for (let m = 0; m < 12; m++) {
      const cols = monthColumns[m] || [];
      if (cols.length === 0) { monthlyValues.push(0); continue; }

      // For balances: take first/last day's value instead of summing
      if (matchedKey === "beginningBalance") {
        monthlyValues.push(parseNumeric(row[cols[0]]));
      } else if (matchedKey === "closingBalance") {
        monthlyValues.push(parseNumeric(row[cols[cols.length - 1]]));
      } else {
        let sum = 0;
        for (const c of cols) { sum += parseNumeric(row[c]); }
        monthlyValues.push(sum);
      }
    }

    matched[matchedKey] = {
      values: monthlyValues,
      yearTotal: monthlyValues.reduce((a, b) => a + b, 0),
      rawLabel,
    };
  }

  // Build monthly data array
  const monthly = [];
  for (let m = 0; m < 12; m++) {
    const monthData = { month: MONTH_NAMES[m] };
    for (const [key, item] of Object.entries(matched)) {
      monthData[key] = item.values[m] || 0;
    }
    monthly.push(monthData);
  }

  const yearTotals = {};
  for (const [key, item] of Object.entries(matched)) {
    yearTotals[key] = item.yearTotal;
  }

  if (Object.keys(matched).length < 3) {
    warnings.push(`Daily CF: only matched ${Object.keys(matched).length} items: ${Object.keys(matched).join(", ")}`);
  }

  return {
    data: { monthly, yearTotals, lineItems: Object.keys(matched) },
    warning: warnings.length > 0 ? warnings.join("; ") : null,
  };
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string" && val.includes("T")) return new Date(val);
  if (typeof val === "number" && val > 40000 && val < 55000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  return null;
}

function parseForecast(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetsFound = workbook.SheetNames;
  const warnings = [];

  // Try monthly CF FORECAST sheet first
  let cfResult = parseCFSheet(workbook);

  // If monthly sheet not found or empty, try daily CF Forecast sheet
  if (!cfResult.data || (cfResult.data.lineItems && cfResult.data.lineItems.length < 3)) {
    const dailyResult = parseDailyCFSheet(workbook);
    if (dailyResult.data && dailyResult.data.lineItems && dailyResult.data.lineItems.length > (cfResult.data?.lineItems?.length || 0)) {
      cfResult = dailyResult;
    }
  }
  if (cfResult.warning) warnings.push(cfResult.warning);

  const annualResult = parseAnnualBudgetSheet(workbook);
  if (annualResult.warning) warnings.push(annualResult.warning);

  const dataPoints =
    (cfResult.data?.monthly?.length || 0) * (cfResult.data?.lineItems?.length || 0) +
    Object.keys(annualResult.data || {}).length * 12;

  return {
    sheetsFound,
    warnings,
    dataPoints,
    parsedData: {
      monthly: cfResult.data?.monthly || [],
      yearTotals: cfResult.data?.yearTotals || {},
      annual: annualResult.data || {},
    },
  };
}

module.exports = { parseForecast };
