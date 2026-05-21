// ══════════════════════════════════════════════════════════════════════════════
// SAUDI E-COMMERCE VENTURE SIMULATOR  ·  v2.0
// ══════════════════════════════════════════════════════════════════════════════
// Modular source files (for your own project) are in:
//   src/constants.js          → theme tokens, base data, scenario presets
//   src/data/models.js        → buildFinancials (tiered reinvest), EOQ, safety stock
//   src/utils/csvExport.js    → exportToCSV + column presets
//   src/components/ui.jsx     → KPICard, SectionTitle, EditableCell, ExportButton
//   src/components/InputPanel.jsx / BudgetEditor.jsx
//   src/tabs/*.jsx            → one component per tab
// ══════════════════════════════════════════════════════════════════════════════
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = { gold:"#C8963E", dark:"#071209", panel:"#0D1F16", header:"#0A1910", forest:"#2D6A4F", cream:"#F5EDD6", muted:"#6B8F72", amber:"#E8C97A", rust:"#8B4513", mid:"#1A3A2A", sage:"#B8C9B0" };
const PALETTE = [C.gold, C.mid, C.amber, C.rust, C.forest, "#F4A261"];
const mono = "'DM Mono', monospace", serif = "'Playfair Display', serif", sans = "'DM Sans', sans-serif";
const TT = { contentStyle:{ background:"#0A1910", border:"1px solid #C8963E44", borderRadius:8, color:C.cream, fontFamily:mono, fontSize:12 } };
const sarFmt = v => `SAR ${(v/1000).toFixed(1)}K`;

// ─── BASE DATA ────────────────────────────────────────────────────────────────
const BASE_PRODUCTS = [
  { id:1, sku:"HP-001", name:"Hero Product A",    category:"Core",     priceMult:1.09, costMult:1.09, velocity:"High",   supplier:"Shenzhen Mfg Co.",    status:"Active"  },
  { id:2, sku:"PP-002", name:"Premium Product B", category:"Premium",  priceMult:2.31, costMult:2.31, velocity:"Medium", supplier:"Guangzhou Elite Ltd.", status:"Active"  },
  { id:3, sku:"VP-003", name:"Value Product C",   category:"Value",    priceMult:0.45, costMult:0.34, velocity:"High",   supplier:"Yiwu Trade Co.",      status:"Active"  },
  { id:4, sku:"BS-004", name:"Bundle Set D",      category:"Bundle",   priceMult:2.82, costMult:2.82, velocity:"Low",    supplier:"Foshan Goods Inc.",   status:"Active"  },
  { id:5, sku:"SP-005", name:"Seasonal E",        category:"Seasonal", priceMult:0.83, costMult:0.63, velocity:"Medium", supplier:"Hangzhou Intl Co.",   status:"Planned" },
  { id:6, sku:"UP-006", name:"Upsell Product F",  category:"Upsell",   priceMult:0.54, costMult:0.40, velocity:"Medium", supplier:"Ningbo Supply Ltd.",  status:"Planned" },
];
const DEFAULT_OVERRIDES = {
  "HP-001":{ name:"Hero Product A",    stock:450, moq:100, leadDays:35 },
  "PP-002":{ name:"Premium Product B", stock:210, moq: 50, leadDays:42 },
  "VP-003":{ name:"Value Product C",   stock:820, moq:200, leadDays:28 },
  "BS-004":{ name:"Bundle Set D",      stock: 85, moq: 30, leadDays:45 },
  "SP-005":{ name:"Seasonal E",        stock:310, moq:150, leadDays:38 },
  "UP-006":{ name:"Upsell Product F",  stock:390, moq:120, leadDays:32 },
};
const ALLOC_META = [
  { key:"inventory",   label:"Inventory (Initial Stock)", color:C.gold,    min:5,  max:70 },
  { key:"warehouse",   label:"Warehouse Setup & Ops",     color:C.mid,     min:2,  max:40 },
  { key:"tech",        label:"Tech & Website",            color:C.amber,   min:1,  max:25 },
  { key:"marketing",   label:"Marketing (Yr 1)",          color:C.rust,    min:2,  max:50 },
  { key:"salaries",    label:"Salaries (6 months)",       color:C.forest,  min:2,  max:40 },
  { key:"contingency", label:"Contingency & Legal",       color:"#F4A261", min:1,  max:30 },
];
const DEFAULT_ALLOC = { inventory:35, warehouse:15, tech:8, marketing:18, salaries:12, contingency:12 };
const BASE_UNITS = [0,19,49,92,135,190,233,276,331,378,438,510,564,622,679,741,801,872,936,1006,1077,1147,1218,1308];
const BASE_OPEX  = [55,48,48,52,52,55,57,57,60,60,63,65,68,68,72,72,75,78,80,80,85,85,88,90].map(v=>v*1000);
const MONTHS     = ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12","M13","M14","M15","M16","M17","M18","M19","M20","M21","M22","M23","M24"];
const SERVICE_LEVELS = [
  { label:"85%",   zScore:1.04, desc:"Basic – low stockout protection" },
  { label:"90%",   zScore:1.28, desc:"Standard – moderate protection" },
  { label:"95%",   zScore:1.65, desc:"Good – recommended for most SKUs" },
  { label:"97.5%", zScore:1.96, desc:"High – seasonal / hero products" },
  { label:"99%",   zScore:2.33, desc:"Very High – premium / critical SKUs" },
];

// ─── SCENARIO PRESETS ─────────────────────────────────────────────────────────
const PRESET_SCENARIOS = [
  { id:"conservative", name:"Conservative", color:"#64B5F6", badge:"🛡️", desc:"Capital-light, cash-preservation mode. Lower marketing spend, tighter margins managed through cost discipline.",
    inputs:{ investment:500000,  sellPrice:680, productCost:306, reinvestRate:0.20 },
    alloc:{ inventory:40, warehouse:16, tech:7, marketing:14, salaries:13, contingency:10 } },
  { id:"base",         name:"Base Case",    color:C.gold,    badge:"⚖️", desc:"Balanced growth with moderate reinvestment. Sustainable unit economics and steady market penetration.",
    inputs:{ investment:1000000, sellPrice:780, productCost:312, reinvestRate:0.40 },
    alloc:{ ...DEFAULT_ALLOC } },
  { id:"aggressive",   name:"Aggressive",  color:"#F44336", badge:"🚀", desc:"High capital deployment with outsized marketing. Faster breakeven through volume — requires strong cash management.",
    inputs:{ investment:2000000, sellPrice:920, productCost:331, reinvestRate:0.60 },
    alloc:{ inventory:30, warehouse:12, tech:10, marketing:28, salaries:12, contingency:8 } },
];

// ─── DATA MODEL FUNCTIONS ─────────────────────────────────────────────────────

function buildBudget(investment, alloc) {
  return ALLOC_META.map(m => ({ name:m.label, key:m.key, pct:alloc[m.key], value:Math.round(investment*alloc[m.key]/100), color:m.color }));
}

function changeAlloc(alloc, key, rawVal) {
  const clamped  = Math.max(1, Math.min(90, rawVal));
  const others   = ALLOC_META.map(m => m.key).filter(k => k !== key);
  const otherSum = others.reduce((s, k) => s + alloc[k], 0);
  const needed   = 100 - clamped;
  const next     = { ...alloc, [key]: clamped };
  if (otherSum === 0) { const each = needed / others.length; others.forEach(k => (next[k] = parseFloat(each.toFixed(1)))); }
  else { others.forEach(k => (next[k] = parseFloat(((alloc[k]/otherSum)*needed).toFixed(1)))); }
  const drift = parseFloat((100 - Object.values(next).reduce((s,v)=>s+v,0)).toFixed(1));
  if (drift !== 0) next[others[others.length-1]] = parseFloat((Math.max(0, next[others[others.length-1]]+drift)).toFixed(1));
  return next;
}

// Tiered reinvestment: reward high-margin products, protect cash when thin
function getEffectiveReinvestRate(base, sellPrice, productCost) {
  if (sellPrice <= 0) return base;
  const gm = (sellPrice - productCost) / sellPrice;
  if (gm >= 0.60) return Math.min(0.85, base * 1.20);
  if (gm >= 0.40) return base;
  return base * 0.60;
}
function reinvestTierLabel(sellPrice, productCost) {
  const gm = sellPrice > 0 ? (sellPrice - productCost) / sellPrice : 0;
  if (gm >= 0.60) return { label:"High-Margin Boost (+20%)", color:"#4CAF50" };
  if (gm >= 0.40) return { label:"Standard Rate",             color:C.amber   };
  return                 { label:"Cash Conservation (−40%)", color:"#F44336" };
}

function buildFinancials(investment, sellPrice, productCost, alloc, baseReinvest = 0.40) {
  const scale      = Math.pow(investment / 1e6, 0.85);
  const opScale    = Math.pow(investment / 1e6, 0.50);
  const invBudget  = investment * alloc.inventory / 100;
  const setupTotal = investment * (alloc.warehouse + alloc.tech + alloc.contingency) / 100;
  const reinvRate  = getEffectiveReinvestRate(baseReinvest, sellPrice, productCost);
  let inventoryValue = invBudget, cumulativeCash = investment, cumUnits = 0;

  return MONTHS.map((month, i) => {
    const units   = Math.round(BASE_UNITS[i] * scale);
    const revenue = units * sellPrice;
    const cogs    = units * productCost;
    const opex    = Math.round(BASE_OPEX[i] * opScale);
    const profit  = revenue - cogs - opex;
    cumUnits     += units;
    const cashIn     = revenue;
    const setupSpend = i===0 ? Math.round(setupTotal*0.65) : i===1 ? Math.round(setupTotal*0.35) : 0;
    let invOrder = 0;
    if      (i===0)     invOrder = Math.round(invBudget*0.30);
    else if (i===1)     invOrder = Math.round(invBudget*0.70);
    else if (i%2===0)   invOrder = Math.round(units*2.5*productCost);
    const reinvest      = profit > 0 ? Math.round(profit * reinvRate) : 0;
    const reinvInvStock = Math.round(reinvest * 0.60);
    const reinvMkt      = Math.round(reinvest * 0.40);
    const cashOut       = opex + invOrder + setupSpend + reinvInvStock;
    const netCashFlow   = cashIn - cashOut;
    cumulativeCash     += netCashFlow;
    inventoryValue      = Math.max(invBudget*0.35, inventoryValue - cogs + invOrder + reinvInvStock);
    return {
      month, units, revenue, cogs, opex, profit,
      inventory:Math.round(inventoryValue), customers:Math.round(cumUnits*0.65),
      cashIn, setupSpend, invOrder, reinvest, reinvInvStock, reinvMarketing:reinvMkt,
      cashOut:Math.round(cashOut), netCashFlow:Math.round(netCashFlow), cumulativeCash:Math.round(cumulativeCash),
      effectiveReinvRate: reinvRate,
    };
  });
}

// Safety stock:  SS = Z × √(LT×σd² + d²×σLT²)
function calcSS(d, sigmaD, lt, sigmaLT, z) {
  return Math.ceil(z * Math.sqrt(lt * sigmaD**2 + d**2 * sigmaLT**2));
}
function calcROP(d, lt, ss)    { return Math.ceil(d * lt + ss); }
// EOQ = √(2DS/H)
function calcEOQ(D, S, H)      { return H > 0 && S > 0 ? Math.ceil(Math.sqrt((2*D*S)/H)) : 0; }
function calcInvCosts(D, eoq, S, H) {
  if (eoq <= 0) return { annualOrdering:0, annualHolding:0, total:0, ordersPerYear:0, cycleDays:0 };
  return {
    annualOrdering: Math.round((D/eoq)*S),
    annualHolding:  Math.round((eoq/2)*H),
    total:          Math.round((D/eoq)*S + (eoq/2)*H),
    ordersPerYear:  parseFloat((D/eoq).toFixed(1)),
    cycleDays:      D > 0 ? Math.round((eoq/D)*365) : 0,
  };
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
function exportToCSV(filename, columns, rows) {
  const esc   = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const header = columns.map(c => esc(c.label)).join(",");
  const body   = rows.map(r => columns.map(c => esc(typeof c.fmt === "function" ? c.fmt(r[c.key], r) : (r[c.key] ?? ""))).join(","));
  const blob   = new Blob(["\uFEFF" + [header, ...body].join("\n")], { type:"text/csv;charset=utf-8;" });
  const url    = URL.createObjectURL(blob);
  const a      = Object.assign(document.createElement("a"), { href:url, download:filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, accent=C.gold }) => (
  <div style={{ background:C.panel, border:`1px solid ${accent}33`, borderRadius:12, padding:"18px 22px", minWidth:148, flex:1 }}>
    <div style={{ color:accent, fontSize:10, fontFamily:mono, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>{label}</div>
    <div style={{ color:C.cream, fontSize:22, fontWeight:700, fontFamily:serif, lineHeight:1 }}>{value}</div>
    {sub && <div style={{ color:C.muted, fontSize:11, marginTop:5, fontFamily:mono }}>{sub}</div>}
  </div>
);
const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom:22 }}>
    <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:3, textTransform:"uppercase", marginBottom:5 }}>● {sub}</div>
    <div style={{ color:C.cream, fontSize:26, fontWeight:700, fontFamily:serif }}>{title}</div>
  </div>
);
const ExportButton = ({ onClick }) => (
  <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:`1px solid ${C.forest}66`, borderRadius:8, padding:"6px 14px", cursor:"pointer", color:C.sage, fontSize:11, fontFamily:mono }}>
    ⬇ Export CSV
  </button>
);
function EditableCell({ value, type="number", min, max, step=1, unit="", onSave, accent=C.amber, width=72 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => {
    const v = type==="text" ? (String(draft).trim()||String(value)) : Math.max(min, Math.min(max, Number(draft)||min));
    onSave(v); setDraft(v); setEditing(false);
  };
  if (editing) return (
    <td style={{ padding:"4px 8px" }} onClick={e=>e.stopPropagation()}>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <input ref={ref} type={type} min={min} max={max} step={step} value={draft}
          onChange={e=>setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e=>{ if(e.key==="Enter")commit(); if(e.key==="Escape"){setDraft(value);setEditing(false);} }}
          style={{ background:C.panel, border:`1px solid ${accent}`, borderRadius:6, color:accent, padding:"4px 8px", fontSize:12, fontFamily:type==="text"?sans:mono, fontWeight:600, width, outline:"none" }} autoFocus />
        {unit && <span style={{ color:C.muted, fontSize:10, fontFamily:mono }}>{unit}</span>}
      </div>
    </td>
  );
  return (
    <td onClick={e=>{e.stopPropagation();setDraft(value);setEditing(true);}} style={{ padding:"11px 12px", cursor:"text" }} title="Click to edit">
      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ color:type==="text"?C.cream:accent, fontWeight:600, fontFamily:type==="text"?sans:mono, fontSize:13 }}>{type==="text"?value:value.toLocaleString()}{unit}</span>
        <span style={{ color:accent, fontSize:9, opacity:0.55 }}>✎</span>
      </div>
    </td>
  );
}
function StockCoverageBar({ stock, velocity, leadDays }) {
  const r = velocity==="High"?80:velocity==="Medium"?40:15;
  const wk = (stock/r)*4.3, lw = leadDays/7, sb = lw*1.3;
  const st = wk<sb?"critical":wk<sb*2?"warning":"healthy";
  const col = { critical:"#F44336", warning:C.amber, healthy:"#4CAF50" };
  const lbl = { critical:"Reorder Now", warning:"Reorder Soon", healthy:"Healthy Stock" };
  return (
    <div style={{ padding:"12px 16px", background:C.dark, borderRadius:10, border:`1px solid ${col[st]}33` }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ color:C.muted, fontSize:10, fontFamily:mono }}>STOCK COVERAGE</span>
        <span style={{ color:col[st], fontSize:10, fontFamily:mono, fontWeight:700 }}>{lbl[st]}</span>
      </div>
      <div style={{ height:6, background:C.mid, borderRadius:3, marginBottom:6 }}>
        <div style={{ height:6, background:col[st], borderRadius:3, width:`${Math.min(100,(wk/16)*100)}%`, transition:"width 0.35s" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:C.sage, fontSize:11 }}>{wk.toFixed(1)} weeks of stock</span>
        <span style={{ color:C.muted, fontSize:11 }}>Lead: {leadDays}d ({lw.toFixed(1)} wks)</span>
      </div>
      <div style={{ color:C.muted, fontSize:10, fontFamily:mono, marginTop:4 }}>
        Reorder ~{Math.round(r*(leadDays/30)*1.3)} units · Selling ~{r} units/mo
      </div>
    </div>
  );
}

