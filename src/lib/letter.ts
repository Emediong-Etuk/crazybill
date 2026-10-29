// Complaint letter + Pidgin summary on MODEL_FAST (spec §12), with code-built fallbacks.
import { models } from "./config";
import { discoByCode } from "./discos";
import { formatNaira } from "./format";
import { callModel } from "./llm";
import type { AgentOutput, ExtractedDoc, Overcharge, TraceEntry, UserContext, Verdict } from "./schemas";

export const LETTER_SYSTEM_PROMPT = `Write a formal complaint letter from a Nigerian electricity customer to their DisCo's
Customer Complaints Unit.

Inputs: DisCo name, masked account/meter number, billing period, findings (with rules),
overcharge breakdown, remedies, escalation path, today's date.

Format and content:
- Nigerian business-letter layout: [Your Name], [Your Address], [Phone Number], date,
  then "The Head, Customer Complaints Unit, {DisCo}".
- Subject: "COMPLAINT: {short issue} — Account/Meter No. {masked}".
- One short opening paragraph. Then a numbered list of issues, each with the ₦ amount
  and the rule it breaks (name the NERC order/directive if given; no URLs in the body).
- Clear requests: bill adjustment or refund (account credit or token), band review /
  feeder downgrade where relevant, meter installation if billed by estimate, and a
  written response.
- Mention a response timeline only if one appears in the escalation path input;
  otherwise ask for a response "within the timeline set by NERC regulations".
- Closing paragraph: if unresolved, the customer will escalate to the NERC Forum Office.
- Polite, firm, factual. Maximum 350 words. Plain text, no markdown. Keep [bracketed]
  placeholders for unknown personal details.`;

export const PIDGIN_SYSTEM_PROMPT = `Explain this audit result in Nigerian Pidgin English in 3–4 short sentences, like you
are telling a neighbour. Include the ₦ amount and the single most important next step.
No insults, no exaggeration, no promises. Plain text only.`;

export type LetterInput = {
  doc: ExtractedDoc;
  ctx: UserContext;
  maskedAccount: string | null;
  verdict: Verdict;
  summary: string;
  overcharge: Overcharge;
  agent: AgentOutput;
  today: Date;
};

function discoName(ctx: UserContext, doc: ExtractedDoc): string {
  const d = discoByCode(ctx.disco);
  return d && d.code !== "OTHER" ? d.name : (doc.disco ?? "the Distribution Company");
}

function dateStr(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

function letterPayload(i: LetterInput) {
  return {
    disco: discoName(i.ctx, i.doc),
    maskedAccountOrMeterNo: i.maskedAccount ?? "[Account/Meter No.]",
    documentType: i.doc.docType === "prepaid_token" ? "prepaid token purchase" : "postpaid bill",
    billingPeriod: i.doc.billingPeriod ?? i.doc.vendDate ?? null,
    tariffBand: i.doc.tariffBand,
    reportedSupply: `${i.ctx.avgHoursPerDay} hours/day on average for about ${i.ctx.daysAtThisLevel} days`,
    findings: i.agent.findings.map((f) => ({ title: f.title, explanation: f.explanation, rule: f.rule, confidence: f.confidence })),
    overchargeBreakdown: i.overcharge.breakdown.map((l) => ({ issue: l.label, naira: formatNaira(l.naira), howCalculated: l.formula })),
    totalOvercharge: formatNaira(i.overcharge.totalNaira),
    remedies: i.agent.remedies,
    escalationPath: i.agent.escalationPath.map((e) => ({ step: e.step, body: e.body, timeline: e.timeline })),
    estimatedBilling: i.doc.readType === "estimated" || i.ctx.meterSituation === "no_meter",
    today: dateStr(i.today),
  };
}

function cleanText(s: string): string {
  return s
    .replace(/```[a-z]*\n?|```/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
}

export async function writeLetter(i: LetterInput, trace: TraceEntry[]): Promise<string> {
  try {
    const { content } = await callModel({
      step: "letter",
      model: models.fast,
      trace,
      temperature: 0.4,
      thinking: false,
      maxTokens: 1200,
      timeoutMs: 45_000,
      messages: [
        { role: "system", content: LETTER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(letterPayload(i)) },
      ],
    });
    const text = cleanText(content);
    if (text.length > 200) return text;
    throw new Error("letter too short");
  } catch {
    return fallbackLetter(i);
  }
}

export async function writePidgin(i: LetterInput, trace: TraceEntry[]): Promise<string> {
  try {
    const { content } = await callModel({
      step: "pidgin",
      model: models.fast,
      trace,
      temperature: 0.4,
      thinking: false,
      maxTokens: 300,
      timeoutMs: 30_000,
      messages: [
        { role: "system", content: PIDGIN_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            verdict: i.verdict,
            summary: i.summary,
            totalOvercharge: formatNaira(i.overcharge.totalNaira),
            mainIssues: [...i.overcharge.breakdown.map((l) => l.label), ...i.agent.findings.slice(0, 3).map((f) => f.title)].slice(0, 4),
            disco: discoName(i.ctx, i.doc),
            nextStep: i.agent.escalationPath[0]?.step ?? "Send the complaint letter to your DisCo's Customer Complaints Unit",
          }),
        },
      ],
    });
    const text = cleanText(content);
    if (text.length > 40) return text;
    throw new Error("pidgin too short");
  } catch {
    return fallbackPidgin(i);
  }
}

