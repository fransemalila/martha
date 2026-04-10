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
  return String(label).toUpperCase().replace(/[^A-Z0-9&/() ]/g, " ").replace(/\s+/g, " ").trim();
}

function findSheetCaseInsensitive(workbook, name) {
  const upper = name.toUpperCase().trim();
  return workbook.SheetNames.find(
    (s) => s.toUpperCase().trim() === upper
  );
}

function parseCFSheet(workbook) {
  const sheetName = findSheetCaseInsensitive(workbook, "CF FORECAST 2026");
  if (!sheetName) return { data: null, warning: "Sheet 'CF FORECAST 2026' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const warnings = [];
  const monthly = [];

  // Find the header row with months (look for date serials or month names)
  let headerRowIdx = -1;
  let dataColStart = 2; // Col C = index 2
  let dataColEnd = 13;  // Col N = index 13

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    // Check if this row has date serials or month-like content in cols C-N
    let dateCount = 0;
    for (let c = 2; c <= 13; c++) {
      const cell = row[c];
      if (cell instanceof Date || (typeof cell === "number" && cell > 40000 && cell < 50000)) {
        dateCount++;
      }
    }
    if (dateCount >= 6) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Try to find by looking for "JAN" or "JANUARY" text
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      if (!row) continue;
      for (let c = 2; c <= 5; c++) {
        const cell = normalizeLabel(row[c]);
        if (cell.includes("JAN")) {
          headerRowIdx = i;
          break;
        }
      }
      if (headerRowIdx !== -1) break;
    }
  }

  // Define the line items we're looking for
  const lineItemMap = {};
  const categories = {
    beginningBalance: ["BEGINNING BALANCE", "CASH IN BANK"],
    c2bMobile: ["C2B MOBILE MONEY TRANSFERS"],
    liquidationCall: ["LIQUIDATION OF CALL DEPOSIT"],
    interestIncome: ["INTEREST INCOME"],
    interestMNO: ["INTEREST INCOME MNO COLLECTION", "INTEREST INCOME - MNO COLLECTION"],
    otherIncome: ["OTHER INCOME"],
    unsecuredLoan: ["UNSECURED LOAN PEVANS EA", "UNSECURED LOAN-PEVANS EA"],
    cashDeposit: ["CASH DEPOSIT"],
    fixedDepositMaturity: ["FIXED DEPOSIT MATURITY"],
    totalReceipts: ["TOTAL RECEIPTS"],
    gamingTaxes: ["GAMING TAXES"],
    businessLicence: ["BUSINESS LICENCE FEES"],
    vasUssd: ["VAS & USSD ANNUAL FEES", "VAS USSD ANNUAL FEES"],
    spsSportsoft: ["SPS SPORTSOFT LIMITED", "SPS SPORTSOFT LTD"],
    bulkUssd: ["BULK USSD SPONSORED DATA", "BULK,USSD &SPONSORED DATA", "BULK USSD &SPONSORED DATA"],
    totalDirectCosts: ["TOTAL DIRECT COSTS"],
    marketingCosts: ["MARKETING COSTS"],
    agencyOpex: ["AGENCY OPEX"],
    socialMedia: ["SOCIAL MEDIA ACCOUNT COST"],
    sponsorships: ["SPONSORSHIPS"],
    miscExpenses: ["MISCELLANEOUS EXPENSES"],
    donations: ["DONATIONS"],
    personnelCosts: ["PERSONNEL COSTS"],
    nssfContrib: ["NSSF CONTRIBUTION"],
    wcfContrib: ["WCF CONTRIBUTION"],
    payeSdl: ["PAYE & SDL", "PAYE SDL"],
    heslb: ["HESLB"],
    staffCosts: ["STAFF COSTS"],
    staffTraining: ["STAFF TRAINING"],
    staffWelfare: ["STAFF WELFARE"],
    fxGainsLosses: ["FOREIGN EXCHANGE GAINS LOSSES", "FOREIGN EXCHANGE GAINS/LOSSES"],
    bankCharges: ["BANK CHARGES"],
    rentUtilities: ["RENT & UTILITIES", "RENT UTILITIES"],
    officeSupplies: ["OFFICE SUPPLIES"],
    legalFees: ["LEGAL & PROFESSIONAL FEES", "LEGAL PROFESSIONAL FEES"],
    auditFees: ["AUDIT FEES"],
    totalOpex: ["TOTAL OPERATING EXPENSES"],
    netCashFlow: ["NET CASH FLOW"],
    closingBalance: ["CLOSING BALANCE", "CLOSING BALANCE CASH IN BANK"],
  };

  // Scan all rows and match labels
  const dataStartRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 3;
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // Label is typically in column B (index 1), sometimes column A (index 0)
    let label = normalizeLabel(row[1]) || normalizeLabel(row[0]);
    if (!label) continue;

    for (const [key, patterns] of Object.entries(categories)) {
      for (const pattern of patterns) {
        if (label.includes(pattern) || label === pattern) {
          if (!lineItemMap[key]) {
            const values = [];
            for (let c = dataColStart; c <= dataColEnd; c++) {
              values.push(parseNumeric(row[c]));
            }
            const yearTotal = parseNumeric(row[14]); // Col O
            lineItemMap[key] = { values, yearTotal, label: String(row[1] || row[0]).trim() };
          }
          break;
        }
      }
    }
  }

  // Build monthly data
  for (let m = 0; m < 12; m++) {
    const monthData = { month: MONTH_NAMES[m] };
    for (const [key, item] of Object.entries(lineItemMap)) {
      monthData[key] = item.values[m] || 0;
    }
    monthly.push(monthData);
  }

  // Build year totals
  const yearTotals = {};
  for (const [key, item] of Object.entries(lineItemMap)) {
    yearTotals[key] = item.yearTotal || item.values.reduce((a, b) => a + b, 0);
  }

  return {
    data: { monthly, yearTotals, lineItems: Object.keys(lineItemMap) },
    warning: Object.keys(lineItemMap).length < 5
      ? "Only " + Object.keys(lineItemMap).length + " line items matched in CF FORECAST sheet"
      : null,
  };
}

function parseAnnualBudgetSheet(workbook) {
  const sheetName = findSheetCaseInsensitive(workbook, "ANNUAL BUDGET 2026");
  if (!sheetName) return { data: null, warning: "Sheet 'ANNUAL BUDGET 2026' not found" };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const result = {};
  const keyRows = [
    "DEPOSITS", "NET DEPOSITS", "TOTAL BET STAKES", "SPORTSBOOK",
    "CASINO", "VIRTUAL", "PAYOUTS", "TOTAL GGR", "GGR"
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const label = normalizeLabel(row[0]);
    if (!label) continue;

    for (const key of keyRows) {
      if (label.includes(key)) {
        const monthlyValues = [];
        for (let c = 1; c <= 12; c++) {
          monthlyValues.push(parseNumeric(row[c]));
        }
        const quarterly = [];
        for (let c = 15; c <= 18; c++) {
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

function parseForecast(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const sheetsFound = workbook.SheetNames;
  const warnings = [];

  const cfResult = parseCFSheet(workbook);
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
