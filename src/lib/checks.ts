// Deterministic arithmetic checks (spec §9). Pure functions — never throw.
import { tolerance, vatRateHint } from "./config";
import { formatNaira, formatNumber, formatPercent } from "./format";
import type { CheckResult, ExtractedDoc, UserContext } from "./schemas";

const r2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function moneyMismatch(diff: number, base: number): boolean {
  return Math.abs(diff) > Math.max(tolerance.moneyAbs, tolerance.moneyRel * Math.abs(base));
}

export function kwhMismatch(diff: number, base: number): boolean {
  return Math.abs(diff) > Math.max(tolerance.kwhAbs, tolerance.kwhRel * Math.abs(base));
}

function skipped(id: CheckResult["id"], label: string, reason: string): CheckResult {
  return { id, label, expected: null, actual: null, diff: null, status: "skipped", explanation: reason };
}

function missing(doc: ExtractedDoc, fields: (keyof ExtractedDoc)[]): string[] {
  return fields.filter((f) => !isNum(doc[f] as number | null));
}

const NAMES: Partial<Record<keyof ExtractedDoc, string>> = {
  previousReading: "previous reading",
  presentReading: "present reading",
  kWhBilled: "kWh billed",
  ratePerKWh: "rate",
  energyCharge: "energy charge",
  vat: "VAT",
  totalDue: "total due",
  amountPaid: "amount paid",
  tokenUnitsKWh: "units",
};
const names = (fs: string[]) => fs.map((f) => NAMES[f as keyof ExtractedDoc] ?? f).join(", ");

const isPrepaid = (doc: ExtractedDoc) => doc.docType === "prepaid_token";

/** kWh the energy charge should be based on. */
export function billedKwh(doc: ExtractedDoc): number | null {
  if (isNum(doc.kWhBilled)) return doc.kWhBilled;
  if (isPrepaid(doc) && isNum(doc.tokenUnitsKWh)) return doc.tokenUnitsKWh;
  return null;
}

/** Prepaid: money left for energy after VAT, debt and other charges. */
export function prepaidNetEnergy(doc: ExtractedDoc): { net: number; vatAssumed: boolean } | null {
  if (!isNum(doc.amountPaid)) return null;
  const debt = doc.debtDeduction ?? 0;
  const other = doc.otherCharges ?? 0;
  if (isNum(doc.vat)) return { net: doc.amountPaid - doc.vat - Math.abs(debt) - Math.abs(other), vatAssumed: false };
  // VAT not printed: assume the amount after debt/other charges is VAT-inclusive at the hint rate.
  return { net: (doc.amountPaid - Math.abs(debt) - Math.abs(other)) / (1 + vatRateHint()), vatAssumed: true };
}

export function checkReadingDiff(doc: ExtractedDoc): CheckResult {
  const id = "reading_diff";
  const label = "Meter readings vs kWh billed";
  if (isPrepaid(doc)) return skipped(id, label, "Not applicable to prepaid token receipts.");
  if (doc.readType === "estimated") return skipped(id, label, "Estimated read — the readings are not real meter readings.");
  const miss = missing(doc, ["previousReading", "presentReading", "kWhBilled"]);
  if (miss.length) return skipped(id, label, `Missing: ${names(miss)}.`);
  const mult = isNum(doc.meterMultiplier) && doc.meterMultiplier > 0 ? doc.meterMultiplier : 1;
  const expected = r2((doc.presentReading! - doc.previousReading!) * mult);
  if (expected < 0) return skipped(id, label, "Present reading is lower than the previous one (meter reset or misread).");
  const actual = doc.kWhBilled!;
  const diff = r2(actual - expected);
  const fail = kwhMismatch(diff, expected);
  return {
    id,
    label,
    expected,
    actual,
    diff,
    status: fail ? "fail" : "pass",
    explanation: fail
      ? `Readings show ${formatNumber(expected, "kWh")} used${mult !== 1 ? ` (×${mult} multiplier)` : ""}, but you were billed for ${formatNumber(actual, "kWh")}.`
      : `kWh billed matches the meter readings (${formatNumber(expected, "kWh")}).`,
  };
}

