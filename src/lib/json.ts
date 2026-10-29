import type { ZodType, z } from "zod";

export class JsonParseError extends Error {
  constructor(
    message: string,
    public raw: string,
  ) {
    super(message);
    this.name = "JsonParseError";
  }
}

/** Returns the first balanced {...} in text, respecting strings and escapes. */
export function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function stripFences(text: string): string {
  return text.replace(/```(?:json|JSON)?\s*/g, "").replace(/```/g, "");
}

/** Parses + validates without any model call. Returns an error string on failure. */
export function tryParseJson<S extends ZodType>(
  text: string,
  schema: S,
): { ok: true; value: z.infer<S> } | { ok: false; error: string } {
  const cleaned = stripFences(text.replace(/<think>[\s\S]*?<\/think>/gi, ""));
  const candidate = firstJsonObject(cleaned);
  if (!candidate) return { ok: false, error: "no JSON object found" };
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch (e) {
    // Common model slip: trailing commas.
    try {
      data = JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
    }
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, value: parsed.data as z.infer<S> };
}

export type RepairFn = (badText: string, error: string) => Promise<string>;

/**
 * Robust parse: strip fences/think tags, take the first balanced object, JSON.parse, zod-validate.
 * On failure, ONE repair attempt via `repair` (normally a MODEL_FAST call), then validate again.
 */
export async function parseJson<S extends ZodType>(
  text: string,
  schema: S,
  repair?: RepairFn,
): Promise<z.infer<S>> {
  const first = tryParseJson(text, schema);
  if (first.ok) return first.value;
  if (!repair) throw new JsonParseError(first.error, text);
  const fixed = await repair(text, first.error);
  const second = tryParseJson(fixed, schema);
  if (second.ok) return second.value;
  throw new JsonParseError(`after repair: ${second.error}`, fixed);
}
