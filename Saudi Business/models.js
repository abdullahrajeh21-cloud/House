import { ALLOC_META, BASE_UNITS, BASE_OPEX, MONTHS } from "../constants.js";

// ─── BUDGET ─────────────────────────────────────────────────────────────────
export function buildBudget(investment, alloc) {
  return ALLOC_META.map(m => ({
    name:m.label, key:m.key, pct:alloc[m.key],
    value:Math.round(investment * alloc[m.key] / 100),
    color:m.color,
  }));
}

export function changeAlloc(alloc, key, rawVal) {
  const clamped  = Math.max(1, Math.min(90, rawVal));
  const others   = ALLOC_META.map(m => m.key).filter(k => k !== key);
  const otherSum = others.reduce((s, k) => s + alloc[k], 0);
  const needed   = 100 - clamped;
  const next     = { ...alloc, [key]: clamped };
  if (otherSum === 0) {
    const each = needed / others.length;
    others.forEach(k => (next[k] = parseFloat(each.toFixed(1))));
  } else {
    others.forEach(k => (next[k] = parseFloat(((alloc[k] / otherSum) * needed).toFixed(1))));
  }
  const drift = parseFloat((100 - Object.values(next).reduce((s,v)=>s+v,0)).toFixed(1));
  if (drift !== 0) next[others[others.length-1]] = parseFloat((Math.max(0, next[others[others.length-1]] + drift)).toFixed(1));
  return next;
}

// ─── TIERED REINVESTMENT ─────────────────────────────────────────────────────
// Logic: reward high-margin products by unlocking more aggressive reinvestment.
// Protect cash when margins are thin by capping the effective reinvest rate.
//
//  grossMargin ≥ 60%  →  boost by 20%   (strong product-market fit)
//  grossMargin 40–60% →  use base rate   (standard)
//  grossMargin < 40%  →  cut by 40%     (conserve cash, margins under pressure)
export function effectiveReinvestRate(baseRate, sellPrice, productCost) {
  if (sellPrice <= 0) return baseRate;
  const gm = (sellPrice - productCost) / sellPrice;
  if (gm >= 0.60) return Math.min(0.85, baseRate * 1.20);
  if (gm >= 0.40) return baseRate;
  return baseRate * 0.60;
}

export function reinvestTierLabel(sellPrice, productCost) {
  if (sellPrice <= 0) return { label:"N/A", color:"#6B8F72" };
  const gm = (sellPrice - productCost) / sellPrice;
  if (gm >= 0.60) return { label:"High-Margin Boost (+20%)", color:"#4CAF50" };
  if (gm >= 0.40) return { label:"Standard Rate",             color:"#E8C97A" };
  return                 { label:"Cash Conservation (−40%)",  color:"#F44336" };
}

// ─── FINANCIAL MODEL ─────────────────────────────────────────────────────────
export function buildFinancials(investment, sellPrice, productCost, alloc, baseReinvestRate = 0.40) {
  const scale      = Math.pow(investment / 1_000_000, 0.85);
  const opScale    = Math.pow(investment / 1_000_000, 0.50);
  const invBudget  = investment * alloc.inventory / 100;
  const setupTotal = investment * (alloc.warehouse + alloc.tech + alloc.contingency) / 100;
  const reinvRate  = effectiveReinvestRate(baseReinvestRate, sellPrice, productCost);

  let inventoryValue = invBudget;
  let cumulativeCash = investment;
  let cumUnits       = 0;

  return MONTHS.map((month, i) => {
    const units   = Math.round(BASE_UNITS[i] * scale);
    const revenue = units * sellPrice;
    const cogs    = units * productCost;
    const opex    = Math.round(BASE_OPEX[i] * opScale);
    const profit  = revenue - cogs - opex;
    cumUnits     += units;

    const cashIn     = revenue;
    const setupSpend = i === 0 ? Math.round(setupTotal * 0.65)
                     : i === 1 ? Math.round(setupTotal * 0.35) : 0;

    let invOrder = 0;
    if      (i === 0)     invOrder = Math.round(invBudget * 0.30);
    else if (i === 1)     invOrder = Math.round(invBudget * 0.70);
    else if (i % 2 === 0) invOrder = Math.round(units * 2.5 * productCost);

    const reinvest      = profit > 0 ? Math.round(profit * reinvRate) : 0;
    const reinvInvStock = Math.round(reinvest * 0.60);
    const reinvMkt      = Math.round(reinvest * 0.40);
    const cashOut       = opex + invOrder + setupSpend + reinvInvStock;
    const netCashFlow   = cashIn - cashOut;
    cumulativeCash     += netCashFlow;
    inventoryValue      = Math.max(
      invBudget * 0.35,
      inventoryValue - cogs + invOrder + reinvInvStock,
    );

    return {
      month, units, revenue, cogs, opex, profit,
      inventory:      Math.round(inventoryValue),
      customers:      Math.round(cumUnits * 0.65),
      cashIn, setupSpend, invOrder,
      reinvest, reinvInvStock, reinvMarketing: reinvMkt,
      cashOut:        Math.round(cashOut),
      netCashFlow:    Math.round(netCashFlow),
      cumulativeCash: Math.round(cumulativeCash),
      effectiveReinvRate: reinvRate,
    };
  });
}

// ─── SAFETY STOCK ────────────────────────────────────────────────────────────
// Full safety stock formula:  SS = Z × √(LT×σd² + d²×σLT²)
// Reorder Point:              ROP = (d × LT) + SS
export function calcSafetyStock(avgDailyDemand, demandStdDev, leadTimeDays, leadTimeStdDev, zScore) {
  return Math.ceil(
    zScore * Math.sqrt(
      leadTimeDays * Math.pow(demandStdDev, 2) +
      Math.pow(avgDailyDemand, 2) * Math.pow(leadTimeStdDev, 2)
    )
  );
}

export function calcROP(avgDailyDemand, leadTimeDays, safetyStock) {
  return Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);
}

// ─── ECONOMIC ORDER QUANTITY ─────────────────────────────────────────────────
// EOQ = √(2 × D × S / H)
//   D = annual demand (units)
//   S = ordering cost per PO (SAR)
//   H = holding cost per unit per year (SAR) = unitCost × holdingRate
//
// Total Annual Inventory Cost = ordering cost + holding cost
//   = (D/EOQ)×S + (EOQ/2)×H
export function calcEOQ(annualDemand, orderingCost, holdingCostPerUnit) {
  if (holdingCostPerUnit <= 0 || orderingCost <= 0) return 0;
  return Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit));
}

export function calcInventoryCosts(annualDemand, eoq, orderingCost, holdingCostPerUnit) {
  if (eoq <= 0) return { orderingCost:0, holdingCost:0, totalCost:0, ordersPerYear:0, cycleTimeDays:0 };
  const ordersPerYear  = annualDemand / eoq;
  const annualOrdering = ordersPerYear * orderingCost;
  const annualHolding  = (eoq / 2) * holdingCostPerUnit;
  const cycleTimeDays  = annualDemand > 0 ? Math.round((eoq / annualDemand) * 365) : 0;
  return {
    orderingCost: Math.round(annualOrdering),
    holdingCost:  Math.round(annualHolding),
    totalCost:    Math.round(annualOrdering + annualHolding),
    ordersPerYear: parseFloat(ordersPerYear.toFixed(1)),
    cycleTimeDays,
  };
}
