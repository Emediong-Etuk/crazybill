import type { ExtractedDoc } from "./schemas";

type Field = keyof ExtractedDoc;
export type FieldMeta = { label: string; kind: "money" | "kwh" | "number" | "text" | "rate"; hint?: string };

export const FIELD_META: Partial<Record<Field, FieldMeta>> = {
  disco: { label: "DisCo (as printed)", kind: "text" },
  customerName: { label: "Customer name", kind: "text", hint: "Stays on your phone" },
  address: { label: "Address", kind: "text", hint: "Stays on your phone" },
  accountOrMeterNo: { label: "Account / meter no.", kind: "text", hint: "Only the last 4 digits are used" },
  tariffClass: { label: "Tariff class", kind: "text", hint: "e.g. R2, A-NMD" },
  billingPeriod: { label: "Billing period", kind: "text" },
  billDate: { label: "Bill date", kind: "text" },
  meterMultiplier: { label: "Meter multiplier", kind: "number" },
  previousReading: { label: "Previous reading", kind: "number" },
  presentReading: { label: "Present reading", kind: "number" },
  kWhBilled: { label: "kWh billed", kind: "kwh" },
  ratePerKWh: { label: "Rate (₦/kWh)", kind: "rate" },
  energyCharge: { label: "Energy charge", kind: "money" },
  vat: { label: "VAT", kind: "money" },
  balanceBroughtForward: { label: "Balance brought forward", kind: "money" },
  payments: { label: "Payments", kind: "money" },
  adjustments: { label: "Adjustments", kind: "money" },
  otherCharges: { label: "Other charges", kind: "money" },
  totalDue: { label: "Total due", kind: "money" },
  amountPaid: { label: "Amount paid", kind: "money" },
  tokenUnitsKWh: { label: "Units bought (kWh)", kind: "kwh" },
  debtDeduction: { label: "Debt deducted", kind: "money" },
  vendDate: { label: "Vend date", kind: "text" },
};

export const FIELD_GROUPS: { id: string; title: string; fields: Field[]; for: ExtractedDoc["docType"][] }[] = [
  {
    id: "account",
    title: "Account",
    fields: ["disco", "customerName", "address", "accountOrMeterNo", "tariffClass", "billingPeriod", "billDate"],
    for: ["postpaid_bill", "prepaid_token", "unknown"],
  },
  {
    id: "readings",
    title: "Readings",
    fields: ["previousReading", "presentReading", "meterMultiplier", "kWhBilled"],
    for: ["postpaid_bill", "unknown"],
  },
  {
    id: "charges",
    title: "Charges",
    fields: ["ratePerKWh", "energyCharge", "vat", "balanceBroughtForward", "payments", "adjustments", "otherCharges", "totalDue"],
    for: ["postpaid_bill", "unknown"],
  },
  {
    id: "token",
    title: "Token",
    fields: ["amountPaid", "vat", "debtDeduction", "otherCharges", "ratePerKWh", "tokenUnitsKWh", "vendDate"],
    for: ["prepaid_token", "unknown"],
  },
];

export function fieldLabel(f: string): string {
  return FIELD_META[f as Field]?.label ?? f;
}
