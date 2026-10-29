# Devpost submission draft — CrazyBill

**Project name:** CrazyBill

**Tagline:** Snap your light bill. Find the overcharge. Send the complaint.

**Track:** Best Apps and Agents (also entering: Best Use of Tavily)

**Links:** Live demo `<url>` · Repo https://github.com/Emediong-Etuk/crazybill · Video `<url>`

## Inspiration

In Nigeria there's a name for it: "crazy bills". Estimated bills with no meter reading. Band A tariffs — the most expensive band, promising at least 20 hours of light a day — charged to households that get 8. Token receipts that give fewer units than the money paid. NERC, the regulator, has rules for all of this: band downgrades, refunds, compensation, caps on estimated billing. But the rules are spread across orders, directives and news reports, and almost nobody knows them or how to complain. We wanted anyone with a phone to be able to check their bill against the actual rules in a minute.

## What it does

1. Take a photo of a postpaid bill or prepaid token receipt.
2. While NVIDIA Nemotron 3.5 Super VL reads it, answer three questions: your DisCo, average hours of light per day, and for how many days.
3. Check the fields it read (low-confidence ones are highlighted).
4. CrazyBill checks the maths in code, then a Nemotron 3 Ultra research agent uses Tavily to find the current NERC-approved tariff for your DisCo and band, the minimum supply hours per band, estimated-billing rules and the complaint path.
5. You get a verdict, an estimated ₦ overcharge with the formula for every line, findings with sources, a formal complaint letter to your DisCo's Customer Complaints Unit (copy, download, print, WhatsApp), a Pidgin summary to share, and a full model trace.

## How we built it

- **Next.js 16 + TypeScript (strict), Tailwind, shadcn/ui-style components**, deployed on Vercel.
- **Nebius Token Factory** as the single OpenAI-compatible endpoint for three NVIDIA Nemotron models:
  - Nemotron 3.5 Super VL — reads the photo into a strict JSON schema (fallback: Nemotron 3 Nano Omni).
  - Nemotron 3 Ultra — the research agent, called once per audit, with tools: `tavily_search`, `tavily_extract`, `calc`. Budget of 8 tool calls, 6 turns, 150 s.
  - Nemotron 3.5 Lightning — writes the letter and the Pidgin summary in parallel, and repairs malformed JSON.
- **Tavily** search (advanced) + extract are the agent's only window onto the rules.
- **Source registry:** every URL Tavily returns is registered; any URL the agent cites that wasn't returned is stripped and the claim downgraded to low confidence. Only sourced tariffs enter the ₦ maths.
- **Code does all money maths**: six deterministic checks (readings, kWh × rate, VAT, bill total, token units, estimated read) and an overcharge calculator (arithmetic errors + the larger of band-mismatch or rate-above-approved).
- **Streaming:** the audit route streams NDJSON so the user watches every search and page read live.
- **Privacy:** names, addresses and full account numbers never reach the agent or Tavily; images are never stored.
- **Resilience for judging weeks later:** per-IP rate limits, a daily live-audit cap, and sample runs that replay a saved result if the live service is busy.
- 70+ unit tests (vitest), including a mocked end-to-end agent loop.

## Challenges we ran into

- Nigerian tariffs change often and are published unevenly — hardcoding them would make the app wrong within months, so everything is researched live and every number must carry a source.
- LLMs citing URLs they never visited — solved with the source registry.
- Getting reliable JSON from different models — capability probing plus a runtime fallback chain (`json_schema` → `json_object` → prompt) and one repair pass.
- `[Greg: add anything from real-photo testing]`

## Accomplishments that we're proud of

- An overcharge figure that is fully explainable: every naira has a formula and every rate has a link.
- The anti-hallucination source registry.
- A Pidgin summary you can forward to your street's WhatsApp group.

## What we learned

- Splitting work between a vision model, one heavyweight reasoning call and a fast writer keeps cost per audit low while keeping the research quality high.
- Making the LLM do the research and the code do the maths is the right split for anything involving money.
- `[Greg: add]`

## What's next for CrazyBill

WhatsApp bot for daily supply-hours logging; crowd-sourced feeder-level supply data; Nebius Serverless Jobs to refresh NERC tariff orders nightly; Nebius Serverless Endpoints; Hausa, Yoruba and Igbo; bulk mode for estate managers.

## Built with

nextjs, typescript, nvidia-nemotron, nebius-token-factory, tavily, vercel, tailwind

## Feedback on Nebius Token Factory and NVIDIA models

See the "Feedback" section of the README (filled from `npm run probe` / `npm run smoke` results). `[Greg: paste final version here]`
