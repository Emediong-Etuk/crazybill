import { limits } from "@/lib/config";
import { extractDocument } from "@/lib/extract";
import { LlmError } from "@/lib/llm";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const maxDuration = 60;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const rl = checkRateLimit(`extract:${clientIp(req)}`, limits.ratePerHour * 2);
  if (!rl.ok) {
    return json({ error: `Too many uploads. Try again in about ${Math.ceil(rl.retryAfterSec / 60)} min.` }, 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Send the photo as multipart/form-data." }, 400);
  }
  const file = form.get("image");
  if (!(file instanceof File)) return json({ error: "No image received." }, 400);
  if (!ALLOWED.has(file.type)) {
    return json({ error: "Please upload a JPEG, PNG or WebP photo. (iPhone HEIC: take a screenshot and upload that.)" }, 415);
  }
  if (file.size > limits.maxUploadBytes) return json({ error: "That photo is too large (max 4 MB)." }, 413);

  try {
    // Processed in memory only — never written to disk or logged.
    const buf = Buffer.from(await file.arrayBuffer());
    const { doc, trace } = await extractDocument(buf, file.type);
    return json({ doc, trace });
  } catch (e) {
    const config = e instanceof LlmError && e.kind === "config";
    console.error("extract failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return json(
      {
        error: config
          ? "The reading service is not configured on this server."
          : "We couldn't read this photo right now. You can type the numbers in yourself, or try again.",
      },
      config ? 503 : 502,
    );
  }
}
