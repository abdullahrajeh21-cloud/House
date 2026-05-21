/**
 * exportToCSV
 * -----------
 * @param {string}   filename  - e.g. "financial_model.csv"
 * @param {Array}    columns   - [{ label: "Month", key: "month", format?: fn }]
 * @param {Array}    rows      - array of data objects
 *
 * Triggers a browser download of the generated CSV.
 */
export function exportToCSV(filename, columns, rows) {
  const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const headerRow = columns.map(c => escape(c.label)).join(",");

  const dataRows = rows.map(row =>
    columns.map(c => {
      const raw = row[c.key];
      const val = typeof c.format === "function" ? c.format(raw, row) : raw;
      return escape(val ?? "");
    }).join(",")
  );

  const csv  = [headerRow, ...dataRows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── COLUMN PRESETS ─────────────────────────────────────────────────────────
export const FINANCIAL_COLS = [
  { label:"Month",         key:"month" },
  { label:"Units Sold",    key:"units" },
  { label:"Revenue (SAR)", key:"revenue",  format:v => v.toFixed(0) },
  { label:"COGS (SAR)",    key:"cogs",     format:v => v.toFixed(0) },
  { label:"OpEx (SAR)",    key:"opex",     format:v => v.toFixed(0) },
  { label:"Net Profit",    key:"profit",   format:v => v.toFixed(0) },
  { label:"Customers",     key:"customers" },
  { label:"Inv. Value",    key:"inventory", format:v => v.toFixed(0) },
];

export const CASHFLOW_COLS = [
  { label:"Month",          key:"month" },
  { label:"Cash In (SAR)",  key:"cashIn",        format:v => v.toFixed(0) },
  { label:"Inv. Orders",    key:"invOrder",       format:v => v.toFixed(0) },
  { label:"OpEx",           key:"opex",           format:v => v.toFixed(0) },
  { label:"Setup Spend",    key:"setupSpend",     format:v => v.toFixed(0) },
  { label:"Reinvest (Inv)", key:"reinvInvStock",  format:v => v.toFixed(0) },
  { label:"Total Cash Out", key:"cashOut",        format:v => v.toFixed(0) },
  { label:"Net Flow",       key:"netCashFlow",    format:v => v.toFixed(0) },
  { label:"Cum. Balance",   key:"cumulativeCash", format:v => v.toFixed(0) },
];

export const SAFETY_COLS = [
  { label:"SKU",           key:"sku" },
  { label:"Product",       key:"name" },
  { label:"Velocity",      key:"velocity" },
  { label:"Avg Daily (u)", key:"avgDaily",    format:v => v.toFixed(3) },
  { label:"Lead Days",     key:"leadDays" },
  { label:"Safety Stock",  key:"ss" },
  { label:"Reorder Point", key:"rop" },
  { label:"Max Stock",     key:"maxStock" },
  { label:"Current Stock", key:"stock" },
  { label:"EOQ",           key:"eoq" },
  { label:"Status",        key:"status" },
];

export const CF90_COLS = [
  { label:"Week",       key:"week" },
  { label:"Revenue",    key:"revenue",    format:v => v.toFixed(0) },
  { label:"PO Deposit", key:"poDeposit",  format:v => v.toFixed(0) },
  { label:"PO Balance", key:"poBalance",  format:v => v.toFixed(0) },
  { label:"OpEx",       key:"opex",       format:v => v.toFixed(0) },
  { label:"Planned",    key:"planned",    format:v => v.toFixed(0) },
  { label:"Total Out",  key:"totalOut",   format:v => v.toFixed(0) },
  { label:"Net Flow",   key:"netFlow",    format:v => v.toFixed(0) },
  { label:"Cash Bal.",  key:"cashBalance",format:v => v.toFixed(0) },
];