// ─── INPUT PANEL ──────────────────────────────────────────────────────────────
function InputPanel({ inputs, onInput, reinvestRate, onReinvest }) {
  const { investment, sellPrice, productCost } = inputs;
  const margin  = sellPrice > 0 ? (((sellPrice-productCost)/sellPrice)*100).toFixed(1) : 0;
  const mColor  = margin >= 60 ? "#4CAF50" : margin >= 40 ? C.amber : "#F4A261";
  const tier    = reinvestTierLabel(sellPrice, productCost);
  const effRate = (getEffectiveReinvestRate(reinvestRate, sellPrice, productCost)*100).toFixed(0);
  const Field = ({ label, k, min, max, step }) => (
    <div style={{ display:"flex", flexDirection:"column", gap:5, minWidth:175 }}>
      <label style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, textTransform:"uppercase" }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid ${C.gold}44`, borderRadius:8, overflow:"hidden" }}>
        <span style={{ color:C.gold, padding:"7px 10px", fontSize:12, fontFamily:mono, background:"#0D1F16", borderRight:`1px solid ${C.gold}22` }}>SAR</span>
        <input type="number" min={min} max={max} step={step} value={inputs[k]}
          onChange={e=>onInput(k, Number(e.target.value))}
          style={{ background:"transparent", border:"none", outline:"none", color:C.cream, padding:"7px 12px", fontSize:13, fontFamily:mono, fontWeight:600, width:"100%" }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={inputs[k]}
        onChange={e=>onInput(k, Number(e.target.value))} style={{ accentColor:C.gold, cursor:"pointer" }} />
      <div style={{ display:"flex", justifyContent:"space-between", color:C.muted, fontSize:9, fontFamily:mono }}>
        <span>{(min/1000).toFixed(0)}K</span><span>{(max/1000).toFixed(0)}K</span>
      </div>
    </div>
  );
  return (
    <div style={{ background:"#091510", borderBottom:`1px solid ${C.gold}22`, padding:"14px 32px" }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:28, alignItems:"flex-end" }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, alignSelf:"center", paddingBottom:14 }}>⚙ SIMULATOR<br/>INPUTS</div>
        <Field label="Initial Investment" k="investment"  min={200000}  max={5000000} step={50000} />
        <Field label="Avg Selling Price"  k="sellPrice"   min={100}     max={5000}    step={50} />
        <Field label="Avg Product Cost"   k="productCost" min={50}      max={4000}    step={25} />
        <div style={{ display:"flex", flexDirection:"column", gap:5, minWidth:185 }}>
          <label style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, textTransform:"uppercase" }}>Base Reinvest Rate</label>
          <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid #4CAF5044`, borderRadius:8, overflow:"hidden" }}>
            <span style={{ color:"#4CAF50", padding:"7px 10px", fontSize:12, fontFamily:mono, background:"#0D1F16", borderRight:"1px solid #4CAF5022" }}>%</span>
            <input type="number" min={0} max={90} step={5} value={Math.round(reinvestRate*100)}
              onChange={e=>onReinvest(Math.min(0.9,Math.max(0,Number(e.target.value)/100)))}
              style={{ background:"transparent", border:"none", outline:"none", color:C.cream, padding:"7px 12px", fontSize:13, fontFamily:mono, fontWeight:600, width:"100%" }} />
          </div>
          <input type="range" min={0} max={90} step={5} value={Math.round(reinvestRate*100)}
            onChange={e=>onReinvest(Number(e.target.value)/100)} style={{ accentColor:"#4CAF50", cursor:"pointer" }} />
          <div style={{ padding:"3px 8px", background:`${tier.color}15`, border:`1px solid ${tier.color}44`, borderRadius:5 }}>
            <span style={{ color:tier.color, fontSize:9, fontFamily:mono }}>Effective: {effRate}% · {tier.label}</span>
          </div>
        </div>
        <div style={{ padding:"10px 18px", background:C.panel, borderRadius:10, border:`1px solid ${mColor}44`, alignSelf:"flex-start", marginTop:18 }}>
          <div style={{ color:C.muted, fontSize:10, fontFamily:mono, marginBottom:3 }}>GROSS MARGIN</div>
          <div style={{ color:mColor, fontSize:22, fontWeight:700, fontFamily:serif }}>{margin}%</div>
          <div style={{ color:C.muted, fontSize:10, fontFamily:mono, marginTop:2 }}>SAR {sellPrice - productCost} / unit</div>
        </div>
        {productCost >= sellPrice && (
          <div style={{ alignSelf:"center", padding:"8px 14px", background:"#F4A26122", border:"1px solid #F4A261", borderRadius:8, color:"#F4A261", fontSize:12, fontFamily:mono }}>
            ⚠ Cost ≥ Price — unprofitable
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BUDGET EDITOR ────────────────────────────────────────────────────────────
function BudgetEditor({ investment, alloc, onAlloc }) {
  const budget = buildBudget(investment, alloc);
  const total  = Object.values(alloc).reduce((s,v)=>s+v,0);
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2 }}>BUDGET ALLOCATION EDITOR</div>
          <div style={{ color:C.muted, fontSize:11, fontFamily:mono, marginTop:3 }}>Drag sliders — others auto-scale to keep total = 100%</div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ padding:"5px 12px", background:`${total>99.5&&total<100.5?"#4CAF5018":"#F4A26118"}`, border:`1px solid ${total>99.5&&total<100.5?"#4CAF50":"#F4A261"}44`, borderRadius:20 }}>
            <span style={{ color:total>99.5&&total<100.5?"#4CAF50":"#F4A261", fontSize:11, fontFamily:mono, fontWeight:700 }}>Total: {total.toFixed(1)}%</span>
          </div>
          <button onClick={()=>onAlloc({...DEFAULT_ALLOC})} style={{ background:"transparent", border:`1px solid ${C.gold}44`, color:C.gold, borderRadius:8, padding:"6px 14px", fontSize:11, fontFamily:mono, cursor:"pointer" }}>Reset</button>
        </div>
      </div>
      <div style={{ display:"flex", height:14, borderRadius:7, overflow:"hidden", marginBottom:20, gap:1 }}>
        {budget.map((b,i) => <div key={i} style={{ flex:b.pct, background:b.color, transition:"flex 0.25s" }} title={`${b.name}: ${b.pct.toFixed(1)}%`} />)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(295px,1fr))", gap:14 }}>
        {ALLOC_META.map(meta => {
          const b = budget.find(x=>x.key===meta.key);
          return (
            <div key={meta.key} style={{ background:C.dark, border:`1px solid ${meta.color}33`, borderRadius:10, padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", background:meta.color }} />
                  <span style={{ color:C.cream, fontSize:13, fontWeight:600 }}>{meta.label}</span>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", background:C.panel, border:`1px solid ${meta.color}55`, borderRadius:6, overflow:"hidden" }}>
                    <input type="number" min={meta.min} max={meta.max} step={0.5} value={parseFloat(alloc[meta.key].toFixed(1))}
                      onChange={e=>onAlloc(changeAlloc(alloc,meta.key,Number(e.target.value)))}
                      style={{ background:"transparent", border:"none", outline:"none", color:meta.color, padding:"4px 6px", fontSize:13, fontFamily:mono, fontWeight:700, width:50, textAlign:"right" }} />
                    <span style={{ color:meta.color, fontSize:12, fontFamily:mono, paddingRight:6 }}>%</span>
                  </div>
                  <span style={{ color:C.amber, fontSize:12, fontFamily:mono, minWidth:68, textAlign:"right" }}>SAR {(b.value/1000).toFixed(0)}K</span>
                </div>
              </div>
              <input type="range" min={meta.min} max={meta.max} step={0.5} value={alloc[meta.key]}
                onChange={e=>onAlloc(changeAlloc(alloc,meta.key,Number(e.target.value)))}
                style={{ accentColor:meta.color, cursor:"pointer", width:"100%" }} />
              <div style={{ display:"flex", justifyContent:"space-between", color:C.muted, fontSize:9, fontFamily:mono, marginTop:3 }}>
                <span>min {meta.min}%</span><span>max {meta.max}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB: OVERVIEW ────────────────────────────────────────────────────────────
function OverviewTab({ data, budget, inputs, alloc, onAlloc }) {
  const { investment, sellPrice, productCost } = inputs;
  const y1 = data.slice(0,12).reduce((s,d)=>s+d.revenue,0);
  const y2 = data.slice(12).reduce((s,d)=>s+d.revenue,0);
  const bm = data.findIndex(d=>d.profit>0);
  const totalProfit = data.reduce((s,d)=>s+d.profit,0);
  const margin = sellPrice>0 ? (((sellPrice-productCost)/sellPrice)*100).toFixed(1) : 0;
  const mktBudget = budget.find(b=>b.key==="marketing")?.value||0;
  const invBudget = budget.find(b=>b.key==="inventory")?.value||0;
  return (
    <div>
      <SectionTitle title="Business Simulation Overview" sub="Saudi Arabia B2C · China Sourcing · Live Model" />
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:22 }}>
        <KPICard label="Total Investment"  value={`SAR ${(investment/1e6).toFixed(2)}M`} sub="Investor-backed" />
        <KPICard label="Breakeven"         value={bm>=0?`Month ${bm+1}`:"N/A"} sub="Profit turns positive" accent={C.forest} />
        <KPICard label="Year 1 Revenue"    value={`SAR ${(y1/1000).toFixed(0)}K`} sub="Projected" accent={C.amber} />
        <KPICard label="Year 2 Revenue"    value={`SAR ${(y2/1e6).toFixed(2)}M`} sub="Projected" accent={C.rust} />
        <KPICard label="24M Net Profit"    value={`SAR ${(totalProfit/1000).toFixed(0)}K`} sub="Cumulative" accent={totalProfit>0?C.forest:"#F4A261"} />
        <KPICard label="Gross Margin"      value={`${margin}%`} sub="Per unit" accent={C.gold} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:24, marginBottom:18 }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:12 }}>24-MONTH REVENUE VS PROFIT</div>
        <ResponsiveContainer width="100%" height={245}>
          <AreaChart data={data} margin={{ top:5, right:10, left:10, bottom:5 }}>
            <defs>
              <linearGradient id="rG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.gold} stopOpacity={0.3}/><stop offset="95%" stopColor={C.gold} stopOpacity={0}/></linearGradient>
              <linearGradient id="pG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.forest} stopOpacity={0.4}/><stop offset="95%" stopColor={C.forest} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.mid}/>
            <XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:10, fill:C.muted }}/>
            <YAxis stroke={C.muted} tick={{ fontSize:10, fill:C.muted }} tickFormatter={sarFmt}/>
            <Tooltip {...TT} formatter={(v,n)=>[sarFmt(v),n]}/>
            <Legend wrapperStyle={{ fontSize:11, fontFamily:mono }}/>
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.gold}   strokeWidth={2} fill="url(#rG)"/>
            <Area type="monotone" dataKey="profit"  name="Profit"  stroke={C.forest} strokeWidth={2} fill="url(#pG)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
        <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:22 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:10 }}>ALLOCATION DONUT</div>
          <ResponsiveContainer width="100%" height={165}>
            <PieChart><Pie data={budget} cx="50%" cy="50%" innerRadius={46} outerRadius={76} dataKey="value" paddingAngle={3}>
              {budget.map((e,i)=><Cell key={i} fill={e.color}/>)}
            </Pie><Tooltip {...TT} formatter={v=>[`SAR ${(v/1000).toFixed(0)}K`]}/></PieChart>
          </ResponsiveContainer>
          {budget.map((e,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}><div style={{ width:8, height:8, borderRadius:"50%", background:e.color }}/><span style={{ color:C.sage, fontSize:11, fontFamily:mono }}>{e.name}</span></div>
              <div style={{ display:"flex", gap:8 }}><span style={{ color:C.muted, fontSize:11, fontFamily:mono }}>{e.pct.toFixed(1)}%</span><span style={{ color:C.amber, fontSize:11, fontFamily:mono }}>SAR {(e.value/1000).toFixed(0)}K</span></div>
            </div>
          ))}
        </div>
        <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:22 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:10 }}>UNIT ECONOMICS</div>
          {[
            { k:"Avg Selling Price",v:`SAR ${sellPrice.toLocaleString()}` },
            { k:"Avg Product Cost", v:`SAR ${productCost.toLocaleString()}` },
            { k:"Gross Profit / Unit",v:`SAR ${(sellPrice-productCost).toLocaleString()}` },
            { k:"Gross Margin",v:`${((sellPrice-productCost)/Math.max(1,sellPrice)*100).toFixed(1)}%` },
            { k:"Inventory Budget",v:`SAR ${(invBudget/1000).toFixed(0)}K (${alloc.inventory.toFixed(0)}%)` },
            { k:"Marketing Budget",v:`SAR ${(mktBudget/1000).toFixed(0)}K (${alloc.marketing.toFixed(0)}%)` },
            { k:"Initial Units Purchaseable",v:`~${Math.round(invBudget/Math.max(1,productCost)).toLocaleString()} units` },
            { k:"Est. Customer Acq. Cost",v:`SAR ${Math.round(mktBudget/Math.max(1,data[11].customers))}` },
          ].map((r,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.mid}` }}>
              <span style={{ color:C.muted, fontSize:12, fontFamily:mono }}>{r.k}</span>
              <span style={{ color:C.amber, fontSize:12, fontFamily:mono, fontWeight:600 }}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
      <BudgetEditor investment={investment} alloc={alloc} onAlloc={onAlloc} />
    </div>
  );
}

// ─── TAB: PORTFOLIO ───────────────────────────────────────────────────────────
function PortfolioTab({ inputs, overrides, onOverride }) {
  const { sellPrice, productCost } = inputs;
  const [selected, setSelected] = useState(null);
  const products = useMemo(() => BASE_PRODUCTS.map(p => {
    const ov = overrides[p.sku];
    const price = Math.round(sellPrice*p.priceMult), cost = Math.round(productCost*p.costMult);
    const margin = price > 0 ? Math.round(((price-cost)/price)*100) : 0;
    const mUnits = p.velocity==="High"?80:p.velocity==="Medium"?40:15;
    return { ...p, name:ov.name, price, cost, margin, stock:ov.stock, moq:ov.moq, leadDays:ov.leadDays, monthlyRevenue:price*mUnits };
  }), [sellPrice, productCost, overrides]);
  const setField = (sku, field, val) => onOverride(sku, { ...overrides[sku], [field]:val });
  return (
    <div>
      <SectionTitle title="Product Portfolio" sub="6 SKUs · Click any highlighted value to edit inline" />
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:16 }}>
        <KPICard label="Total Units"  value={products.reduce((s,p)=>s+p.stock,0).toLocaleString()} />
        <KPICard label="Avg Lead"     value={`${Math.round(products.reduce((s,p)=>s+p.leadDays,0)/products.length)}d`} accent={C.amber} />
        <KPICard label="Critical SKUs" value={products.filter(p=>{const r=p.velocity==="High"?80:p.velocity==="Medium"?40:15;return (p.stock/r)*4.3<(p.leadDays/7)*1.3;}).length} accent={"#F44336"} />
        <KPICard label="Active SKUs"  value={products.filter(p=>p.status==="Active").length} accent={C.forest} />
      </div>
      <div style={{ padding:"8px 14px", background:`${C.amber}11`, border:`1px solid ${C.amber}33`, borderRadius:8, marginBottom:16 }}>
        <span style={{ color:C.muted, fontSize:12, fontFamily:mono }}>✎ Click <span style={{ color:"#CE93D8" }}>Name</span>, <span style={{ color:C.amber }}>Units</span>, <span style={{ color:"#81C784" }}>MOQ</span>, or <span style={{ color:"#64B5F6" }}>Lead Time</span> to edit. Enter to save.</span>
      </div>
      <div style={{ overflowX:"auto", marginBottom:22 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:mono, fontSize:12 }}>
          <thead><tr style={{ borderBottom:`1px solid ${C.gold}44` }}>
            {["SKU","Cat.",<span style={{ color:"#CE93D8" }}>Name ✎</span>,"Price","Cost","Margin","Mo. Rev.","Velocity",<span style={{ color:C.amber }}>Units ✎</span>,<span style={{ color:"#81C784" }}>MOQ ✎</span>,<span style={{ color:"#64B5F6" }}>Lead ✎</span>,"Cover","Status"].map((h,i)=>(
              <th key={i} style={{ color:C.gold, padding:"10px 10px", textAlign:"left", letterSpacing:1, fontWeight:500, whiteSpace:"nowrap" }}>{h}</th>
            ))}</tr></thead>
          <tbody>{products.map(p => {
            const mr = p.velocity==="High"?80:p.velocity==="Medium"?40:15;
            const ws = (p.stock/mr)*4.3, lw = p.leadDays/7, sw = lw*1.3;
            const cc = ws<sw?"#F44336":ws<sw*2?C.amber:"#4CAF50";
            return (
              <tr key={p.id} style={{ borderBottom:`1px solid ${C.mid}`, background:selected===p.sku?"#152A1C":"transparent" }} onClick={()=>setSelected(selected===p.sku?null:p.sku)}>
                <td style={{ padding:"10px", color:C.muted }}>{p.sku}</td>
                <td style={{ padding:"10px" }}><span style={{ background:C.mid, color:C.amber, padding:"2px 6px", borderRadius:4, fontSize:10 }}>{p.category}</span></td>
                <EditableCell value={p.name} type="text" accent="#CE93D8" width={148} onSave={v=>setField(p.sku,"name",v)} />
                <td style={{ padding:"10px", color:C.amber, fontWeight:600 }}>{p.price.toLocaleString()}</td>
                <td style={{ padding:"10px", color:C.sage }}>{p.cost.toLocaleString()}</td>
                <td style={{ padding:"10px", color:p.margin>=60?"#4CAF50":p.margin>=40?C.amber:"#F44336", fontWeight:600 }}>{p.margin}%</td>
                <td style={{ padding:"10px", color:C.cream }}>SAR {(p.monthlyRevenue/1000).toFixed(1)}K</td>
                <td style={{ padding:"10px", color:mr>=80?"#4CAF50":mr>=40?C.amber:"#F4A261" }}>{p.velocity}</td>
                <EditableCell value={p.stock}    min={0}  max={9999} step={10} accent={C.amber}   onSave={v=>setField(p.sku,"stock",v)}    unit=" u" />
                <EditableCell value={p.moq}      min={1}  max={5000} step={5}  accent="#81C784"   onSave={v=>setField(p.sku,"moq",v)}      unit=" u" />
                <EditableCell value={p.leadDays} min={7}  max={120}  step={1}  accent="#64B5F6"   onSave={v=>setField(p.sku,"leadDays",v)} unit="d" />
                <td style={{ padding:"10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:48, height:5, background:C.mid, borderRadius:3, overflow:"hidden" }}><div style={{ height:5, background:cc, width:`${Math.min(100,(ws/16)*100)}%` }}/></div>
                    <span style={{ color:cc, fontSize:10 }}>{ws.toFixed(1)}wk</span>
                  </div>
                </td>
                <td style={{ padding:"10px", color:p.status==="Active"?"#4CAF50":C.amber }}>● {p.status}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {selected && (() => { const p = products.find(x=>x.sku===selected); if(!p) return null;
        return (
          <div style={{ background:C.panel, border:`1px solid ${C.gold}44`, borderRadius:14, padding:22, marginBottom:22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2 }}>DETAIL — {p.sku} · {p.name}</div>
              <button onClick={()=>setSelected(null)} style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:12, marginBottom:16 }}>
              {[{k:"Supplier",v:p.supplier},{k:"Price",v:`SAR ${p.price.toLocaleString()}`},{k:"Cost",v:`SAR ${p.cost.toLocaleString()}`},{k:"Margin",v:`${p.margin}%`},{k:"Units On Hand",v:p.stock.toLocaleString()},{k:"MOQ",v:`${p.moq} units`},{k:"Lead Time",v:`${p.leadDays} days`},{k:"Monthly Revenue",v:`SAR ${(p.monthlyRevenue/1000).toFixed(1)}K`}].map((r,i)=>(
                <div key={i} style={{ padding:12, background:C.dark, borderRadius:8, border:`1px solid ${C.mid}` }}>
                  <div style={{ color:C.muted, fontSize:10, fontFamily:mono, marginBottom:3 }}>{r.k}</div>
                  <div style={{ color:C.cream, fontSize:13, fontWeight:600 }}>{r.v}</div>
                </div>
              ))}
            </div>
            <StockCoverageBar stock={p.stock} velocity={p.velocity} leadDays={p.leadDays} />
          </div>
        );
      })()}
    </div>
  );
}

// ─── TAB: TIMELINE ────────────────────────────────────────────────────────────
const PHASES = [
  { phase:"Phase 1", name:"Foundation & Setup",  months:"M1-M2",   color:C.gold,   tasks:["Register company (CR + ZATCA + SASO)","Secure warehouse in Riyadh (600-800 sqm)","Sign investor term sheets","Tech stack selection (Shopify / custom)","Brand identity & naming","Payment gateway (Mada, STC Pay, Apple Pay)"] },
  { phase:"Phase 2", name:"Sourcing & Build",     months:"M2-M4",   color:C.forest, tasks:["Factory audits & sample orders from China","Negotiate MOQ & payment terms (30/70)","Website dev & product photography","WMS setup","Hire: Ops Manager, warehouse staff, Social Media Mgr","Soft launch on Instagram & Snapchat"] },
  { phase:"Phase 3", name:"Launch & Acquire",     months:"M4-M6",   color:C.rust,   tasks:["Official store launch","Influencer seeding campaign (Tier 1 + Tier 2)","Launch paid social (Meta, Snapchat)","First China shipment (FCL or LCL)","Customer service (WhatsApp + CRM)","KPI dashboard go-live"] },
  { phase:"Phase 4", name:"Scale & Optimize",     months:"M6-M12",  color:C.mid,    tasks:["Analyze top SKUs, cut underperformers","Expand influencer roster (20-30 creators)","Launch loyalty program","Optimize China freight","Explore second product line","Monthly investor reporting"] },
  { phase:"Phase 5", name:"Expansion",            months:"M12-M24", color:C.amber,  tasks:["Expand to Jeddah & Dammam","Launch B2B / corporate gifting channel","Add 2nd China supplier per category","Explore GCC expansion (Kuwait, UAE)","Automate reorder & demand forecasting","Series A / bridge funding round"] },
];
function TimelineTab() {
  const [open, setOpen] = useState(null);
  return (
    <div>
      <SectionTitle title="Project Timeline & Milestones" sub="24-Month Roadmap · 5 Phases" />
      <div style={{ display:"flex", gap:8, marginBottom:22, overflowX:"auto" }}>
        {PHASES.map((p,i)=>(
          <div key={i} onClick={()=>setOpen(open===i?null:i)} style={{ flex:1, minWidth:110, background:`${p.color}18`, border:`1px solid ${p.color}${open===i?"88":"33"}`, borderRadius:10, padding:"10px 14px", textAlign:"center", cursor:"pointer", transition:"all 0.2s" }}>
            <div style={{ color:p.color, fontSize:9, fontFamily:mono }}>{p.phase}</div>
            <div style={{ color:C.cream, fontSize:12, fontWeight:600, marginTop:3 }}>{p.name}</div>
            <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{p.months}</div>
          </div>
        ))}
      </div>
      {PHASES.map((p,i)=>(
        <div key={i} style={{ marginBottom:10, background:C.panel, border:`1px solid ${open===i?p.color+"66":C.mid}`, borderRadius:12, overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", cursor:"pointer" }} onClick={()=>setOpen(open===i?null:i)}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <span style={{ background:p.color, color:C.dark, fontSize:10, fontFamily:mono, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>{p.phase}</span>
              <span style={{ color:C.cream, fontWeight:600, fontFamily:serif, fontSize:15 }}>{p.name}</span>
              <span style={{ color:C.muted, fontSize:11, fontFamily:mono }}>{p.months}</span>
            </div>
            <span style={{ color:p.color, fontSize:18 }}>{open===i?"-":"+"}</span>
          </div>
          {open===i && (
            <div style={{ padding:"0 20px 20px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:10 }}>
                {p.tasks.map((t,j)=>(
                  <div key={j} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"10px 14px", background:C.dark, borderRadius:8, border:`1px solid ${C.mid}` }}>
                    <span style={{ color:p.color, fontSize:12, marginTop:1 }}>◆</span>
                    <span style={{ color:C.sage, fontSize:13 }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TAB: FINANCIALS (with CSV export) ────────────────────────────────────────
function FinancialTab({ data }) {
  const [view, setView] = useState("revenue");
  const doExport = () => exportToCSV("financial_model_24m.csv", [
    { label:"Month",k:"month" },{ label:"Units",k:"units" },
    { label:"Revenue (SAR)",k:"revenue",fmt:v=>v.toFixed(0) },
    { label:"COGS (SAR)",k:"cogs",fmt:v=>v.toFixed(0) },
    { label:"OpEx (SAR)",k:"opex",fmt:v=>v.toFixed(0) },
    { label:"Net Profit",k:"profit",fmt:v=>v.toFixed(0) },
    { label:"Customers",k:"customers" },
    { label:"Inv. Value",k:"inventory",fmt:v=>v.toFixed(0) },
    { label:"Effective Reinvest%",k:"effectiveReinvRate",fmt:v=>`${(v*100).toFixed(1)}%` },
  ], data);
  return (
    <div>
      <SectionTitle title="Financial Model — 24 Months" sub="All Numbers Recalculate Live" />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div style={{ display:"flex", gap:8 }}>
          {[["revenue","Revenue vs COGS"],["profit","Net Profit"],["inventory","Inventory Value"]].map(([k,v])=>(
            <button key={k} onClick={()=>setView(k)} style={{ background:view===k?C.gold:C.panel, color:view===k?C.dark:C.sage, border:`1px solid ${view===k?C.gold:"#2D4A35"}`, borderRadius:8, padding:"7px 16px", fontSize:11, fontFamily:mono, cursor:"pointer" }}>{v}</button>
          ))}
        </div>
        <ExportButton onClick={doExport} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:24, marginBottom:18 }}>
        <ResponsiveContainer width="100%" height={265}>
          {view==="revenue" ? (
            <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={sarFmt}/><Tooltip {...TT} formatter={v=>sarFmt(v)}/><Legend wrapperStyle={{ fontSize:11,fontFamily:mono }}/><Bar dataKey="revenue" name="Revenue" fill={C.gold} radius={[3,3,0,0]}/><Bar dataKey="cogs" name="COGS" fill={C.mid} radius={[3,3,0,0]}/></BarChart>
          ) : view==="profit" ? (
            <AreaChart data={data}><defs><linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.forest} stopOpacity={0.4}/><stop offset="95%" stopColor={C.forest} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={sarFmt}/><Tooltip {...TT} formatter={v=>sarFmt(v)}/><Area type="monotone" dataKey="profit" name="Net Profit" stroke={C.forest} fill="url(#pg2)" strokeWidth={2}/></AreaChart>
          ) : (
            <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={sarFmt}/><Tooltip {...TT} formatter={v=>sarFmt(v)}/><Line type="monotone" dataKey="inventory" name="Inventory Value" stroke={C.amber} strokeWidth={2} dot={false}/></LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:mono, fontSize:11 }}>
          <thead><tr style={{ borderBottom:`1px solid ${C.gold}44` }}>
            {["Month","Units","Revenue","COGS","OpEx","Net Profit","Customers","Inv. Value","Reinvest%"].map(h=>(
              <th key={h} style={{ color:C.gold, padding:"8px 12px", textAlign:"right", letterSpacing:1, whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{data.map((d,i)=>(
            <tr key={i} style={{ borderBottom:`1px solid ${C.dark}`, background:i%2===0?"#091510":"transparent" }}>
              <td style={{ padding:"7px 12px", color:C.muted, textAlign:"right" }}>{d.month}</td>
              <td style={{ padding:"7px 12px", color:C.sage,  textAlign:"right" }}>{d.units.toLocaleString()}</td>
              <td style={{ padding:"7px 12px", color:C.gold,  textAlign:"right" }}>{(d.revenue/1000).toFixed(1)}K</td>
              <td style={{ padding:"7px 12px", color:C.sage,  textAlign:"right" }}>{(d.cogs/1000).toFixed(1)}K</td>
              <td style={{ padding:"7px 12px", color:C.sage,  textAlign:"right" }}>{(d.opex/1000).toFixed(1)}K</td>
              <td style={{ padding:"7px 12px", color:d.profit>=0?"#4CAF50":"#F4A261", textAlign:"right", fontWeight:600 }}>{d.profit>=0?"+":""}{(d.profit/1000).toFixed(1)}K</td>
              <td style={{ padding:"7px 12px", color:C.amber, textAlign:"right" }}>{d.customers.toLocaleString()}</td>
              <td style={{ padding:"7px 12px", color:C.muted, textAlign:"right" }}>{(d.inventory/1000).toFixed(0)}K</td>
              <td style={{ padding:"7px 12px", color:"#81C784", textAlign:"right" }}>{(d.effectiveReinvRate*100).toFixed(0)}%</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: CASH FLOW 24M (with CSV export) ────────────────────────────────────
function CashFlowTab({ data, investment, reinvestRate, onReinvestRate }) {
  const [view, setView] = useState("waterfall");
  const totalCashIn = data.reduce((s,d)=>s+d.cashIn,0), totalCashOut = data.reduce((s,d)=>s+d.cashOut,0);
  const totalInvOrder = data.reduce((s,d)=>s+d.invOrder,0), totalSetup = data.reduce((s,d)=>s+d.setupSpend,0);
  const totalReinvest = data.reduce((s,d)=>s+d.reinvest,0), totalReinvInv = data.reduce((s,d)=>s+d.reinvInvStock,0);
  const totalReinvMkt = data.reduce((s,d)=>s+d.reinvMarketing,0);
  const lowestBalance = Math.min(...data.map(d=>d.cumulativeCash)), finalBalance = data[data.length-1].cumulativeCash;
  const pct = Math.round(reinvestRate*100);
  const effRate = getEffectiveReinvestRate(reinvestRate, data[0]?.cashIn/Math.max(1,data[0]?.units), data[0]?.cogs/Math.max(1,data[0]?.units));
  const tier = reinvestTierLabel(data[0]?.cashIn/Math.max(1,data[0]?.units), data[0]?.cogs/Math.max(1,data[0]?.units));
  const chartData = data.map(d=>({ month:d.month, "Revenue (In)":d.cashIn, "Inv. Orders":d.invOrder, "OpEx":d.opex, "Setup":d.setupSpend, "Reinvestment":d.reinvInvStock, "Net Flow":d.netCashFlow, "Cash Balance":d.cumulativeCash }));
  const doExport = () => exportToCSV("cashflow_24m.csv", [
    { label:"Month",k:"month" },{ label:"Cash In",k:"cashIn",fmt:v=>v.toFixed(0) },
    { label:"Inv Orders",k:"invOrder",fmt:v=>v.toFixed(0) },{ label:"OpEx",k:"opex",fmt:v=>v.toFixed(0) },
    { label:"Setup",k:"setupSpend",fmt:v=>v.toFixed(0) },{ label:"Reinvest",k:"reinvInvStock",fmt:v=>v.toFixed(0) },
    { label:"Total Out",k:"cashOut",fmt:v=>v.toFixed(0) },{ label:"Net Flow",k:"netCashFlow",fmt:v=>v.toFixed(0) },
    { label:"Cum Balance",k:"cumulativeCash",fmt:v=>v.toFixed(0) },
  ], data);
  return (
    <div>
      <SectionTitle title="Cash In / Cash Out" sub="Inventory Orders · Setup · Reinvestment · Balance" />
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:22 }}>
        <KPICard label="Total Cash In (24M)"   value={`SAR ${(totalCashIn/1e6).toFixed(2)}M`}  sub="Revenue collected" />
        <KPICard label="Total Cash Out (24M)"  value={`SAR ${(totalCashOut/1e6).toFixed(2)}M`} sub="All outflows" accent={C.rust} />
        <KPICard label="Inventory Orders"      value={`SAR ${(totalInvOrder/1000).toFixed(0)}K`} sub="China POs placed" accent={C.amber} />
        <KPICard label="Total Reinvested"      value={`SAR ${(totalReinvest/1000).toFixed(0)}K`} sub={`${pct}% base rate`} accent={C.forest} />
        <KPICard label="Lowest Balance"        value={`SAR ${(lowestBalance/1000).toFixed(0)}K`} sub="Peak deficit" accent={lowestBalance<0?"#F44336":"#4CAF50"} />
        <KPICard label="Closing Balance (M24)" value={`SAR ${(finalBalance/1e6).toFixed(2)}M`}  sub="Final cash" accent={finalBalance>0?"#4CAF50":"#F44336"} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.forest}44`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ color:C.forest, fontSize:10, fontFamily:mono, letterSpacing:2 }}>REINVESTMENT RATE · TIERED ENGINE</div>
            <div style={{ color:C.muted, fontSize:11, fontFamily:mono, marginTop:3 }}>Base {pct}% → Effective <span style={{ color:tier.color }}>{(effRate*100).toFixed(0)}%</span> · <span style={{ color:tier.color }}>{tier.label}</span></div>
          </div>
          <div style={{ textAlign:"center", padding:"8px 18px", background:C.dark, borderRadius:10, border:`1px solid ${C.forest}44` }}>
            <div style={{ color:C.forest, fontSize:26, fontWeight:700, fontFamily:serif }}>{(effRate*100).toFixed(0)}%</div>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono }}>effective reinvest</div>
          </div>
        </div>
        <input type="range" min={0} max={80} step={5} value={pct} onChange={e=>onReinvestRate(Number(e.target.value)/100)} style={{ accentColor:C.forest, cursor:"pointer", width:"100%", height:6 }} />
        <div style={{ display:"flex", justifyContent:"space-between", color:C.muted, fontSize:10, fontFamily:mono, marginTop:4 }}><span>0% — keep all profit</span><span>80% — aggressive growth</span></div>
        <div style={{ background:`${C.dark}`, borderRadius:8, padding:"10px 14px", marginTop:12, border:`1px solid ${C.mid}`, fontSize:11, fontFamily:mono }}>
          <div style={{ color:C.gold, marginBottom:6, fontSize:10 }}>HOW TIERED REINVESTMENT WORKS</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {[{range:"GM ≥ 60%",eff:"Base × 1.20",c:"#4CAF50",note:"Strong margins → unlock growth reinvestment"},
              {range:"GM 40–60%",eff:"Base × 1.00",c:C.amber,note:"Standard — use the base rate as-is"},
              {range:"GM < 40%", eff:"Base × 0.60",c:"#F44336",note:"Thin margins → protect cash automatically"}
            ].map((row,i)=>(
              <div key={i} style={{ padding:"6px 12px", background:`${row.c}12`, border:`1px solid ${row.c}33`, borderRadius:8, flex:1, minWidth:200 }}>
                <span style={{ color:row.c, fontWeight:700 }}>{row.range}</span>
                <span style={{ color:C.sage }}> → {row.eff}</span>
                <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{row.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ display:"flex", gap:8 }}>
          {[["waterfall","Cash In vs Out"],["balance","Cash Balance"],["net","Net Flow"]].map(([k,v])=>(
            <button key={k} onClick={()=>setView(k)} style={{ background:view===k?C.gold:C.panel, color:view===k?C.dark:C.sage, border:`1px solid ${view===k?C.gold:"#2D4A35"}`, borderRadius:8, padding:"7px 16px", fontSize:11, fontFamily:mono, cursor:"pointer" }}>{v}</button>
          ))}
        </div>
        <ExportButton onClick={doExport} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:24, marginBottom:20 }}>
        {view==="waterfall" && <ResponsiveContainer width="100%" height={300}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/><Tooltip {...TT} formatter={v=>[sarFmt(v)]}/><Legend wrapperStyle={{ fontSize:10,fontFamily:mono }}/><Bar dataKey="Revenue (In)" stackId="in" fill="#4CAF50" radius={[3,3,0,0]}/><Bar dataKey="Inv. Orders" stackId="out" fill="#64B5F6"/><Bar dataKey="OpEx" stackId="out" fill={C.rust}/><Bar dataKey="Setup" stackId="out" fill="#CE93D8"/><Bar dataKey="Reinvestment" stackId="out" fill={C.forest} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>}
        {view==="balance" && <ResponsiveContainer width="100%" height={300}><AreaChart data={chartData}><defs><linearGradient id="bG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4CAF50" stopOpacity={0.35}/><stop offset="95%" stopColor="#4CAF50" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/><Tooltip {...TT} formatter={v=>[sarFmt(v)]}/><Area type="monotone" dataKey="Cash Balance" stroke="#4CAF50" fill="url(#bG)" strokeWidth={2.5} dot={false}/></AreaChart></ResponsiveContainer>}
        {view==="net" && <ResponsiveContainer width="100%" height={300}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/><Tooltip {...TT} formatter={v=>[sarFmt(v)]}/><Bar dataKey="Net Flow" radius={[3,3,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d["Net Flow"]>=0?"#4CAF50":"#F44336"}/>)}</Bar></BarChart></ResponsiveContainer>}
      </div>
    </div>
  );
}

