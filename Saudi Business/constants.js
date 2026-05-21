// ─── THEME ─────────────────────────────────────────────────────────────────
export const C = {
  gold:"#C8963E", dark:"#071209", panel:"#0D1F16", header:"#0A1910",
  forest:"#2D6A4F", cream:"#F5EDD6", muted:"#6B8F72", amber:"#E8C97A",
  rust:"#8B4513", mid:"#1A3A2A", sage:"#B8C9B0",
};
export const PALETTE  = [C.gold, C.mid, C.amber, C.rust, C.forest, "#F4A261"];
export const mono  = "'DM Mono', monospace";
export const serif = "'Playfair Display', serif";
export const sans  = "'DM Sans', sans-serif";
export const TT    = {
  contentStyle: {
    background:"#0A1910", border:"1px solid #C8963E44",
    borderRadius:8, color:C.cream, fontFamily:mono, fontSize:12,
  },
};
export const sarFmt = v => `SAR ${(v/1000).toFixed(1)}K`;

// ─── BASE DATA ──────────────────────────────────────────────────────────────
export const BASE_PRODUCTS = [
  { id:1, sku:"HP-001", name:"Hero Product A",    category:"Core",     priceMult:1.09, costMult:1.09, velocity:"High",   supplier:"Shenzhen Mfg Co.",    status:"Active"  },
  { id:2, sku:"PP-002", name:"Premium Product B", category:"Premium",  priceMult:2.31, costMult:2.31, velocity:"Medium", supplier:"Guangzhou Elite Ltd.", status:"Active"  },
  { id:3, sku:"VP-003", name:"Value Product C",   category:"Value",    priceMult:0.45, costMult:0.34, velocity:"High",   supplier:"Yiwu Trade Co.",      status:"Active"  },
  { id:4, sku:"BS-004", name:"Bundle Set D",      category:"Bundle",   priceMult:2.82, costMult:2.82, velocity:"Low",    supplier:"Foshan Goods Inc.",   status:"Active"  },
  { id:5, sku:"SP-005", name:"Seasonal E",        category:"Seasonal", priceMult:0.83, costMult:0.63, velocity:"Medium", supplier:"Hangzhou Intl Co.",   status:"Planned" },
  { id:6, sku:"UP-006", name:"Upsell Product F",  category:"Upsell",   priceMult:0.54, costMult:0.40, velocity:"Medium", supplier:"Ningbo Supply Ltd.",  status:"Planned" },
];

export const DEFAULT_OVERRIDES = {
  "HP-001": { name:"Hero Product A",    stock:450, moq:100, leadDays:35 },
  "PP-002": { name:"Premium Product B", stock:210, moq: 50, leadDays:42 },
  "VP-003": { name:"Value Product C",   stock:820, moq:200, leadDays:28 },
  "BS-004": { name:"Bundle Set D",      stock: 85, moq: 30, leadDays:45 },
  "SP-005": { name:"Seasonal E",        stock:310, moq:150, leadDays:38 },
  "UP-006": { name:"Upsell Product F",  stock:390, moq:120, leadDays:32 },
};

export const ALLOC_META = [
  { key:"inventory",   label:"Inventory (Initial Stock)", color:C.gold,    min:5,  max:70 },
  { key:"warehouse",   label:"Warehouse Setup & Ops",     color:C.mid,     min:2,  max:40 },
  { key:"tech",        label:"Tech & Website",            color:C.amber,   min:1,  max:25 },
  { key:"marketing",   label:"Marketing (Yr 1)",          color:C.rust,    min:2,  max:50 },
  { key:"salaries",    label:"Salaries (6 months)",       color:C.forest,  min:2,  max:40 },
  { key:"contingency", label:"Contingency & Legal",       color:"#F4A261", min:1,  max:30 },
];

export const DEFAULT_ALLOC = { inventory:35, warehouse:15, tech:8, marketing:18, salaries:12, contingency:12 };

export const BASE_UNITS = [0,19,49,92,135,190,233,276,331,378,438,510,564,622,679,741,801,872,936,1006,1077,1147,1218,1308];
export const BASE_OPEX  = [55,48,48,52,52,55,57,57,60,60,63,65,68,68,72,72,75,78,80,80,85,85,88,90].map(v=>v*1000);
export const MONTHS     = ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12","M13","M14","M15","M16","M17","M18","M19","M20","M21","M22","M23","M24"];

// ─── SCENARIO PRESETS ───────────────────────────────────────────────────────
export const PRESET_SCENARIOS = [
  {
    id:"conservative", name:"Conservative", color:"#64B5F6", badge:"🛡️",
    desc:"Capital-light, cash-preservation mode. Lower marketing spend, tighter margins managed through cost discipline.",
    inputs:{ investment:500000,  sellPrice:680,  productCost:306, reinvestRate:0.20 },
    alloc:{ inventory:40, warehouse:16, tech:7, marketing:14, salaries:13, contingency:10 },
  },
  {
    id:"base", name:"Base Case", color:C.gold, badge:"⚖️",
    desc:"Balanced growth with moderate reinvestment. The default model — sustainable unit economics and steady market penetration.",
    inputs:{ investment:1000000, sellPrice:780,  productCost:312, reinvestRate:0.40 },
    alloc:{ inventory:35, warehouse:15, tech:8, marketing:18, salaries:12, contingency:12 },
  },
  {
    id:"aggressive", name:"Aggressive",  color:"#F44336", badge:"🚀",
    desc:"High capital deployment with outsized marketing. Faster breakeven through volume; requires strong cash management.",
    inputs:{ investment:2000000, sellPrice:920,  productCost:331, reinvestRate:0.60 },
    alloc:{ inventory:30, warehouse:12, tech:10, marketing:28, salaries:12, contingency:8 },
  },
];

export const SERVICE_LEVELS = [
  { label:"85%",   zScore:1.04, desc:"Basic – low stockout protection" },
  { label:"90%",   zScore:1.28, desc:"Standard – moderate protection" },
  { label:"95%",   zScore:1.65, desc:"Good – recommended for most SKUs" },
  { label:"97.5%", zScore:1.96, desc:"High – seasonal / hero products" },
  { label:"99%",   zScore:2.33, desc:"Very High – premium / critical SKUs" },
];
