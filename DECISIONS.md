# Decisions

One line per non-obvious decision.

- Phase 0: build sandbox had no NEBIUS/TAVILY keys and its network blocked api.tokenfactory.nebius.com, api.tavily.com, api.vercel.com and ui.shadcn.com. Probes/list-models are written but not yet run; `capabilities.ts` holds conservative unverified defaults until `npm run probe -- --write` is run with real keys.
- Model IDs in `.env.example` are still the spec's third-party-listed IDs — UNVERIFIED until `npm run list-models` runs.
- `llm.ts` degrades JSON mode at runtime (json_schema → json_object → prompt) on a 4xx and remembers it per process, so unverified capabilities can't break the app.
- shadcn CLI registry unreachable → shadcn/ui components hand-written in `src/components/ui` from the same primitives (radix-ui, cva, tailwind-merge, sonner). Same API as generated shadcn components.
- Next.js 16.4 scaffold ships with `cacheComponents: true`; kept. All API routes are POST or request-dependent GET, so they stay dynamic.
- `@types/node` pinned to ^22 so vitest 5's peer range resolves.
- Playwright pinned to the preinstalled 1.63.0 so `make-samples` uses the bundled Chromium without a download.
- `export const runtime = "nodejs"` is rejected when `cacheComponents` is on; Node.js is the default runtime in Next 16, so routes only export `maxDuration`.
- Overcharge: B (band mismatch) and C (rate above approved) both price the same kWh at a lower rate, so only the larger is counted. A (arithmetic) is added independently.
- Overcharge A also counts kWh billed above the meter readings (reading_diff fail) × charged rate × VAT factor — an obvious overcharge the spec's A list didn't name.
- Postpaid arithmetic lines (energy charge, total) use the raw ₦ difference with no VAT uplift — conservative.
- Bill total: payments are subtracted as |payments| so "5,000" and "(5,000)" both reduce the balance.
- Tariffs are only used for ₦ maths if their sourceUrl survived source-registry validation and confidence isn't "low".
- Band mismatch also requires (in code) that reported hours are below the billed band's sourced minimum, if the agent found one.
- Verdict: `needs_info` is skipped when a code check failed (we already have something concrete); `likely_overcharged` also fires when code-proven arithmetic alone ≥ threshold (no source needed for maths); any positive total → at least `possible_issues`.
- Prepaid token check with VAT not printed assumes VAT_RATE_HINT and reports `info` instead of `fail`.
- Added `kind: "arithmetic" | "tariff"` to overcharge lines and a `meta` block to AuditResult (DisCo, masked account, doc type) for the UI/letter.