// ─── TAB: SAFETY STOCK (enhanced: EOQ + full cost breakdown) ─────────────────
function SafetyStockTab({ overrides, inputs }) {
  const { sellPrice, productCost } = inputs;
  const [serviceIdx,    setServiceIdx]    = useState(2);
  const [leadTimeSigma, setLeadTimeSigma] = useState(4);
  const [demandCV,      setDemandCV]      = useState(25);
  const [orderingCost,  setOrderingCost]  = useState(2500); // SAR per PO
  const [holdingRate,   setHoldingRate]   = useState(20);   // % of unit cost per year
  const [selectedSku,   setSelectedSku]   = useState("HP-001");
  const zScore = SERVICE_LEVELS[serviceIdx].zScore;

  const skuData = useMemo(() => BASE_PRODUCTS.map(p => {
    const ov           = overrides[p.sku];
    const price        = Math.round(sellPrice * p.priceMult);
    const cost         = Math.round(productCost * p.costMult);
    const monthlyUnits = p.velocity==="High"?80:p.velocity==="Medium"?40:15;
    const avgDaily     = parseFloat((monthlyUnits/30).toFixed(3));
    const sigmaD       = parseFloat((avgDaily * demandCV/100).toFixed(3));
    const ss           = calcSS(avgDaily, sigmaD, ov.leadDays, leadTimeSigma, zScore);
    const rop          = calcROP(avgDaily, ov.leadDays, ss);
    const maxStock     = rop + ov.moq;
    const avgStock     = ss + ov.moq/2;
    const daysOfSS     = avgDaily > 0 ? Math.round(ss/avgDaily) : 0;
    const weeksToROP   = ov.stock > rop ? parseFloat(((ov.stock-rop)/(avgDaily*7)).toFixed(1)) : 0;
    const status       = ov.stock <= ss?"critical":ov.stock <= rop?"reorder":ov.stock <= rop*1.3?"watch":"healthy";
    // EOQ
    const annualDemand = Math.round(monthlyUnits * 12);
    const hcpu         = cost * (holdingRate/100);  // holding cost per unit per year
    const eoq          = calcEOQ(annualDemand, orderingCost, hcpu);
    const invCosts     = calcInvCosts(annualDemand, eoq, orderingCost, hcpu);
    return { ...p, ...ov, price, cost, monthlyUnits, annualDemand, avgDaily, sigmaD,
      ss, rop, maxStock, avgStock, daysOfSS, weeksToROP, status, eoq, ...invCosts };
  }), [overrides, sellPrice, productCost, zScore, demandCV, leadTimeSigma, orderingCost, holdingRate]);

  const sel = skuData.find(s => s.sku === selectedSku);
  const sCol = { critical:"#F44336", reorder:"#FF7043", watch:C.amber, healthy:"#4CAF50" };
  const sLbl = { critical:"Below Safety Stock!", reorder:"Reorder Now", watch:"Watch Closely", healthy:"Healthy" };

  const doExport = () => exportToCSV("safety_stock.csv", [
    {label:"SKU",k:"sku"},{label:"Product",k:"name"},{label:"Velocity",k:"velocity"},
    {label:"Avg Daily",k:"avgDaily",fmt:v=>v.toFixed(3)},{label:"Lead Days",k:"leadDays"},
    {label:"Safety Stock",k:"ss"},{label:"Reorder Point",k:"rop"},
    {label:"Max Stock",k:"maxStock"},{label:"Current Stock",k:"stock"},
    {label:"EOQ",k:"eoq"},{label:"Orders/Year",k:"ordersPerYear"},
    {label:"Annual Ordering Cost",k:"annualOrdering"},{label:"Annual Holding Cost",k:"annualHolding"},
    {label:"Total Annual Cost",k:"total"},{label:"Status",k:"status"},
  ], skuData);

  const GaugeBar = ({ stock, ss, rop, maxStock }) => {
    const cap = Math.max(maxStock*1.1, stock*1.1);
    const pSS = Math.min(100,(ss/cap)*100), pROP = Math.min(100,(rop/cap)*100), pNow = Math.min(100,(stock/cap)*100);
    return (
      <div style={{ position:"relative", height:28, background:C.mid, borderRadius:6, overflow:"visible", marginTop:8 }}>
        <div style={{ position:"absolute", left:0, top:0, width:`${pSS}%`,       height:"100%", background:"#F4433620", borderRadius:"6px 0 0 6px" }}/>
        <div style={{ position:"absolute", left:`${pSS}%`, top:0, width:`${pROP-pSS}%`, height:"100%", background:"#FF704320" }}/>
        <div style={{ position:"absolute", left:`${pROP}%`, top:0, width:`${100-pROP}%`, height:"100%", background:"#4CAF5020", borderRadius:"0 6px 6px 0" }}/>
        <div style={{ position:"absolute", left:`${pSS}%`, top:-4, width:2, height:36, background:"#F44336", zIndex:2 }}>
          <div style={{ position:"absolute", top:-14, left:4, color:"#F44336", fontSize:8, fontFamily:mono, whiteSpace:"nowrap" }}>SS={ss}</div>
        </div>
        <div style={{ position:"absolute", left:`${pROP}%`, top:-4, width:2, height:36, background:C.amber, zIndex:2 }}>
          <div style={{ position:"absolute", top:-14, left:4, color:C.amber, fontSize:8, fontFamily:mono, whiteSpace:"nowrap" }}>ROP={rop}</div>
        </div>
        <div style={{ position:"absolute", left:`${pNow}%`, top:2, transform:"translateX(-50%)", zIndex:3 }}>
          <div style={{ width:10, height:24, background:C.cream, borderRadius:3, border:"2px solid #0A1910" }}/>
        </div>
      </div>
    );
  };

  return (
    <div>
      <SectionTitle title="Safety Stock & EOQ Calculator" sub="Per-SKU · Full Formula · Economic Order Quantity" />
      {/* Global controls */}
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:22, marginBottom:20 }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:16 }}>GLOBAL PARAMETERS</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:24, alignItems:"flex-start" }}>
          {/* Service level */}
          <div style={{ minWidth:280 }}>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:10 }}>SERVICE LEVEL (Z-SCORE)</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {SERVICE_LEVELS.map((sl,i)=>(
                <button key={i} onClick={()=>setServiceIdx(i)} style={{ background:serviceIdx===i?C.gold:C.dark, color:serviceIdx===i?C.dark:C.muted, border:`1px solid ${serviceIdx===i?C.gold:C.mid}`, borderRadius:8, padding:"6px 14px", fontSize:12, fontFamily:mono, cursor:"pointer" }}>{sl.label}</button>
              ))}
            </div>
            <div style={{ color:C.muted, fontSize:11, fontFamily:mono, marginTop:6 }}>{SERVICE_LEVELS[serviceIdx].desc} · Z = {zScore.toFixed(2)}</div>
          </div>
          {/* Demand variability */}
          <div style={{ minWidth:190 }}>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:8 }}>DEMAND VARIABILITY (CV%)</div>
            <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid ${C.gold}44`, borderRadius:8, overflow:"hidden", marginBottom:6 }}>
              <input type="number" min={5} max={80} step={1} value={demandCV} onChange={e=>setDemandCV(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:C.amber, padding:"7px 12px", fontSize:14, fontFamily:mono, fontWeight:700, width:60 }}/>
              <span style={{ color:C.muted, padding:"7px 10px", fontSize:12, fontFamily:mono }}>% σ of d</span>
            </div>
            <input type="range" min={5} max={80} step={1} value={demandCV} onChange={e=>setDemandCV(Number(e.target.value))} style={{ accentColor:C.amber, cursor:"pointer", width:"100%" }}/>
          </div>
          {/* Lead time sigma */}
          <div style={{ minWidth:190 }}>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:8 }}>LEAD TIME STD DEV</div>
            <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid ${C.gold}44`, borderRadius:8, overflow:"hidden", marginBottom:6 }}>
              <input type="number" min={0} max={20} step={1} value={leadTimeSigma} onChange={e=>setLeadTimeSigma(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:"#64B5F6", padding:"7px 12px", fontSize:14, fontFamily:mono, fontWeight:700, width:60 }}/>
              <span style={{ color:C.muted, padding:"7px 10px", fontSize:12, fontFamily:mono }}>days σLT</span>
            </div>
            <input type="range" min={0} max={20} step={1} value={leadTimeSigma} onChange={e=>setLeadTimeSigma(Number(e.target.value))} style={{ accentColor:"#64B5F6", cursor:"pointer", width:"100%" }}/>
          </div>
          {/* EOQ inputs */}
          <div style={{ minWidth:190 }}>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:8 }}>ORDERING COST PER PO (SAR)</div>
            <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid #CE93D844`, borderRadius:8, overflow:"hidden", marginBottom:6 }}>
              <input type="number" min={100} max={20000} step={100} value={orderingCost} onChange={e=>setOrderingCost(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:"#CE93D8", padding:"7px 12px", fontSize:14, fontFamily:mono, fontWeight:700, width:80 }}/>
              <span style={{ color:C.muted, padding:"7px 8px", fontSize:12, fontFamily:mono }}>SAR</span>
            </div>
            <input type="range" min={100} max={20000} step={100} value={orderingCost} onChange={e=>setOrderingCost(Number(e.target.value))} style={{ accentColor:"#CE93D8", cursor:"pointer", width:"100%" }}/>
          </div>
          <div style={{ minWidth:175 }}>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:8 }}>HOLDING COST RATE (%/yr)</div>
            <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid #81C78444`, borderRadius:8, overflow:"hidden", marginBottom:6 }}>
              <input type="number" min={5} max={50} step={1} value={holdingRate} onChange={e=>setHoldingRate(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:"#81C784", padding:"7px 12px", fontSize:14, fontFamily:mono, fontWeight:700, width:60 }}/>
              <span style={{ color:C.muted, padding:"7px 8px", fontSize:12, fontFamily:mono }}>% of cost</span>
            </div>
            <input type="range" min={5} max={50} step={1} value={holdingRate} onChange={e=>setHoldingRate(Number(e.target.value))} style={{ accentColor:"#81C784", cursor:"pointer", width:"100%" }}/>
          </div>
          {/* Formula box */}
          <div style={{ padding:"12px 16px", background:C.dark, border:`1px solid ${C.mid}`, borderRadius:10, fontSize:11, fontFamily:mono, color:C.muted, lineHeight:1.9 }}>
            <div style={{ color:C.gold, fontSize:10, marginBottom:6, letterSpacing:2 }}>FORMULAS</div>
            <div><span style={{ color:"#81C784" }}>SS</span> = Z × √(LT×σd² + d²×σLT²)</div>
            <div><span style={{ color:C.amber }}>ROP</span> = (d × LT) + SS</div>
            <div><span style={{ color:"#CE93D8" }}>EOQ</span> = √(2 × D × S / H)</div>
            <div style={{ color:"#4B6B52", fontSize:10, marginTop:4 }}>D=annual demand · S=order cost · H=holding/unit/yr</div>
          </div>
        </div>
      </div>
      {/* SKU table */}
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2 }}>ALL SKUs · CLICK ROW FOR DEEP DIVE</div>
          <ExportButton onClick={doExport} />
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:mono, fontSize:12 }}>
            <thead><tr style={{ borderBottom:`1px solid ${C.gold}44` }}>
              {[{h:"SKU",c:C.gold},{h:"Product",c:C.gold},{h:"Velocity",c:C.gold},{h:"Avg Daily",c:C.muted},{h:"LT (d)",c:"#64B5F6"},{h:"SS",c:"#F44336"},{h:"ROP",c:C.amber},{h:"Max",c:"#4CAF50"},{h:"Stock",c:C.cream},{h:"EOQ",c:"#CE93D8"},{h:"Orders/yr",c:"#CE93D8"},{h:"Annual Cost",c:C.gold},{h:"Wks→ROP",c:C.amber},{h:"Status",c:C.gold}].map((col,i)=>(
                <th key={i} style={{ color:col.c, padding:"9px 10px", textAlign:"right", letterSpacing:1, fontWeight:500, whiteSpace:"nowrap" }}>{col.h}</th>
              ))}
            </tr></thead>
            <tbody>{skuData.map(p=>(
              <tr key={p.sku} onClick={()=>setSelectedSku(selectedSku===p.sku?null:p.sku)}
                style={{ borderBottom:`1px solid ${C.mid}`, cursor:"pointer", background:selectedSku===p.sku?"#152A1C":"transparent" }}>
                <td style={{ padding:"10px",color:C.muted,textAlign:"right" }}>{p.sku}</td>
                <td style={{ padding:"10px",color:C.cream,textAlign:"right",fontWeight:600 }}>{p.name}</td>
                <td style={{ padding:"10px",textAlign:"right" }}><span style={{ color:p.velocity==="High"?"#4CAF50":p.velocity==="Medium"?C.amber:"#F4A261" }}>{p.velocity}</span></td>
                <td style={{ padding:"10px",color:C.sage,  textAlign:"right" }}>{p.avgDaily.toFixed(2)}</td>
                <td style={{ padding:"10px",color:"#64B5F6",textAlign:"right" }}>{p.leadDays}d</td>
                <td style={{ padding:"10px",color:"#F44336",textAlign:"right",fontWeight:700 }}>{p.ss}</td>
                <td style={{ padding:"10px",color:C.amber,  textAlign:"right",fontWeight:700 }}>{p.rop}</td>
                <td style={{ padding:"10px",color:"#4CAF50",textAlign:"right" }}>{p.maxStock}</td>
                <td style={{ padding:"10px",color:C.cream,  textAlign:"right",fontWeight:600 }}>{p.stock}</td>
                <td style={{ padding:"10px",color:"#CE93D8",textAlign:"right",fontWeight:700 }}>{p.eoq}</td>
                <td style={{ padding:"10px",color:"#CE93D8",textAlign:"right" }}>{p.ordersPerYear}×</td>
                <td style={{ padding:"10px",color:C.gold,   textAlign:"right" }}>SAR {(p.total/1000).toFixed(1)}K</td>
                <td style={{ padding:"10px",color:p.weeksToROP>0?C.amber:"#F44336",textAlign:"right" }}>{p.weeksToROP>0?`${p.weeksToROP}wk`:"NOW"}</td>
                <td style={{ padding:"10px",textAlign:"right" }}><span style={{ color:sCol[p.status],fontWeight:700,fontSize:11 }}>● {sLbl[p.status]}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {/* Deep dive */}
      {sel && (
        <div style={{ background:C.panel, border:`2px solid ${sCol[sel.status]}44`, borderRadius:14, padding:24, marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18 }}>
            <div>
              <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2 }}>DEEP DIVE — {sel.sku} · {sel.name}</div>
              <div style={{ color:sCol[sel.status], fontSize:13, fontFamily:mono, fontWeight:700, marginTop:3 }}>● {sLbl[sel.status]}</div>
            </div>
            <button onClick={()=>setSelectedSku(null)} style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))", gap:12, marginBottom:22 }}>
            {[
              { label:"Safety Stock",    value:sel.ss,           unit:" u",   color:"#F44336", sub:`${sel.daysOfSS}d of demand` },
              { label:"Reorder Point",   value:sel.rop,          unit:" u",   color:C.amber,   sub:"Place PO at this level" },
              { label:"EOQ",             value:sel.eoq,          unit:" u",   color:"#CE93D8", sub:`${sel.cycleDays}d cycle time` },
              { label:"Orders / Year",   value:sel.ordersPerYear,unit:"×",    color:"#CE93D8", sub:"Optimal order frequency" },
              { label:"Annual Ordering", value:`SAR ${(sel.annualOrdering/1000).toFixed(1)}K`,unit:"",color:C.rust,sub:"Cost to place POs" },
              { label:"Annual Holding",  value:`SAR ${(sel.annualHolding/1000).toFixed(1)}K`, unit:"",color:C.amber,sub:`${holdingRate}% of avg stock` },
              { label:"Total Inv. Cost", value:`SAR ${(sel.total/1000).toFixed(1)}K`,         unit:"",color:C.gold,sub:"Ordering + holding" },
              { label:"Current Stock",   value:sel.stock,        unit:" u",   color:C.cream,   sub:`vs ROP ${sel.rop}` },
            ].map((m,i)=>(
              <div key={i} style={{ background:C.dark, border:`1px solid ${m.color}33`, borderRadius:10, padding:"13px 14px" }}>
                <div style={{ color:C.muted, fontSize:9, fontFamily:mono, letterSpacing:1, marginBottom:6 }}>{m.label}</div>
                <div style={{ color:m.color, fontSize:20, fontWeight:700, fontFamily:serif, lineHeight:1 }}>{typeof m.value==="number"?m.value.toLocaleString():m.value}{m.unit}</div>
                <div style={{ color:"#4B6B52", fontSize:10, marginTop:5 }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background:C.dark, border:`1px solid ${C.mid}`, borderRadius:10, padding:"16px 18px", marginBottom:16 }}>
            <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:20 }}>STOCK POSITION GAUGE</div>
            <GaugeBar stock={sel.stock} ss={sel.ss} rop={sel.rop} maxStock={sel.maxStock} />
            <div style={{ display:"flex", gap:16, marginTop:22, flexWrap:"wrap" }}>
              {[{col:"#F4433640",bdr:"#F44336",lbl:`Below SS (0–${sel.ss})`,desc:"Critical — stockout risk"},
                {col:"#FF704320",bdr:"#FF7043",lbl:`SS→ROP (${sel.ss}–${sel.rop})`,desc:"Must reorder now"},
                {col:"#4CAF5020",bdr:"#4CAF50",lbl:`ROP→Max (${sel.rop}–${sel.maxStock})`,desc:"Healthy"},
              ].map((z,i)=>(
                <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ width:14, height:14, background:z.col, border:`1px solid ${z.bdr}`, borderRadius:3 }}/>
                  <div><div style={{ color:C.cream, fontSize:11, fontFamily:mono }}>{z.lbl}</div><div style={{ color:C.muted, fontSize:10 }}>{z.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
          {/* Calc breakdown */}
          <div style={{ background:C.dark, border:`1px solid ${C.mid}`, borderRadius:10, padding:"16px 18px" }}>
            <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:12 }}>CALCULATION BREAKDOWN</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <div style={{ color:"#81C784", fontSize:11, fontFamily:mono, marginBottom:8 }}>SAFETY STOCK INPUTS</div>
                {[
                  {k:"Avg Daily Demand (d)",   v:`${sel.avgDaily.toFixed(3)} u/day`},
                  {k:"Demand Std Dev (σd)",     v:`${sel.sigmaD.toFixed(3)} u/day`},
                  {k:"Lead Time (LT)",          v:`${sel.leadDays} days`},
                  {k:"Lead Time σ (σLT)",       v:`${leadTimeSigma} days`},
                  {k:`Z (${SERVICE_LEVELS[serviceIdx].label})`,v:zScore.toFixed(2)},
                ].map((r,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.mid}` }}>
                    <span style={{ color:C.muted, fontSize:11 }}>{r.k}</span>
                    <span style={{ color:C.cream, fontSize:11, fontFamily:mono, fontWeight:600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color:"#CE93D8", fontSize:11, fontFamily:mono, marginBottom:8 }}>EOQ INPUTS</div>
                {[
                  {k:"Annual Demand (D)",        v:`${sel.annualDemand} units`},
                  {k:"Ordering Cost (S)",         v:`SAR ${orderingCost.toLocaleString()}`},
                  {k:"Holding Rate",              v:`${holdingRate}% of SAR ${sel.cost}`},
                  {k:"Holding Cost/unit/yr (H)",  v:`SAR ${(sel.cost*holdingRate/100).toFixed(0)}`},
                  {k:"EOQ = √(2DS/H)",            v:`${sel.eoq} units`},
                ].map((r,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.mid}` }}>
                    <span style={{ color:C.muted, fontSize:11 }}>{r.k}</span>
                    <span style={{ color:"#CE93D8", fontSize:11, fontFamily:mono, fontWeight:600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Summary chart */}
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:22 }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:14 }}>SS · ROP · EOQ · CURRENT STOCK — ALL SKUs</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={skuData.map(p=>({ name:p.sku, "Safety Stock":p.ss, "Reorder Point":p.rop, "EOQ":p.eoq, "Current Stock":p.stock }))} margin={{ top:10,right:10,left:10,bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="name" stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/>
            <Tooltip {...TT}/><Legend wrapperStyle={{ fontSize:11,fontFamily:mono }}/>
            <Bar dataKey="Safety Stock"  fill="#F44336" radius={[3,3,0,0]}/>
            <Bar dataKey="Reorder Point" fill={C.amber} radius={[3,3,0,0]}/>
            <Bar dataKey="EOQ"           fill="#CE93D8" radius={[3,3,0,0]}/>
            <Bar dataKey="Current Stock" fill="#4CAF50" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── TAB: SCENARIO COMPARISON (NEW) ──────────────────────────────────────────
function ScenarioTab({ onLoadScenario }) {
  const [metric, setMetric] = useState("revenue");

  const scenarios = useMemo(() => PRESET_SCENARIOS.map(s => {
    const data = buildFinancials(s.inputs.investment, s.inputs.sellPrice, s.inputs.productCost, s.alloc, s.inputs.reinvestRate);
    const bm   = data.findIndex(d=>d.profit>0);
    const y1   = data.slice(0,12).reduce((sum,d)=>sum+d.revenue,0);
    const y2   = data.slice(12).reduce((sum,d)=>sum+d.revenue,0);
    const totalProfit = data.reduce((sum,d)=>sum+d.profit,0);
    const finalCash   = data[data.length-1].cumulativeCash;
    const margin      = s.inputs.sellPrice > 0 ? ((s.inputs.sellPrice-s.inputs.productCost)/s.inputs.sellPrice*100).toFixed(1) : 0;
    const roi         = ((finalCash-s.inputs.investment)/s.inputs.investment*100).toFixed(1);
    const effRate     = getEffectiveReinvestRate(s.inputs.reinvestRate, s.inputs.sellPrice, s.inputs.productCost);
    return { ...s, data, bm, y1, y2, totalProfit, finalCash, margin, roi, effRate };
  }), []);

  const chartData = MONTHS.map((month, i) => {
    const row = { month };
    scenarios.forEach(s => { row[s.name] = s.data[i][metric]; });
    return row;
  });

  const KPIRow = ({ label, fn, fmt = v => v }) => (
    <tr style={{ borderBottom:`1px solid ${C.mid}` }}>
      <td style={{ padding:"9px 14px", color:C.muted, fontSize:12, fontFamily:mono }}>{label}</td>
      {scenarios.map((s,i) => (
        <td key={i} style={{ padding:"9px 14px", textAlign:"center", fontFamily:mono, fontWeight:600, fontSize:13 }}>
          <span style={{ color:s.color }}>{fmt(fn(s))}</span>
        </td>
      ))}
    </tr>
  );

  return (
    <div>
      <SectionTitle title="Scenario Comparison" sub="Conservative · Base · Aggressive · Load Any to Simulator" />

      {/* Scenario cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
        {scenarios.map((s,i) => (
          <div key={i} style={{ background:C.panel, border:`2px solid ${s.color}44`, borderRadius:14, padding:22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:22 }}>{s.badge}</div>
                <div style={{ color:s.color, fontSize:16, fontWeight:700, fontFamily:serif, marginTop:4 }}>{s.name}</div>
              </div>
              <div style={{ padding:"4px 10px", background:`${s.color}18`, border:`1px solid ${s.color}44`, borderRadius:20 }}>
                <span style={{ color:s.color, fontSize:10, fontFamily:mono }}>{s.margin}% GM</span>
              </div>
            </div>
            <div style={{ color:C.muted, fontSize:11, marginBottom:16, lineHeight:1.6 }}>{s.desc}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              {[
                {k:"Investment",    v:`SAR ${(s.inputs.investment/1e6).toFixed(2)}M`},
                {k:"Breakeven",     v:s.bm>=0?`Month ${s.bm+1}`:"N/A"},
                {k:"Y1 Revenue",    v:`SAR ${(s.y1/1000).toFixed(0)}K`},
                {k:"Y2 Revenue",    v:`SAR ${(s.y2/1e6).toFixed(2)}M`},
                {k:"24M Profit",    v:`SAR ${(s.totalProfit/1000).toFixed(0)}K`},
                {k:"24M ROI",       v:`${s.roi}%`},
                {k:"Eff. Reinvest", v:`${(s.effRate*100).toFixed(0)}%`},
                {k:"Sell Price",    v:`SAR ${s.inputs.sellPrice}`},
              ].map((r,j)=>(
                <div key={j} style={{ background:C.dark, borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ color:C.muted, fontSize:9, fontFamily:mono }}>{r.k}</div>
                  <div style={{ color:s.color, fontSize:12, fontFamily:mono, fontWeight:700, marginTop:2 }}>{r.v}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>onLoadScenario(s)}
              style={{ width:"100%", background:`${s.color}18`, border:`1px solid ${s.color}66`, borderRadius:10, padding:"10px 0", color:s.color, fontSize:12, fontFamily:mono, fontWeight:700, cursor:"pointer", transition:"all 0.18s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background=`${s.color}30`; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=`${s.color}18`; }}>
              ⤴ Load {s.name} Scenario
            </button>
          </div>
        ))}
      </div>

      {/* Overlay chart */}
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:24, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2 }}>24-MONTH OVERLAY CHART</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["revenue","Revenue"],["profit","Profit"],["cumulativeCash","Cash Balance"],["cogs","COGS"]].map(([k,v])=>(
              <button key={k} onClick={()=>setMetric(k)} style={{ background:metric===k?C.gold:C.dark, color:metric===k?C.dark:C.muted, border:`1px solid ${metric===k?C.gold:C.mid}`, borderRadius:8, padding:"5px 12px", fontSize:11, fontFamily:mono, cursor:"pointer" }}>{v}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top:5,right:10,left:10,bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.mid}/>
            <XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/>
            <YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={sarFmt}/>
            <Tooltip {...TT} formatter={(v,n)=>[sarFmt(v),n]}/>
            <Legend wrapperStyle={{ fontSize:11,fontFamily:mono }}/>
            {scenarios.map((s,i)=>(
              <Line key={s.id} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2.5} dot={false}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* KPI comparison table */}
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:22 }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:14 }}>FULL KPI COMPARISON TABLE</div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.gold}44` }}>
              <th style={{ padding:"10px 14px", textAlign:"left", color:C.muted, fontFamily:mono, fontSize:11 }}>Metric</th>
              {scenarios.map((s,i)=>(
                <th key={i} style={{ padding:"10px 14px", textAlign:"center", color:s.color, fontFamily:mono, fontSize:12 }}>{s.badge} {s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <KPIRow label="Investment"           fn={s=>`SAR ${(s.inputs.investment/1e6).toFixed(2)}M`}      fmt={v=>v} />
            <KPIRow label="Gross Margin"         fn={s=>`${s.margin}%`}                                      fmt={v=>v} />
            <KPIRow label="Effective Reinvest"   fn={s=>`${(s.effRate*100).toFixed(0)}%`}                    fmt={v=>v} />
            <KPIRow label="Breakeven Month"      fn={s=>s.bm>=0?`Month ${s.bm+1}`:"N/A"}                    fmt={v=>v} />
            <KPIRow label="Year 1 Revenue"       fn={s=>`SAR ${(s.y1/1000).toFixed(0)}K`}                   fmt={v=>v} />
            <KPIRow label="Year 2 Revenue"       fn={s=>`SAR ${(s.y2/1e6).toFixed(2)}M`}                    fmt={v=>v} />
            <KPIRow label="24M Cumulative Profit" fn={s=>`SAR ${(s.totalProfit/1000).toFixed(0)}K`}         fmt={v=>v} />
            <KPIRow label="Closing Cash (M24)"   fn={s=>`SAR ${(s.finalCash/1e6).toFixed(2)}M`}             fmt={v=>v} />
            <KPIRow label="24M ROI"              fn={s=>`${s.roi}%`}                                         fmt={v=>v} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: MARKETING ───────────────────────────────────────────────────────────
function MarketingTab({ budget }) {
  const mktBudget = budget.find(b=>b.key==="marketing")?.value||180000;
  const mktPct    = budget.find(b=>b.key==="marketing")?.pct||18;
  const channels  = [
    { channel:"Instagram",           share:0.222, reach:"200K-400K", roi:"3.2x", type:"Organic + Paid",       kpi:"Followers, Saves, DMs" },
    { channel:"Snapchat",            share:0.194, reach:"150K-300K", roi:"2.8x", type:"Paid Ads",             kpi:"Swipe-ups, Conversions" },
    { channel:"TikTok",              share:0.111, reach:"300K-600K", roi:"4.1x", type:"Organic + Influencer", kpi:"Views, Shares, Clicks" },
    { channel:"Influencers (Mega)",  share:0.222, reach:"500K-1M",   roi:"2.5x", type:"Paid Partnership",     kpi:"Awareness, Sales Spike" },
    { channel:"Influencers (Micro)", share:0.167, reach:"200K-500K", roi:"5.2x", type:"Gifting + Fee",        kpi:"Conversions, UGC" },
    { channel:"WhatsApp / CRM",      share:0.083, reach:"All customers",roi:"8.0x",type:"Retention",          kpi:"Repeat Rate, LTV" },
  ].map((c,i)=>({ ...c, budget:Math.round(mktBudget*c.share), color:PALETTE[i] }));
  return (
    <div>
      <SectionTitle title="Marketing & Growth Plan" sub="Influencer-Led · Budget Scales Live" />
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:20 }}>
        <KPICard label="Marketing Budget" value={`SAR ${(mktBudget/1000).toFixed(0)}K`} sub={`${mktPct.toFixed(1)}% of investment`} />
        <KPICard label="Primary Channels" value="Instagram + Snap" sub="+ TikTok" accent={C.forest} />
        <KPICard label="Influencer Tiers" value="Mega + Micro" sub="20-30 creators" accent={C.amber} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {channels.map((c,i)=>(
          <div key={i} style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:12, padding:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <span style={{ color:C.cream, fontWeight:700, fontSize:14 }}>{c.channel}</span>
              <span style={{ background:C.mid, color:C.amber, fontSize:9, padding:"2px 7px", borderRadius:4, fontFamily:mono }}>{c.type}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {[{k:"Budget",v:`SAR ${(c.budget/1000).toFixed(1)}K`},{k:"ROI",v:c.roi},{k:"Reach",v:c.reach},{k:"KPI",v:c.kpi}].map((r,j)=>(
                <div key={j}><div style={{ color:C.muted, fontSize:9, fontFamily:mono }}>{r.k}</div><div style={{ color:C.gold, fontSize:11, fontFamily:mono, marginTop:2 }}>{r.v}</div></div>
              ))}
            </div>
            <div style={{ height:4, background:C.mid, borderRadius:2 }}>
              <div style={{ height:4, background:c.color, borderRadius:2, width:`${c.share*100}%` }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB: INVENTORY ───────────────────────────────────────────────────────────
function InventoryTab({ data, inputs, budget, overrides }) {
  const { productCost } = inputs;
  const invBudget    = budget.find(b=>b.key==="inventory")?.value||350000;
  const invPct       = budget.find(b=>b.key==="inventory")?.pct||35;
  const initialUnits = Math.round(invBudget/Math.max(1,productCost));
  const avgLeadDays  = Math.round(Object.values(overrides).reduce((s,o)=>s+o.leadDays,0)/Object.keys(overrides).length);
  const maxLeadDays  = Math.max(...Object.values(overrides).map(o=>o.leadDays));
  return (
    <div>
      <SectionTitle title="Inventory Planning & Logistics" sub="Self-Fulfillment · China Import · Riyadh" />
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:20 }}>
        <KPICard label="Inventory Budget"  value={`SAR ${(invBudget/1000).toFixed(0)}K`} sub={`${invPct.toFixed(1)}% of investment`} />
        <KPICard label="Initial Units"     value={initialUnits.toLocaleString()} sub={`@ SAR ${productCost}/unit`} accent={C.forest} />
        <KPICard label="Avg Lead Time"     value={`${avgLeadDays} days`} sub="Across all SKUs" accent={C.amber} />
        <KPICard label="Max Lead Time"     value={`${maxLeadDays} days`} sub="Longest SKU" accent={C.rust} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:20, marginBottom:18 }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:14 }}>LEAD TIME PER SKU</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
          {BASE_PRODUCTS.map(p => {
            const ov = overrides[p.sku], col = ov.leadDays>42?"#F44336":ov.leadDays>35?C.amber:"#4CAF50";
            return (
              <div key={p.sku} style={{ background:C.dark, border:`1px solid ${col}33`, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ color:C.muted, fontSize:9, fontFamily:mono, marginBottom:4 }}>{p.sku}</div>
                <div style={{ color:C.cream, fontSize:13, fontWeight:600, marginBottom:2 }}>{p.name.split(" ").slice(0,2).join(" ")}</div>
                <div style={{ color:col, fontSize:18, fontWeight:700, fontFamily:serif }}>{ov.leadDays}d</div>
                <div style={{ color:C.muted, fontSize:10, marginTop:3 }}>{p.supplier.split(" ")[0]}</div>
                <div style={{ height:3, background:C.mid, borderRadius:2, marginTop:8 }}><div style={{ height:3, background:col, borderRadius:2, width:`${(ov.leadDays/120)*100}%` }}/></div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
        <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:20 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:14 }}>CHINA IMPORT FLOW (AVG {avgLeadDays}d)</div>
          {[
            {s:"01",l:"PO Placed",    d:"30% deposit via TT",            t:"Day 0"},
            {s:"02",l:"Production",   d:"Factory manufacturing",          t:`Day 1–${Math.round(avgLeadDays*0.45)}`},
            {s:"03",l:"QC Inspection",d:"3rd-party inspection",           t:`Day ${Math.round(avgLeadDays*0.42)}–${Math.round(avgLeadDays*0.47)}`},
            {s:"04",l:"Ex-Factory",   d:"70% balance paid",               t:`Day ${Math.round(avgLeadDays*0.48)}`},
            {s:"05",l:"Sea Freight",  d:"LCL to Jeddah / Dammam port",    t:`Day ${Math.round(avgLeadDays*0.50)}–${Math.round(avgLeadDays*0.82)}`},
            {s:"06",l:"Customs",      d:"SASO + ZATCA clearance",          t:`Day ${Math.round(avgLeadDays*0.83)}–${Math.round(avgLeadDays*0.95)}`},
            {s:"07",l:"Last Mile",    d:"Port to Riyadh warehouse",        t:`Day ${Math.round(avgLeadDays*0.96)}–${avgLeadDays}`},
          ].map((step,i)=>(
            <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:11 }}>
              <span style={{ color:C.gold, fontFamily:mono, fontSize:10, minWidth:22 }}>{step.s}</span>
              <div style={{ flex:1, borderLeft:i<6?"1px dashed #1A3A2A":"none", paddingLeft:12 }}>
                <div style={{ color:C.cream, fontSize:12, fontWeight:600 }}>{step.l}</div>
                <div style={{ color:C.muted, fontSize:10 }}>{step.d} <span style={{ color:C.amber }}>{step.t}</span></div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:20 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:14 }}>WAREHOUSE ZONES</div>
          {[
            {a:"Receiving & QC",    s:"80 sqm",  d:"Inbound inspection, unpacking, tagging"},
            {a:"Bulk Storage",      s:"350 sqm", d:"Pallet racking, high-bay shelving"},
            {a:"Pick & Pack",       s:"120 sqm", d:"Order fulfillment workstations"},
            {a:"Outbound/Dispatch", s:"80 sqm",  d:"Sorted parcels, last-mile handover"},
            {a:"Returns",           s:"40 sqm",  d:"Inspection, restock or write-off"},
            {a:"Office & WMS",      s:"30 sqm",  d:"System dashboard, team workspace"},
          ].map((w,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.mid}` }}>
              <div><div style={{ color:C.cream, fontSize:12, fontWeight:600 }}>{w.a}</div><div style={{ color:"#4B6B52", fontSize:10 }}>{w.d}</div></div>
              <span style={{ color:C.amber, fontSize:11, fontFamily:mono, alignSelf:"center", marginLeft:10 }}>{w.s}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:22 }}>
        <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:12 }}>24-MONTH INVENTORY VALUE</div>
        <ResponsiveContainer width="100%" height={185}>
          <AreaChart data={data}>
            <defs><linearGradient id="iG2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.amber} stopOpacity={0.3}/><stop offset="95%" stopColor={C.amber} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="month" stroke={C.muted} tick={{ fontSize:9,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:9,fill:C.muted }} tickFormatter={sarFmt}/>
            <Tooltip {...TT} formatter={v=>sarFmt(v)}/><Area type="monotone" dataKey="inventory" name="Inventory Value" stroke={C.amber} fill="url(#iG2)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── TAB: 90-DAY CASH FLOW ───────────────────────────────────────────────────
