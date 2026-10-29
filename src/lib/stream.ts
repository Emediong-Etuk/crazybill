// NDJSON helpers: one JSON event per line.
import type { AuditEvent } from "./schemas";

/** Server: creates a streaming Response and an emit() function. */
export function ndjsonStream(run: (emit: (e: AuditEvent) => void, signal: AbortSignal) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const ctrl = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: AuditEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        await run(emit, ctrl.signal);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Unexpected error", recoverable: true });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      ctrl.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Client: yields parsed events from an NDJSON response body. */
export async function* readNdjson(res: Response): AsyncGenerator<AuditEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try {
          yield JSON.parse(line) as AuditEvent;
        } catch {
          /* skip malformed line */
        }
      }
    }
    if (done) break;
  }
  const tail = buf.trim();
  if (tail) {
    try {
      yield JSON.parse(tail) as AuditEvent;
    } catch {
      /* ignore */
    }
  }
}
