"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { QuestionsStep, type ExtractStatus } from "@/components/questions-step";
import { ReviewStep } from "@/components/review-step";
import { UploadStep } from "@/components/upload-step";
import { matchDisco } from "@/lib/discos";
import { sampleById, type SampleId } from "@/lib/samples";
import { emptyDoc, type ExtractedDoc, type UserContext } from "@/lib/schemas";

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
      const data = (await res.json().catch(() => ({}))) as { doc?: ExtractedDoc; error?: string };
      if (id !== runId.current) return;
      if (!res.ok || !data.doc) throw new Error(data.error ?? "We couldn't read this photo.");
      setDoc(data.doc);
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
      toast("Audit is coming in the next build phase.");
    },
    [],
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
    </div>
  );
}