export function checkEnergyCharge(doc: ExtractedDoc): CheckResult {
  const id = "energy_charge";
  const label = "kWh × rate vs energy charge";
  const kwh = billedKwh(doc);
  const miss = [...(kwh === null ? ["kWhBilled"] : []), ...missing(doc, ["ratePerKWh", "energyCharge"])];
  if (miss.length) return skipped(id, label, `Missing: ${names(miss)}.`);
  const expected = r2(kwh! * doc.ratePerKWh!);
  const actual = doc.energyCharge!;
  const diff = r2(actual - expected);
  const fail = moneyMismatch(diff, expected);
  return {
    id,
    label,
    expected,
    actual,
    diff,
    status: fail ? "fail" : "pass",
    explanation: fail
      ? `${formatNumber(kwh)} kWh × ${formatNaira(doc.ratePerKWh, true)} = ${formatNaira(expected, true)}, but the energy charge is ${formatNaira(actual, true)} (${diff > 0 ? "over" : "under"} by ${formatNaira(Math.abs(diff), true)}).`
      : `Energy charge matches ${formatNumber(kwh)} kWh × ${formatNaira(doc.ratePerKWh, true)}.`,
  };
}

/** VAT base: the energy charge, or for prepaid the net energy value. */
export function vatBase(doc: ExtractedDoc): number | null {
  if (isNum(doc.energyCharge) && doc.energyCharge > 0) return doc.energyCharge;
  if (isPrepaid(doc) && isNum(doc.vat)) {
    const n = prepaidNetEnergy(doc);
    if (n && n.net > 0) return n.net;
  }
  return null;
}

/** Implied VAT rate on the document, if sensible (0–20%). */
export function impliedVatRate(doc: ExtractedDoc): number | null {
  const base = vatBase(doc);
  if (!isNum(doc.vat) || base === null) return null;
  const r = doc.vat / base;
  return r > 0 && r < 0.2 ? r : null;
}

export function checkVatRate(doc: ExtractedDoc): CheckResult {
  const id = "vat_rate";
  const label = "VAT rate";
  const base = vatBase(doc);
  if (!isNum(doc.vat) || base === null) return skipped(id, label, `Missing: ${!isNum(doc.vat) ? "VAT" : "energy charge"}.`);
  const hint = vatRateHint();
  const implied = doc.vat / base;
  const expected = r2(base * hint);
  return {
    id,
    label,
    expected,
    actual: doc.vat,
    diff: r2(doc.vat - expected),
    status: "info",
    explanation: `VAT on this document is ${formatPercent(implied)} of the energy charge; the usual rate is about ${formatPercent(hint)} (the research step verifies the current rate).`,
  };
}

export function checkBillTotal(doc: ExtractedDoc): CheckResult {
  const id = "bill_total";
  const label = "Bill total adds up";
  if (isPrepaid(doc)) return skipped(id, label, "Not applicable to prepaid token receipts.");
  if (!isNum(doc.totalDue)) return skipped(id, label, "Missing: total due.");
  const parts = {
    balanceBroughtForward: doc.balanceBroughtForward,
    energyCharge: doc.energyCharge,
    vat: doc.vat,
    otherCharges: doc.otherCharges,
    payments: doc.payments,
    adjustments: doc.adjustments,
  };
  const nulls = Object.entries(parts).filter(([, v]) => !isNum(v)).map(([k]) => k);
  if (nulls.length > 1) return skipped(id, label, `Too many parts missing (${nulls.length}) to rebuild the total.`);
  if (!isNum(doc.energyCharge)) return skipped(id, label, "Missing: energy charge.");
  const v = (x: number | null) => (isNum(x) ? x : 0);
  // Payments reduce what is owed whether printed as 5,000 or (5,000).
  const expected = r2(
    v(parts.balanceBroughtForward) + v(parts.energyCharge) + v(parts.vat) + v(parts.otherCharges) - Math.abs(v(parts.payments)) + v(parts.adjustments),
  );
  const actual = doc.totalDue;
  const diff = r2(actual - expected);
  const fail = moneyMismatch(diff, expected);
  const assumed = nulls.length === 1 ? ` (${NAMES[nulls[0] as keyof ExtractedDoc] ?? nulls[0]} not shown, taken as ₦0)` : "";
  return {
    id,
    label,
    expected,
    actual,
    diff,
    status: fail ? "fail" : "pass",
    explanation: fail
      ? `Balance b/f + energy + VAT + other − payments + adjustments = ${formatNaira(expected, true)}${assumed}, but the bill says ${formatNaira(actual, true)}.`
      : `Total due adds up${assumed}.`,
  };
}