function build90Day(inputs, overrides, startingCash, plannedExpenses) {
  const { sellPrice, productCost } = inputs;
  const skus = BASE_PRODUCTS.map(p => {
    const ov = overrides[p.sku], monthly = p.velocity==="High"?80:p.velocity==="Medium"?40:15, daily = monthly/30;
    return { ...p, ...ov, price:Math.round(sellPrice*p.priceMult), cost:Math.round(productCost*p.costMult), daily, rop:Math.ceil(daily*ov.leadDays*1.2), currentStock:ov.stock };
  });
  let cashBalance = startingCash;
  const weeks = [], pendingPOs = [], skuState = skus.map(s=>({...s}));
  const weeklyOpex = Math.round((inputs.investment*0.055)/52);
  for (let w = 0; w < 13; w++) {
    let weekRevenue=0, weekCOGS=0, weekPODeposit=0, weekPOBalance=0;
    const triggeredPOs=[], arrivingPOs=[];
    skuState.forEach(s=>{ const sold=Math.round(s.daily*7); weekRevenue+=sold*s.price; weekCOGS+=sold*s.cost; s.currentStock=Math.max(0,s.currentStock-sold); });
    skuState.forEach(s=>{
      if (s.currentStock<=s.rop && !pendingPOs.find(po=>po.sku===s.sku&&po.balancePaidWeek===null)) {
        const tc=s.moq*s.cost, dep=Math.round(tc*0.30), bal=tc-dep, lw=Math.ceil(s.leadDays/7);
        weekPODeposit+=dep; cashBalance-=dep;
        pendingPOs.push({ sku:s.sku, name:s.name, units:s.moq, totalCost:tc, deposit:dep, balance:bal, dueWeek:w+lw, depositWeek:w, balancePaidWeek:null });
        triggeredPOs.push({ sku:s.sku, units:s.moq, deposit:dep, arrivalWeek:w+lw, leadWeeks:lw });
      }
    });
    pendingPOs.forEach(po=>{
      if (po.dueWeek===w && po.balancePaidWeek===null) {
        po.balancePaidWeek=w; weekPOBalance+=po.balance; cashBalance-=po.balance;
        const sk=skuState.find(s=>s.sku===po.sku); if(sk){sk.currentStock+=po.units;}
        arrivingPOs.push({ sku:po.sku, units:po.units, balance:po.balance });
      }
    });
    const plannedThisWeek = plannedExpenses.filter(e=>e.week===w+1);
    const plannedTotal    = plannedThisWeek.reduce((s,e)=>s+e.amount,0);
    cashBalance+=weekRevenue; cashBalance-=weeklyOpex; cashBalance-=plannedTotal;
    const netFlow = weekRevenue - weeklyOpex - weekPODeposit - weekPOBalance - plannedTotal;
    weeks.push({
      week:`W${w+1}`, dayRange:`Day ${w*7+1}–${w*7+7}`,
      revenue:weekRevenue, cogs:weekCOGS, opex:weeklyOpex,
      poDeposit:weekPODeposit, poBalance:weekPOBalance,
      planned:plannedTotal, totalOut:weeklyOpex+weekPODeposit+weekPOBalance+plannedTotal,
      netFlow, cashBalance:Math.round(cashBalance),
      triggeredPOs, arrivingPOs, plannedThisWeek,
      stockSnapshot:skuState.map(s=>({ sku:s.sku, name:s.name, stock:Math.round(s.currentStock), rop:s.rop })),
    });
  }
  return { weeks, finalPOs:pendingPOs };
}
const DEFAULT_PLANNED = [
  { id:1, week:2, label:"Influencer Campaign",  amount:15000, color:"#CE93D8" },
  { id:2, week:5, label:"China PO (extra MOQ)", amount:28000, color:"#64B5F6" },
  { id:3, week:9, label:"Warehouse Rental Q2",  amount:22000, color:C.amber   },
];
function CashFlow90Tab({ inputs, overrides, startingCash, onStartingCash }) {
  const [plannedExpenses, setPlannedExpenses] = useState(DEFAULT_PLANNED);
  const [newLabel, setNewLabel] = useState(""), [newWeek, setNewWeek] = useState(1), [newAmount, setNewAmount] = useState(10000), [nextId, setNextId] = useState(4);
  const [viewMode, setViewMode] = useState("chart"), [hoveredWeek, setHoveredWeek] = useState(null);
  const { weeks, finalPOs } = useMemo(()=>build90Day(inputs,overrides,startingCash,plannedExpenses),[inputs,overrides,startingCash,plannedExpenses]);
  const totalRevenue=weeks.reduce((s,w)=>s+w.revenue,0), totalOut=weeks.reduce((s,w)=>s+w.totalOut,0);
  const totalDeposits=weeks.reduce((s,w)=>s+w.poDeposit,0), totalBalances=weeks.reduce((s,w)=>s+w.poBalance,0);
  const lowestBal=Math.min(...weeks.map(w=>w.cashBalance)), endBalance=weeks[weeks.length-1]?.cashBalance??startingCash;
  const critWeeks=weeks.filter(w=>w.cashBalance<startingCash*0.15).length;
  const addExpense = () => {
    if (!newLabel.trim()||newAmount<=0) return;
    const colors=["#CE93D8","#64B5F6",C.amber,"#81C784","#F44336","#FF7043",C.gold];
    setPlannedExpenses(p=>[...p,{id:nextId,week:newWeek,label:newLabel.trim(),amount:newAmount,color:colors[nextId%colors.length]}]);
    setNextId(n=>n+1); setNewLabel(""); setNewAmount(10000); setNewWeek(1);
  };
  const doExport = () => exportToCSV("cashflow_90day.csv",[
    {label:"Week",k:"week"},{label:"Revenue",k:"revenue",fmt:v=>v.toFixed(0)},
    {label:"PO Deposit",k:"poDeposit",fmt:v=>v.toFixed(0)},{label:"PO Balance",k:"poBalance",fmt:v=>v.toFixed(0)},
    {label:"OpEx",k:"opex",fmt:v=>v.toFixed(0)},{label:"Planned",k:"planned",fmt:v=>v.toFixed(0)},
    {label:"Total Out",k:"totalOut",fmt:v=>v.toFixed(0)},{label:"Net Flow",k:"netFlow",fmt:v=>v.toFixed(0)},
    {label:"Cash Balance",k:"cashBalance",fmt:v=>v.toFixed(0)},
  ], weeks);
  const cd = weeks.map(w=>({ week:w.week, Revenue:w.revenue, "PO Deposit":w.poDeposit, "PO Balance":w.poBalance, OpEx:w.opex, Planned:w.planned, "Cash Bal":w.cashBalance, "Net Flow":w.netFlow }));
  return (
    <div>
      <SectionTitle title="90-Day Cash Flow" sub="13 Weeks · Auto PO Triggers · Live Inputs" />
      <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:22 }}>
        <KPICard label="Starting Balance"  value={`SAR ${(startingCash/1000).toFixed(0)}K`}  sub="Editable below" />
        <KPICard label="90-Day Revenue"    value={`SAR ${(totalRevenue/1000).toFixed(0)}K`}   sub="13-week" accent={C.forest} />
        <KPICard label="PO Payments"       value={`SAR ${((totalDeposits+totalBalances)/1000).toFixed(0)}K`} sub="Deposits + balances" accent={"#64B5F6"} />
        <KPICard label="Closing Balance"   value={`SAR ${(endBalance/1000).toFixed(0)}K`}     sub="End of W13" accent={endBalance>startingCash*0.5?"#4CAF50":"#F44336"} />
        <KPICard label="Lowest Balance"    value={`SAR ${(lowestBal/1000).toFixed(0)}K`}      accent={lowestBal<0?"#F44336":lowestBal<startingCash*0.2?C.amber:"#4CAF50"} />
        <KPICard label="Cash-Tight Weeks"  value={critWeeks} sub="< 15% of start" accent={critWeeks>0?"#F44336":C.forest} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
        <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:20 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:12 }}>STARTING CASH</div>
          <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid ${C.gold}44`, borderRadius:8, overflow:"hidden", marginBottom:8 }}>
            <span style={{ color:C.gold, padding:"8px 12px", fontSize:12, fontFamily:mono, background:"#0D1F16", borderRight:`1px solid ${C.gold}22` }}>SAR</span>
            <input type="number" min={10000} max={5000000} step={10000} value={startingCash} onChange={e=>onStartingCash(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:C.cream, padding:"8px 12px", fontSize:14, fontFamily:mono, fontWeight:700, width:"100%" }}/>
          </div>
          <input type="range" min={10000} max={2000000} step={10000} value={startingCash} onChange={e=>onStartingCash(Number(e.target.value))} style={{ accentColor:C.gold, cursor:"pointer", width:"100%" }}/>
          <div style={{ marginTop:12, padding:"10px 14px", background:C.dark, borderRadius:8, border:`1px solid ${endBalance>0?"#4CAF50":"#F44336"}33` }}>
            <div style={{ color:C.muted, fontSize:10, fontFamily:mono, marginBottom:4 }}>90-DAY NET CHANGE</div>
            <div style={{ color:endBalance>=startingCash?"#4CAF50":"#F44336", fontSize:18, fontWeight:700, fontFamily:serif }}>{endBalance>=startingCash?"+":""}SAR {((endBalance-startingCash)/1000).toFixed(0)}K</div>
          </div>
        </div>
        <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:20 }}>
          <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:2, marginBottom:12 }}>PLANNED ONE-TIME EXPENSES</div>
          <div style={{ maxHeight:130, overflowY:"auto", marginBottom:10 }}>
            {plannedExpenses.map(e=>(
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:`1px solid ${C.mid}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}><div style={{ width:8, height:8, borderRadius:"50%", background:e.color }}/><span style={{ color:C.cream, fontSize:12 }}>{e.label}</span><span style={{ color:C.muted, fontSize:10, fontFamily:mono }}>W{e.week}</span></div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ color:e.color, fontSize:12, fontFamily:mono, fontWeight:700 }}>SAR {(e.amount/1000).toFixed(0)}K</span>
                  <button onClick={()=>setPlannedExpenses(p=>p.filter(x=>x.id!==e.id))} style={{ background:"transparent", border:"none", color:"#F44336", cursor:"pointer", fontSize:14 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <input placeholder="Expense label" value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExpense()} style={{ background:C.dark, border:`1px solid ${C.mid}`, borderRadius:6, color:C.cream, padding:"6px 10px", fontSize:12, fontFamily:mono, flex:2, minWidth:120, outline:"none" }}/>
            <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid ${C.mid}`, borderRadius:6, overflow:"hidden" }}><span style={{ color:C.muted, fontSize:10, fontFamily:mono, padding:"6px 6px 6px 8px" }}>W</span><input type="number" min={1} max={13} value={newWeek} onChange={e=>setNewWeek(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:C.amber, padding:"6px 4px", fontSize:12, fontFamily:mono, fontWeight:700, width:36 }}/></div>
            <div style={{ display:"flex", alignItems:"center", background:C.dark, border:`1px solid ${C.mid}`, borderRadius:6, overflow:"hidden" }}><span style={{ color:C.muted, fontSize:10, fontFamily:mono, padding:"6px 6px 6px 8px" }}>SAR</span><input type="number" min={1000} step={1000} value={newAmount} onChange={e=>setNewAmount(Number(e.target.value))} style={{ background:"transparent", border:"none", outline:"none", color:"#81C784", padding:"6px 6px", fontSize:12, fontFamily:mono, fontWeight:700, width:68 }}/></div>
            <button onClick={addExpense} style={{ background:C.gold, color:C.dark, border:"none", borderRadius:6, padding:"6px 14px", fontSize:12, fontFamily:mono, fontWeight:700, cursor:"pointer" }}>+ Add</button>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ display:"flex", gap:8 }}>
          {[["chart","Waterfall"],["balance","Cash Balance"],["net","Net Flow"],["stock","Stock Levels"]].map(([k,v])=>(
            <button key={k} onClick={()=>setViewMode(k)} style={{ background:viewMode===k?C.gold:C.panel, color:viewMode===k?C.dark:C.sage, border:`1px solid ${viewMode===k?C.gold:"#2D4A35"}`, borderRadius:8, padding:"7px 14px", fontSize:11, fontFamily:mono, cursor:"pointer" }}>{v}</button>
          ))}
        </div>
        <ExportButton onClick={doExport} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.gold}22`, borderRadius:14, padding:24, marginBottom:20 }}>
        {viewMode==="chart" && <ResponsiveContainer width="100%" height={280}><BarChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="week" stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:10,fill:C.muted }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/><Tooltip {...TT} formatter={v=>[sarFmt(v)]}/><Legend wrapperStyle={{ fontSize:10,fontFamily:mono }}/><Bar dataKey="Revenue" stackId="in" fill="#4CAF50" radius={[3,3,0,0]}/><Bar dataKey="OpEx" stackId="out" fill={C.rust}/><Bar dataKey="PO Deposit" stackId="out" fill="#64B5F6"/><Bar dataKey="PO Balance" stackId="out" fill="#1565C0"/><Bar dataKey="Planned" stackId="out" fill="#CE93D8" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>}
        {viewMode==="balance" && <ResponsiveContainer width="100%" height={280}><AreaChart data={cd}><defs><linearGradient id="b90" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4CAF50" stopOpacity={0.35}/><stop offset="95%" stopColor="#4CAF50" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="week" stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:10,fill:C.muted }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/><Tooltip {...TT} formatter={v=>[sarFmt(v)]}/><Area type="monotone" dataKey="Cash Bal" name="Cash Balance" stroke="#4CAF50" fill="url(#b90)" strokeWidth={2.5} dot={{ r:3,fill:"#4CAF50" }}/></AreaChart></ResponsiveContainer>}
        {viewMode==="net" && <ResponsiveContainer width="100%" height={280}><BarChart data={cd}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="week" stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:10,fill:C.muted }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/><Tooltip {...TT} formatter={v=>[sarFmt(v)]}/><Bar dataKey="Net Flow" radius={[3,3,0,0]}>{cd.map((d,i)=><Cell key={i} fill={d["Net Flow"]>=0?"#4CAF50":"#F44336"}/>)}</Bar></BarChart></ResponsiveContainer>}
        {viewMode==="stock" && <ResponsiveContainer width="100%" height={280}><LineChart data={weeks.map(w=>{ const r={week:w.week}; w.stockSnapshot.forEach(s=>{r[s.sku]=s.stock;}); return r; })}><CartesianGrid strokeDasharray="3 3" stroke={C.mid}/><XAxis dataKey="week" stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/><YAxis stroke={C.muted} tick={{ fontSize:10,fill:C.muted }}/><Tooltip {...TT}/><Legend wrapperStyle={{ fontSize:10,fontFamily:mono }}/>{BASE_PRODUCTS.map((p,i)=><Line key={p.sku} type="monotone" dataKey={p.sku} name={overrides[p.sku]?.name||p.sku} stroke={PALETTE[i]} strokeWidth={2} dot={false}/>)}</LineChart></ResponsiveContainer>}
      </div>
    </div>
  );
}

