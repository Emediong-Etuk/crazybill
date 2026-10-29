// Lists Nemotron models on Nebius Token Factory and checks the env model IDs exist.
// Usage: npm run list-models
import { requireEnv } from "./env";
import { models, nebius } from "../src/lib/config";

async function main() {
  requireEnv("NEBIUS_API_KEY");
  const res = await fetch(`${nebius.baseUrl}models`, {
    headers: { Authorization: `Bearer ${nebius.apiKey}` },
  });
  if (!res.ok) {
    console.error(`GET /models → ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = (await res.json()) as { data?: { id: string }[] };
  const ids = (body.data ?? []).map((m) => m.id);
  const nemotron = ids.filter((id) => /nemotron/i.test(id)).sort();
  console.log(`\n${ids.length} models total, ${nemotron.length} Nemotron:\n`);
  for (const id of nemotron) console.log(`  ${id}`);

  console.log("\nEnv model check:");
  const wanted = {
    MODEL_VISION: models.vision,
    MODEL_VISION_FALLBACK: models.visionFallback,
    MODEL_REASON: models.reason,
    MODEL_FAST: models.fast,
  };
  let missing = 0;
  for (const [name, id] of Object.entries(wanted)) {
    const ok = ids.includes(id);
    if (!ok) missing++;
    const guess = ok ? "" : `  → closest: ${closest(id, nemotron) ?? "(none)"}`;
    console.log(`  ${ok ? "✓" : "✗"} ${name}=${id}${guess}`);
  }
  if (missing) {
    console.log(
      "\nUpdate .env.example + .env.local with the closest real IDs and log it in DECISIONS.md.",
    );
    process.exitCode = 2;
  }
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Simple similarity: longest common subsequence length over normalised IDs.
function closest(target: string, candidates: string[]): string | null {
  const t = norm(target);
  let best: string | null = null;
  let bestScore = -1;
  for (const c of candidates) {
    const s = norm(c);
    const dp: number[] = new Array(s.length + 1).fill(0);
    for (let i = 1; i <= t.length; i++) {
      let prev = 0;
      for (let j = 1; j <= s.length; j++) {
        const tmp = dp[j];
        dp[j] = t[i - 1] === s[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    const score = dp[s.length] / Math.max(t.length, s.length);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
