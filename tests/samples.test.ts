import { describe, expect, it } from "vitest";
import { runChecks } from "../src/lib/checks";
import { computeOvercharge } from "../src/lib/overcharge";
import { SAMPLES } from "../src/lib/samples";
import { agent, doc } from "./helpers";

// Values printed on public/samples/*.png (see scripts/make-samples.ts).
const postpaidDoc = doc({
  docType: "postpaid_bill",
  tariffClass: "A-NMD",
  tariffBand: "A",
  readType: "estimated",
  previousReading: 18240,
  presentReading: 18690,
  meterMultiplier: 1,
  kWhBilled: 450,
  ratePerKWh: 209.5,
  energyCharge: 96275,
  vat: 7220.63,
  balanceBroughtForward: 12500,
  payments: -10000,
  adjustments: 0,
  totalDue: 105995.63,
});
const tokenDoc = doc({ docType: "prepaid_token", tariffBand: "A", amountPaid: 20000, vat: 1325.58, debtDeduction: 1000, ratePerKWh: 209.5, tokenUnitsKWh: 80.15 });

describe("sample documents", () => {
  it("postpaid sample: +₦2,000 energy charge error, estimated read flagged", () => {
    const ctx = SAMPLES[0]!.context;
    const checks = runChecks(postpaidDoc, ctx);
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId.energy_charge!.status).toBe("fail");
    expect(byId.energy_charge!.diff).toBe(2000);
    expect(byId.bill_total!.status).toBe("pass");
    expect(byId.reading_diff!.status).toBe("skipped");
    expect(byId.estimated_read!.status).toBe("info");
    expect(computeOvercharge(postpaidDoc, checks, agent(), ctx).totalNaira).toBe(2000);
  });

  it("token sample: ~5% fewer units than paid for", () => {
    const ctx = SAMPLES[1]!.context;
    const checks = runChecks(tokenDoc, ctx);
    const units = checks.find((c) => c.id === "token_units")!;
    expect(units.status).toBe("fail");
    expect(units.expected).toBeCloseTo(84.36, 1);
    const o = computeOvercharge(tokenDoc, checks, agent(), ctx);
    expect(o.totalNaira).toBe(Math.round((units.expected! - 80.15) * 209.5 * (1 + 1325.58 / (20000 - 1000 - 1325.58))));
    expect(o.totalNaira).toBeGreaterThan(900);
  });
});
