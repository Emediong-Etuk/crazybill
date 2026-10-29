// SEED HINTS for the research agent — NOT truth. Every item must be verified live with tools.
import { vatRateHint } from "./config";

export const PREFERRED_DOMAINS = [
  "nerc.gov.ng",
  "premiumtimesng.com",
  "businessday.ng",
  "thecable.ng",
  "punchng.com",
  "icirnigeria.org",
  "nairametrics.com",
  "vanguardngr.com",
  "channelstv.com",
];

export function seedHints(): string {
  return `SEED HINTS — may be outdated, verify with tools:
- Service-based tariff bands (MYTO): Band A >= 20 h/day, B >= 16, C >= 12, D >= 8, E >= 4. Verify current minimums.
- Band A is a minimum AVERAGE of 20 h/day measured over a week. NERC (2024): persistent failure to meet a band's
  minimum hours for 7 consecutive days -> automatic feeder downgrade; affected customers eligible for compensation.
- Compensation framework for Band A feeders averaging 18-20 h (Addendum NERC/2024/003). Directive NERC/2026/002:
  special compensation for Band A customers affected by generation shortfalls in Feb-Mar 2026.
- Precedent: April 2024, NERC fined AEDC N200m for applying the Band A tariff to Band B-E customers and ordered
  refunds via tokens.
- April 2024: NERC directed DisCos to provide web portals where customers check their band by meter/account number.
- Estimated billing: NERC has orders capping estimated bills for unmetered customers — find the current rule for this DisCo.
- Complaint path (verify): DisCo Customer Complaints Unit (CCU) -> NERC Forum Office -> the Commission.
- VAT on electricity: about ${(vatRateHint() * 100).toFixed(1)}% — verify.
- Preferred source domains (in order): nerc.gov.ng, the DisCo's official website, then ${PREFERRED_DOMAINS.slice(1).join(", ")}.`;
}
