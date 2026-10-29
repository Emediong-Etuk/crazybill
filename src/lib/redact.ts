import { maskAccount } from "./format";
import type { ExtractedDoc } from "./schemas";

export type RedactedDoc = Omit<ExtractedDoc, "customerName" | "address" | "accountOrMeterNo" | "fieldConfidence" | "notes"> & {
  accountLast4: string | null;
};

/** Strips personal data before anything goes to the research agent or Tavily. */
export function redactDoc(doc: ExtractedDoc): RedactedDoc {
  const { customerName: _n, address: _a, accountOrMeterNo, fieldConfidence: _c, notes: _x, ...rest } = doc;
  void _n;
  void _a;
  void _c;
  void _x;
  const masked = maskAccount(accountOrMeterNo);
  return { ...rest, accountLast4: masked ? masked.slice(-4) : null };
}

/** Removes anything that looks like a 20-digit token or long account number from free text. */
export function scrubText(s: string): string {
  return s.replace(/\b(?:\d[\s-]?){11,}\b/g, "[number removed]");
}