// ─── TABS CONFIG ──────────────────────────────────────────────────────────────
const TABS = [
  { id:"overview",  label:"Overview"      },
  { id:"scenarios", label:"✦ Scenarios"   },
  { id:"portfolio", label:"Portfolio"     },
  { id:"timeline",  label:"Timeline"      },
  { id:"financial", label:"Financials"    },
  { id:"cashflow",  label:"Cash Flow"     },
  { id:"cf90",      label:"90-Day"        },
  { id:"safety",    label:"Safety Stock"  },
  { id:"marketing", label:"Marketing"     },
  { id:"inventory", label:"Inventory"     },
];

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState("overview");
  const [inputs,       setInputs]       = useState({ investment:1000000, sellPrice:780, productCost:312 });
  const [alloc,        setAlloc]        = useState({ ...DEFAULT_ALLOC });
  const [overrides,    setOverrides]    = useState({ ...DEFAULT_OVERRIDES });
  const [reinvestRate, setReinvestRate] = useState(0.40);
  const [startingCash, setStartingCash] = useState(350000);

  const onInput    = useCallback((k, v) => setInputs(p => ({ ...p, [k]: v })), []);
  const onOverride = useCallback((sku, vals) => setOverrides(p => ({ ...p, [sku]: vals })), []);

  // Load scenario into simulator + navigate to overview
  const onLoadScenario = useCallback((scenario) => {
    setInputs({ investment:scenario.inputs.investment, sellPrice:scenario.inputs.sellPrice, productCost:scenario.inputs.productCost });
    setAlloc({ ...scenario.alloc });
    setReinvestRate(scenario.inputs.reinvestRate);
    setTab("overview");
  }, []);

  const data   = useMemo(() => buildFinancials(inputs.investment, inputs.sellPrice, inputs.productCost, alloc, reinvestRate), [inputs, alloc, reinvestRate]);
  const budget = useMemo(() => buildBudget(inputs.investment, alloc), [inputs.investment, alloc]);
  const bm     = data.findIndex(d => d.profit > 0);
  const margin = inputs.sellPrice > 0 ? (((inputs.sellPrice-inputs.productCost)/inputs.sellPrice)*100).toFixed(1) : 0;
  const effR   = getEffectiveReinvestRate(reinvestRate, inputs.sellPrice, inputs.productCost);

  return (
    <div style={{ minHeight:"100vh", background:C.dark, color:C.cream, fontFamily:sans }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
      {/* Header */}
      <div style={{ background:C.header, borderBottom:`1px solid ${C.gold}33`, padding:"16px 32px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ color:C.gold, fontSize:9, fontFamily:mono, letterSpacing:3, marginBottom:3 }}>● SIMULATION PLATFORM v2.0 · LIVE</div>
          <div style={{ color:C.cream, fontSize:20, fontWeight:700, fontFamily:serif }}>Saudi E-Commerce Venture</div>
          <div style={{ color:C.muted, fontSize:11, fontFamily:mono, marginTop:2 }}>B2C · China Sourcing · Riyadh · Tiered Reinvestment · EOQ Safety Stock</div>
        </div>
        <div style={{ display:"flex", gap:22, alignItems:"center" }}>
          {[
            { label:"Investment",    val:`SAR ${(inputs.investment/1e6).toFixed(2)}M`, color:C.gold },
            { label:"Breakeven",     val:bm>=0?`Month ${bm+1}`:"N/A",                  color:C.amber },
            { label:"Gross Margin",  val:`${margin}%`,                                  color:inputs.sellPrice>inputs.productCost?"#4CAF50":"#F4A261" },
            { label:"Eff. Reinvest", val:`${(effR*100).toFixed(0)}%`,                   color:"#81C784" },
          ].map((h,i)=>(
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ color:h.color, fontSize:18, fontWeight:700, fontFamily:serif }}>{h.val}</div>
              <div style={{ color:C.muted, fontSize:10, fontFamily:mono }}>{h.label}</div>
            </div>
          ))}
        </div>
      </div>
      <InputPanel inputs={inputs} onInput={onInput} reinvestRate={reinvestRate} onReinvest={setReinvestRate} />
      {/* Tab bar */}
      <div style={{ background:C.header, borderBottom:`1px solid ${C.mid}`, padding:"0 32px", display:"flex", gap:2, overflowX:"auto" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:"none", border:"none", color:tab===t.id?C.gold:C.muted, padding:"13px 16px", fontSize:12, fontFamily:mono, letterSpacing:1, cursor:"pointer", borderBottom:tab===t.id?`2px solid ${C.gold}`:"2px solid transparent", transition:"all 0.2s", whiteSpace:"nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{ padding:"26px 32px", maxWidth:1200, margin:"0 auto" }}>
        {tab==="overview"  && <OverviewTab    data={data} budget={budget} inputs={inputs} alloc={alloc} onAlloc={setAlloc}/>}
        {tab==="scenarios" && <ScenarioTab    onLoadScenario={onLoadScenario}/>}
        {tab==="portfolio" && <PortfolioTab   inputs={inputs} overrides={overrides} onOverride={onOverride}/>}
        {tab==="timeline"  && <TimelineTab/>}
        {tab==="financial" && <FinancialTab   data={data}/>}
        {tab==="cashflow"  && <CashFlowTab    data={data} investment={inputs.investment} reinvestRate={reinvestRate} onReinvestRate={setReinvestRate}/>}
        {tab==="cf90"      && <CashFlow90Tab  inputs={inputs} overrides={overrides} startingCash={startingCash} onStartingCash={setStartingCash}/>}
        {tab==="safety"    && <SafetyStockTab overrides={overrides} inputs={inputs}/>}
        {tab==="marketing" && <MarketingTab   budget={budget}/>}
        {tab==="inventory" && <InventoryTab   data={data} inputs={inputs} budget={budget} overrides={overrides}/>}
      </div>
    </div>
  );
}
