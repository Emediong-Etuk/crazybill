"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { INITIAL_STEPS, ProgressSteps, type StepState, type ToolEvent } from "@/components/progress-steps";
import { ResultsView } from "@/components/results/results-view";
import { Button } from "@/components/ui/button";
import { QuestionsStep, type ExtractStatus } from "@/components/questions-step";
import { ReviewStep } from "@/components/review-step";
import { UploadStep } from "@/components/upload-step";
import { matchDisco } from "@/lib/discos";
import { maskAccount } from "@/lib/format";
import { readNdjson } from "@/lib/stream";
import { sampleById, type SampleId } from "@/lib/samples";
import { emptyDoc, type AuditResult, type ExtractedDoc, type TraceEntry, type UserContext } from "@/lib/schemas";

type Stage = "upload" | "questions" | "review" | "auditing" | "results";

const DEFAULT_CONTEXT: UserContext = { disco: "", avgHoursPerDay: 12, daysAtThisLevel: 7, meterSituation: "unsure" };

async function compress(file: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    fileType: "image/jpeg",
    useWebWorker: true,
  });
}

export function Flow() {
  const [stage, setStage] = useState<Stage>("upload");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [context, setContext] = useState<UserContext>(DEFAULT_CONTEXT);
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [extractStatus, setExtractStatus] = useState<ExtractStatus>("reading");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState<SampleId | undefined>(undefined);
  const [extractTrace, setExtractTrace] = useState<TraceEntry[]>([]);
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [tools, setTools] = useState<ToolEvent[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [personal, setPersonal] = useState<{ name: string | null; address: string | null }>({ name: null, address: null });
  const runId = useRef(0);
  const contextTouched = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = useCallback(() => {
    runId.current++;
    setStage("upload");
    setDoc(null);
    setPreviewUrl(null);
    setContext(DEFAULT_CONTEXT);
    setSampleId(undefined);
    setExtractError(null);
    setExtractTrace([]);
    setResult(null);
    setAuditError(null);
    setNotice(null);
    contextTouched.current = false;
  }, []);

  const runExtraction = useCallback(async (file: File, sid?: SampleId) => {
    const id = ++runId.current;
    setExtractStatus("reading");
    setExtractError(null);
    setDoc(null);
    try {
      const body = new FormData();
      body.append("image", file, "bill.jpg");
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { doc?: ExtractedDoc; trace?: TraceEntry[]; error?: string };
      if (id !== runId.current) return;
      if (!res.ok || !data.doc) throw new Error(data.error ?? "We couldn't read this photo.");
      setDoc(data.doc);
      setExtractTrace(data.trace ?? []);
      setExtractStatus("done");
      const match = matchDisco(data.doc.disco);
      if (match && !contextTouched.current && !sid) setContext((c) => ({ ...c, disco: c.disco || match.code }));
      if (!sid && data.doc.docType === "prepaid_token" && !contextTouched.current) {
        setContext((c) => ({ ...c, meterSituation: c.meterSituation === "unsure" ? "prepaid_meter" : c.meterSituation }));
      }
    } catch (e) {
      if (id !== runId.current) return;
      // Samples fall back to the saved extraction so the demo keeps working.
      if (sid) {
        const cached = await fetch(`/samples/${sid}.result.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (cached?.doc) {
          setDoc(cached.doc as ExtractedDoc);
          setExtractStatus("done");
          toast("Live reading is busy — using a saved reading of this sample.");
          return;
        }
      }
      setExtractError(e instanceof Error ? e.message : "We couldn't read this photo.");
      setExtractStatus("error");
      setDoc(emptyDoc());
    }
  }, []);

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        let upload: File;
        try {
          upload = await compress(file);
        } catch {
          if (["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 4 * 1024 * 1024) {
            upload = file;
          } else {
            toast.error("Please take a screenshot of the photo and upload that.");
            return;
          }
        }
        setSampleId(undefined);
        setPreviewUrl(URL.createObjectURL(upload));
        setStage("questions");
        void runExtraction(upload);
      } finally {
        setBusy(false);
      }
    },
    [runExtraction],
  );

  const onSample = useCallback(
    async (id: SampleId) => {
      const sample = sampleById(id);
      if (!sample) return;
      setBusy(true);
      try {
        const blob = await fetch(sample.image).then((r) => r.blob());
        const file = new File([blob], `${id}.png`, { type: blob.type || "image/png" });
        setSampleId(id);
        setContext(sample.context);
        contextTouched.current = true;
        setPreviewUrl(URL.createObjectURL(file));
        setStage("questions");
        void runExtraction(file, id);
      } catch {
        toast.error("Couldn't load the sample. Check your connection.");
      } finally {
        setBusy(false);
      }
    },
    [runExtraction],
  );

  const onContextChange = (c: UserContext) => {
    contextTouched.current = true;
    setContext(c);
  };

  const startAudit = useCallback(
    async (reviewed: ExtractedDoc) => {
      setDoc(reviewed);
      setPersonal({ name: reviewed.customerName, address: reviewed.address });
      setStage("auditing");
      setSteps(INITIAL_STEPS);
      setTools([]);
      setNotice(null);
      setAuditError(null);
      setResult(null);
      const id = runId.current;
      // Name and address stay on the phone; only the last 4 digits of the account leave it.
      const outgoing: ExtractedDoc = { ...reviewed, customerName: null, address: null, accountOrMeterNo: maskAccount(reviewed.accountOrMeterNo) };
      let finished = false;
      try {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: outgoing, context, sampleId }),
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "The audit service is unavailable right now.");
        }
        for await (const ev of readNdjson(res)) {
          if (id !== runId.current) return;
          if (ev.type === "step") {
            setSteps((prev) => prev.map((s) => (s.id === ev.id ? { ...s, status: ev.status, label: ev.label } : s)));
          } else if (ev.type === "tool") {
            setTools((prev) => [...prev, { name: ev.name, summary: ev.summary }]);
          } else if (ev.type === "notice") {
            setNotice(ev.message);
            if (ev.replay) {
              setSteps(INITIAL_STEPS);
              setTools([]);
            }
          } else if (ev.type === "result") {
            const r = ev.data;
            const merged: AuditResult = r.cached
              ? r
              : {
                  ...r,
                  trace: [...extractTrace, ...r.trace],
                  totals: {
                    latencyMs: r.totals.latencyMs + extractTrace.reduce((s, t) => s + t.latencyMs, 0),
                    estCostUsd: r.totals.estCostUsd + extractTrace.reduce((s, t) => s + (t.estCostUsd ?? 0), 0),
                  },
                };
            finished = true;
            setResult(merged);
            setStage("results");
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
        if (!finished) throw new Error("The audit stopped before it finished. Please try again.");
      } catch (e) {
        if (id !== runId.current) return;
        setAuditError(e instanceof Error ? e.message : "Something went wrong.");
      }
    },
    [context, sampleId, extractTrace],
  );

  return (
    <div className="flex flex-col gap-6">
      {stage === "upload" && <UploadStep onFile={onFile} onSample={onSample} busy={busy} />}
      {stage === "questions" && (
        <QuestionsStep
          previewUrl={previewUrl}
          context={context}
          onChange={onContextChange}
          extractStatus={extractStatus}
          extractError={extractError}
          onContinue={() => setStage("review")}
          onBack={reset}
        />
      )}
      {stage === "review" && (
        <ReviewStep
          doc={doc}
          loading={extractStatus === "reading"}
          onSubmit={startAudit}
          onBack={() => setStage("questions")}
        />
      )}
      {stage === "auditing" && !auditError && <ProgressSteps steps={steps} tools={tools} notice={notice} />}
      {stage === "auditing" && auditError && (
        <section className="flex flex-col gap-4" role="alert">
          <div className="flex gap-3 rounded-xl border-2 border-signal bg-white p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-signal" aria-hidden />
            <div>
              <h2 className="font-heading text-lg font-extrabold">The audit couldn&apos;t finish</h2>
              <p className="text-sm">{auditError}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {doc && (
              <Button onClick={() => startAudit(doc)} size="lg">
                Try again
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => setStage("review")}>
              Back to the fields
            </Button>
            {!sampleId && (
              <Button variant="ghost" size="lg" onClick={() => onSample("postpaid-estimated")}>
                See a sample audit
              </Button>
            )}
          </div>
        </section>
      )}
      {stage === "results" && result && <ResultsView result={result} notice={notice} personal={personal} onRestart={reset} />}
    </div>
  );
}
