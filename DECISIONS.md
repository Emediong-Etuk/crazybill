# Decisions

One line per non-obvious decision.

- Phase 0: build sandbox had no NEBIUS/TAVILY keys and its network blocked api.tokenfactory.nebius.com, api.tavily.com, api.vercel.com and ui.shadcn.com. Probes/list-models are written but not yet run; `capabilities.ts` holds conservative unverified defaults until `npm run probe -- --write` is run with real keys.
- Model IDs in `.env.example` are still the spec's third-party-listed IDs — UNVERIFIED until `npm run list-models` runs.
- `llm.ts` degrades JSON mode at runtime (json_schema → json_object → prompt) on a 4xx and remembers it per process, so unverified capabilities can't break the app.
- shadcn CLI registry unreachable → shadcn/ui components hand-written in `src/components/ui` from the same primitives (radix-ui, cva, tailwind-merge, sonner). Same API as generated shadcn components.
- Next.js 16.4 scaffold ships with `cacheComponents: true`; kept. All API routes are POST or request-dependent GET, so they stay dynamic.
- `@types/node` pinned to ^22 so vitest 5's peer range resolves.
- Playwright pinned to the preinstalled 1.63.0 so `make-samples` uses the bundled Chromium without a download.
