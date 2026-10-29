// Nigerian electricity Distribution Companies. Name + short code only; the agent finds URLs live.
export type Disco = { code: string; name: string };

export const DISCOS: Disco[] = [
  { code: "AEDC", name: "Abuja Electricity Distribution Company" },
  { code: "BEDC", name: "Benin Electricity Distribution Company" },
  { code: "EKEDC", name: "Eko Electricity Distribution Company" },
  { code: "EEDC", name: "Enugu Electricity Distribution Company" },
  { code: "IBEDC", name: "Ibadan Electricity Distribution Company" },
  { code: "IE", name: "Ikeja Electric" },
  { code: "JED", name: "Jos Electricity Distribution" },
  { code: "KAEDCO", name: "Kaduna Electric" },
  { code: "KEDCO", name: "Kano Electricity Distribution Company" },
  { code: "PHED", name: "Port Harcourt Electricity Distribution Company" },
  { code: "YEDC", name: "Yola Electricity Distribution Company" },
  { code: "ABA", name: "Aba Power" },
  { code: "OTHER", name: "Other / state-regulated" },
];

const ALIASES: [RegExp, string][] = [
  [/abuja|aedc/i, "AEDC"],
  [/benin|bedc/i, "BEDC"],
  [/\beko\b|ekedc|ekedp/i, "EKEDC"],
  [/enugu|eedc/i, "EEDC"],
  [/ibadan|ibedc/i, "IBEDC"],
  [/ikeja|\bie\b/i, "IE"],
  [/\bjos\b|\bjed\b|jedc/i, "JED"],
  [/kaduna|kaedc/i, "KAEDCO"],
  [/kano|kedco/i, "KEDCO"],
  [/port\s*harcourt|phed|phedc/i, "PHED"],
  [/yola|yedc/i, "YEDC"],
  [/\baba\b/i, "ABA"],
];

/** Best-effort match of a printed DisCo name to our list. */
export function matchDisco(text: string | null | undefined): Disco | null {
  if (!text) return null;
  for (const [re, code] of ALIASES) if (re.test(text)) return DISCOS.find((d) => d.code === code) ?? null;
  return null;
}

export function discoByCode(code: string): Disco | undefined {
  return DISCOS.find((d) => d.code === code);
}

export function discoLabel(codeOrName: string): string {
  const d = discoByCode(codeOrName);
  return d ? `${d.name} (${d.code})` : codeOrName;
}