export function checkTokenUnits(doc: ExtractedDoc): CheckResult {
  const id = "token_units";
  const label = "Units you got for your money";
  if (!isPrepaid(doc)) return skipped(id, label, "Only for prepaid token receipts.");
  const miss = missing(doc, ["amountPaid", "tokenUnitsKWh"]);
  if (miss.length) return skipped(id, label, `Missing: ${names(miss)}.`);
  const n = prepaidNetEnergy(doc)!;
  if (n.net <= 0) return skipped(id, label, "Deductions are larger than the amount paid — check the numbers.");
  const units = doc.tokenUnitsKWh!;
  const note = n.vatAssumed ? ` VAT isn't shown, so ${formatPercent(vatRateHint())} was assumed.` : "";
  if (!isNum(doc.ratePerKWh) || doc.ratePerKWh <= 0) {
    if (units <= 0) return skipped(id, label, "Units are zero.");
    const implied = r2(n.net / units);
    return {
      id,
      label,
      expected: null,
      actual: implied,
      diff: null,
      status: "info",
      explanation: `No rate printed. You effectively paid ${formatNaira(implied, true)} per kWh after deductions.${note}`,
    };
  }
  const expected = r2(n.net / doc.ratePerKWh);
  const diff = r2(units - expected);
  const fail = kwhMismatch(diff, expected);
  return {
    id,
    label,
    expected,
    actual: units,
    diff,
    status: fail ? (n.vatAssumed ? "info" : "fail") : "pass",
    explanation: fail
      ? `${formatNaira(n.net, true)} after deductions ÷ ${formatNaira(doc.ratePerKWh, true)}/kWh = ${formatNumber(expected, "kWh")}, but you got ${formatNumber(units, "kWh")} (${diff < 0 ? "short" : "over"} by ${formatNumber(Math.abs(diff), "kWh")}).${note}`
      : `Units match the amount paid at ${formatNaira(doc.ratePerKWh, true)}/kWh.${note}`,
  };
}

export function checkEstimatedRead(doc: ExtractedDoc, ctx: UserContext): CheckResult {
  const id = "estimated_read";
  const label = "Estimated billing";
  if (isPrepaid(doc)) return skipped(id, label, "Prepaid — no estimated billing.");
  if (doc.readType === "estimated" || ctx.meterSituation === "no_meter") {
    return {
      id,
      label,
      expected: null,
      actual: null,
      diff: null,
      status: "info",
      explanation:
        doc.readType === "estimated"
          ? "This bill is based on an estimated reading, not your meter. NERC limits how much DisCos can bill by estimate."
          : "You have no meter, so this bill is an estimate. NERC caps estimated bills for unmetered customers.",
    };
  }
  if (doc.readType === "actual") {
    return { id, label, expected: null, actual: null, diff: null, status: "pass", explanation: "Bill is based on an actual meter reading." };
  }
  return skipped(id, label, "Read type not shown on the bill.");
}

export function runChecks(doc: ExtractedDoc, ctx: UserContext): CheckResult[] {
  const all: [CheckResult["id"], () => CheckResult][] = [
    ["reading_diff", () => checkReadingDiff(doc)],
    ["energy_charge", () => checkEnergyCharge(doc)],
    ["vat_rate", () => checkVatRate(doc)],
    ["bill_total", () => checkBillTotal(doc)],
    ["token_units", () => checkTokenUnits(doc)],
    ["estimated_read", () => checkEstimatedRead(doc, ctx)],
  ];
  return all.map(([id, fn]) => {
    try {
      return fn();
    } catch {
      return skipped(id, id, "Could not run this check.");
    }
  });
}
