import { describe, expect, it } from "vitest";
import {
  checkBillTotal,
  checkEnergyCharge,
  checkEstimatedRead,
  checkReadingDiff,
  checkTokenUnits,
  checkVatRate,
  runChecks,
} from "../src/lib/checks";
import { ctx, doc, postpaid, prepaid } from "./helpers";

describe("reading_diff", () => {
  it("passes when readings match kWh", () => expect(checkReadingDiff(postpaid()).status).toBe("pass"));
  it("applies the meter multiplier", () => {
    const r = checkReadingDiff(postpaid({ previousReading: 100, presentReading: 145, meterMultiplier: 10 }));
    expect(r.expected).toBe(450);
    expect(r.status).toBe("pass");
  });
  it("fails when billed more kWh than the readings", () => {
    const r = checkReadingDiff(postpaid({ kWhBilled: 500 }));
    expect(r.status).toBe("fail");
    expect(r.diff).toBe(50);
  });
  it("tolerates small differences", () => expect(checkReadingDiff(postpaid({ kWhBilled: 451 })).status).toBe("pass"));
  it("skips estimated reads", () => expect(checkReadingDiff(postpaid({ readType: "estimated" })).status).toBe("skipped"));
  it("skips with missing inputs", () => {
    const r = checkReadingDiff(postpaid({ previousReading: null }));
    expect(r.status).toBe("skipped");
    expect(r.explanation).toMatch(/previous reading/);
  });
  it("skips prepaid", () => expect(checkReadingDiff(prepaid()).status).toBe("skipped"));
});

describe("energy_charge", () => {
  it("passes", () => expect(checkEnergyCharge(postpaid()).status).toBe("pass"));
  it("fails on a +₦2,000 error", () => {
    const r = checkEnergyCharge(postpaid({ energyCharge: 92000 }));
    expect(r.status).toBe("fail");
    expect(r.diff).toBe(2000);
  });
  it("within 1% tolerance passes", () => expect(checkEnergyCharge(postpaid({ energyCharge: 90800 })).status).toBe("pass"));
  it("skips when rate missing", () => expect(checkEnergyCharge(postpaid({ ratePerKWh: null })).status).toBe("skipped"));
});

describe("vat_rate", () => {
  it("is info with the implied rate", () => {
    const r = checkVatRate(postpaid());
    expect(r.status).toBe("info");
    expect(r.explanation).toMatch(/7\.5%/);
  });
  it("uses net energy for prepaid", () => {
    const r = checkVatRate(prepaid());
    expect(r.status).toBe("info");
    expect(r.explanation).toMatch(/7\.5%/);
  });
  it("skips without VAT", () => expect(checkVatRate(postpaid({ vat: null })).status).toBe("skipped"));
});

describe("bill_total", () => {
  it("passes when parts add up", () => expect(checkBillTotal(postpaid()).status).toBe("pass"));
  it("treats bracketed (negative) payments the same", () =>
    expect(checkBillTotal(postpaid({ payments: -5000 })).status).toBe("pass"));
  it("fails when total too high", () => {
    const r = checkBillTotal(postpaid({ totalDue: 100000 }));
    expect(r.status).toBe("fail");
    expect(r.diff).toBe(3250);
  });
  it("allows one missing part, taken as 0", () => {
    const r = checkBillTotal(postpaid({ otherCharges: null }));
    expect(r.status).toBe("pass");
    expect(r.explanation).toMatch(/not shown/);
  });
  it("skips when more than one part is missing", () =>
    expect(checkBillTotal(postpaid({ otherCharges: null, adjustments: null })).status).toBe("skipped"));
  it("skips without total", () => expect(checkBillTotal(postpaid({ totalDue: null })).status).toBe("skipped"));
});

describe("token_units", () => {
  it("passes when units match", () => expect(checkTokenUnits(prepaid()).status).toBe("pass"));
  it("fails when ~5% short", () => {
    const r = checkTokenUnits(prepaid({ tokenUnitsKWh: 88.37 }));
    expect(r.status).toBe("fail");
    expect(r.diff).toBeLessThan(0);
  });
  it("subtracts debt deduction", () => {
    const r = checkTokenUnits(prepaid({ debtDeduction: 2000, tokenUnitsKWh: 83.02 }));
    expect(r.expected).toBeCloseTo(83.02, 1);
    expect(r.status).toBe("pass");
  });
  it("computes implied rate when no rate is printed", () => {
    const r = checkTokenUnits(prepaid({ ratePerKWh: null }));
    expect(r.status).toBe("info");
    expect(r.actual).toBeCloseTo(200, 0);
  });
  it("skips without units", () => expect(checkTokenUnits(prepaid({ tokenUnitsKWh: null })).status).toBe("skipped"));
  it("skips postpaid", () => expect(checkTokenUnits(postpaid()).status).toBe("skipped"));
  it("does not fail when VAT is assumed", () => {
    expect(checkTokenUnits(prepaid({ vat: null, tokenUnitsKWh: 80 })).status).toBe("info");
  });
});

describe("estimated_read", () => {
  it("is info for an estimated read", () =>
    expect(checkEstimatedRead(postpaid({ readType: "estimated" }), ctx()).status).toBe("info"));
  it("is info with no meter", () =>
    expect(checkEstimatedRead(postpaid({ readType: null }), ctx({ meterSituation: "no_meter" })).status).toBe("info"));
  it("passes on actual read", () => expect(checkEstimatedRead(postpaid(), ctx()).status).toBe("pass"));
  it("skips prepaid", () => expect(checkEstimatedRead(prepaid(), ctx()).status).toBe("skipped"));
});

describe("runChecks", () => {
  it("returns all six checks and never throws on an empty doc", () => {
    const r = runChecks(doc(), ctx());
    expect(r.map((c) => c.id)).toEqual(["reading_diff", "energy_charge", "vat_rate", "bill_total", "token_units", "estimated_read"]);
    expect(r.every((c) => ["skipped", "info", "pass"].includes(c.status))).toBe(true);
  });
});
