import { emptyAgentOutput, emptyDoc, type AgentOutput, type ExtractedDoc, type UserContext } from "../src/lib/schemas";

export const doc = (over: Partial<ExtractedDoc> = {}): ExtractedDoc => ({ ...emptyDoc(), ...over });
export const ctx = (over: Partial<UserContext> = {}): UserContext => ({
  disco: "PHED",
  avgHoursPerDay: 22,
  daysAtThisLevel: 7,
  meterSituation: "postpaid_meter",
  ...over,
});
export const agent = (over: Partial<AgentOutput> = {}): AgentOutput => ({ ...emptyAgentOutput(), ...over });

export const postpaid = (over: Partial<ExtractedDoc> = {}) =>
  doc({
    docType: "postpaid_bill",
    tariffBand: "A",
    readType: "actual",
    previousReading: 1000,
    presentReading: 1450,
    kWhBilled: 450,
    ratePerKWh: 200,
    energyCharge: 90000,
    vat: 6750,
    balanceBroughtForward: 5000,
    payments: 5000,
    adjustments: 0,
    otherCharges: 0,
    totalDue: 96750,
    ...over,
  });

export const prepaid = (over: Partial<ExtractedDoc> = {}) =>
  doc({
    docType: "prepaid_token",
    tariffBand: "A",
    amountPaid: 20000,
    vat: 1395.35,
    debtDeduction: 0,
    ratePerKWh: 200,
    tokenUnitsKWh: 93.02,
    ...over,
  });
