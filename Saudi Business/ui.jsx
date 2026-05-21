import { useState, useRef, useEffect } from "react";
import { C, mono, serif, sans, sarFmt } from "../constants.js";

// ─── KPI CARD ────────────────────────────────────────────────────────────────
export const KPICard = ({ label, value, sub, accent = C.gold }) => (
  <div style={{ background:C.panel, border:`1px solid ${accent}33`, borderRadius:12, padding:"18px 22px", minWidth:148, flex:1 }}>
    <div style={{ color:accent, fontSize:10, fontFamily:mono, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>{label}</div>
    <div style={{ color:C.cream, fontSize:22, fontWeight:700, fontFamily:serif, lineHeight:1 }}>{value}</div>
    {sub && <div style={{ color:C.muted, fontSize:11, marginTop:5, fontFamily:mono }}>{sub}</div>}
  </div>
);

// ─── SECTION TITLE ───────────────────────────────────────────────────────────
export const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom:22 }}>
    <div style={{ color:C.gold, fontSize:10, fontFamily:mono, letterSpacing:3, textTransform:"uppercase", marginBottom:5 }}>● {sub}</div>
    <div style={{ color:C.cream, fontSize:26, fontWeight:700, fontFamily:serif }}>{title}</div>
  </div>
);

// ─── EXPORT BUTTON ───────────────────────────────────────────────────────────
export const ExportButton = ({ onClick, label = "Export CSV" }) => (
  <button
    onClick={onClick}
    title="Download as CSV"
    style={{
      display:"flex", alignItems:"center", gap:6,
      background:"transparent", border:`1px solid ${C.forest}66`,
      borderRadius:8, padding:"6px 14px", cursor:"pointer",
      color:C.sage, fontSize:11, fontFamily:mono,
      transition:"all 0.18s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = `${C.forest}22`; e.currentTarget.style.color = "#81C784"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.sage; }}
  >
    <span style={{ fontSize:13 }}>⬇</span> {label}
  </button>
);

// ─── EDITABLE CELL ───────────────────────────────────────────────────────────
export function EditableCell({ value, type = "number", min, max, step = 1, unit = "", onSave, accent = C.amber, width = 72 }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const v = type === "text"
      ? (String(draft).trim() || String(value))
      : Math.max(min, Math.min(max, Number(draft) || min));
    onSave(v); setDraft(v); setEditing(false);
  };

  if (editing) return (
    <td style={{ padding:"4px 8px" }} onClick={e => e.stopPropagation()}>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <input
          ref={inputRef} type={type} min={min} max={max} step={step} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          style={{ background:C.panel, border:`1px solid ${accent}`, borderRadius:6, color:accent, padding:"4px 8px", fontSize:12, fontFamily:type === "text" ? sans : mono, fontWeight:600, width, outline:"none" }}
          autoFocus
        />
        {unit && <span style={{ color:C.muted, fontSize:10, fontFamily:mono }}>{unit}</span>}
      </div>
    </td>
  );

  return (
    <td onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      style={{ padding:"11px 12px", cursor:"text" }} title="Click to edit">
      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ color:type === "text" ? C.cream : accent, fontWeight:600, fontFamily:type === "text" ? sans : mono, fontSize:13 }}>
          {type === "text" ? value : value.toLocaleString()}{unit}
        </span>
        <span style={{ color:accent, fontSize:9, opacity:0.55 }}>✎</span>
      </div>
    </td>
  );
}

// ─── STOCK COVERAGE BAR ──────────────────────────────────────────────────────
export function StockCoverageBar({ stock, velocity, leadDays }) {
  const monthlyRate  = velocity === "High" ? 80 : velocity === "Medium" ? 40 : 15;
  const weeksOfStock = (stock / monthlyRate) * 4.3;
  const leadWeeks    = leadDays / 7;
  const safetyBuf    = leadWeeks * 1.3;
  const pct          = Math.min(100, (weeksOfStock / 16) * 100);
  const status       = weeksOfStock < safetyBuf ? "critical" : weeksOfStock < safetyBuf * 2 ? "warning" : "healthy";
  const colors       = { critical:"#F44336", warning:C.amber, healthy:"#4CAF50" };
  const labels       = { critical:"Reorder Now", warning:"Reorder Soon", healthy:"Healthy Stock" };

  return (
    <div style={{ padding:"12px 16px", background:C.dark, borderRadius:10, border:`1px solid ${colors[status]}33` }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ color:C.muted, fontSize:10, fontFamily:mono }}>STOCK COVERAGE</span>
        <span style={{ color:colors[status], fontSize:10, fontFamily:mono, fontWeight:700 }}>{labels[status]}</span>
      </div>
      <div style={{ height:6, background:C.mid, borderRadius:3, marginBottom:6 }}>
        <div style={{ height:6, background:colors[status], borderRadius:3, width:`${pct}%`, transition:"width 0.35s ease" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:C.sage, fontSize:11 }}>{weeksOfStock.toFixed(1)} weeks of stock</span>
        <span style={{ color:C.muted, fontSize:11 }}>Lead: {leadDays}d ({leadWeeks.toFixed(1)} wks)</span>
      </div>
      <div style={{ color:C.muted, fontSize:10, fontFamily:mono, marginTop:4 }}>
        Reorder point: ~{Math.round(monthlyRate * (leadDays / 30) * 1.3)} units · Selling ~{monthlyRate} units/mo
      </div>
    </div>
  );
}
