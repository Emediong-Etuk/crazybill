import type { UserContext } from "./schemas";

export type SampleId = "postpaid-estimated" | "token-receipt";

export const SAMPLES: { id: SampleId; label: string; image: string; context: UserContext }[] = [
  {
    id: "postpaid-estimated",
    label: "Estimated postpaid bill",
    image: "/samples/postpaid-estimated.png",
    context: { disco: "PHED", avgHoursPerDay: 9, daysAtThisLevel: 21, meterSituation: "no_meter" },
  },
  {
    id: "token-receipt",
    label: "Prepaid token receipt",
    image: "/samples/token-receipt.png",
    context: { disco: "PHED", avgHoursPerDay: 14, daysAtThisLevel: 10, meterSituation: "prepaid_meter" },
  },
];

export function sampleById(id: string | undefined) {
  return SAMPLES.find((s) => s.id === id);
}