export function fallbackLetter(i: LetterInput): string {
  const disco = discoName(i.ctx, i.doc);
  const acct = i.maskedAccount ?? "[Account/Meter No.]";
  const issues = [
    ...i.overcharge.breakdown.map((l) => `${l.label}: ${formatNaira(l.naira)} (${l.formula}).`),
    ...i.agent.findings.filter((f) => !i.overcharge.breakdown.some((l) => l.label === f.title)).map((f) => `${f.title}. ${f.rule}`),
  ];
  if (i.doc.docType !== "prepaid_token" && (i.doc.readType === "estimated" || i.ctx.meterSituation === "no_meter")) {
    issues.push("My bill is based on an estimate, not an actual meter reading, contrary to NERC rules on estimated billing.");
  }
  if (!issues.length) issues.push("I request a review of this bill and confirmation that it follows the NERC-approved tariff for my band.");
  const timeline = i.agent.escalationPath.find((e) => e.timeline)?.timeline;
  return `[Your Name]
[Your Address]
[Phone Number]
${dateStr(i.today)}

The Head,
Customer Complaints Unit,
${disco}

Dear Sir/Madam,

COMPLAINT: Disputed ${i.doc.docType === "prepaid_token" ? "token purchase" : "electricity bill"} — Account/Meter No. ${acct}

I write to formally dispute my ${i.doc.docType === "prepaid_token" ? "recent token purchase" : `bill${i.doc.billingPeriod ? ` for ${i.doc.billingPeriod}` : ""}`}. Over the last ${i.ctx.daysAtThisLevel} days I have received about ${i.ctx.avgHoursPerDay} hours of supply per day. Having checked the ${i.doc.docType === "prepaid_token" ? "receipt" : "bill"}, I found the following issues:

${issues.map((s, n) => `${n + 1}. ${s}`).join("\n")}

${i.overcharge.totalNaira > 0 ? `The estimated total overcharge is ${formatNaira(i.overcharge.totalNaira)}. ` : ""}I request:
- an adjustment of my account or a refund (account credit or token) for any amount overcharged;
- a review of my tariff band against the supply I actually receive${i.doc.docType !== "prepaid_token" && i.ctx.meterSituation === "no_meter" ? ";\n- installation of a meter, as I am currently billed by estimate" : ""};
- a written response ${timeline ? `within ${timeline}` : "within the timeline set by NERC regulations"}.

If this complaint is not resolved, I will escalate it to the NERC Forum Office.

Yours faithfully,

[Your Name]`;
}

export function fallbackPidgin(i: LetterInput): string {
  const amt = formatNaira(i.overcharge.totalNaira);
  switch (i.verdict) {
    case "likely_overcharged":
      return `My neighbour, e be like say dem don overcharge you about ${amt} for this bill. The numbers no add up with wetin NERC approve. Send the complaint letter to your DisCo Customer Complaints Unit, and if dem no answer, carry am go NERC Forum Office.`;
    case "possible_issues":
      return `Some things for this bill no too correct${i.overcharge.totalNaira > 0 ? ` — e fit reach ${amt}` : ""}. No vex, just send the complaint letter make your DisCo check am well. If dem no answer, NERC Forum Office dey there.`;
    case "looks_fine":
      return `This bill look okay from wetin we fit check. Keep your receipts and keep counting your light hours — if supply drop, your band fit need change.`;
    default:
      return `We need small more info (like the kWh and the rate) to check this bill well. Snap am again clear or type the numbers yourself.`;
  }
}
