import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchCommitment,
  finalizeProof,
  issueChallenge,
  requestReview,
  uploadProofFile,
} from "../lib/lockin";
import {
  PROOF_LABELS,
  TASK_LABELS,
  type Commitment,
} from "../lib/types";

export function ProofPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [item, setItem] = useState<Commitment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [before, setBefore] = useState<File | null>(null);
  const [shot, setShot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [camOn, setCamOn] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchCommitment(id)
      .then(async (row) => {
        setItem(row);
        if (row?.status === "locked" && row.proof_type !== "photo_pair") {
          const ch = await issueChallenge(row.id);
          setCode(ch.code);
          setExpiresAt(ch.expiresAt);
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Niet gevonden")
      );
    return () => stopCam();
  }, [id]);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
    setRecording(false);
  }

  async function startCam() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch {
      setError("Camera geweigerd of niet beschikbaar.");
    }
  }

  async function snap(kind: "proof" | "before" | "after") {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("Camera is nog niet klaar. Wacht een seconde.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) {
      setError("Foto maken mislukt.");
      return;
    }
    const file = new File([blob], `${kind}.jpg`, { type: "image/jpeg" });
    setPreview(URL.createObjectURL(blob));
    if (kind === "before") setBefore(file);
    else setShot(file);
    setError(null);
  }

  function startVideo() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setShot(new File([blob], "proof.webm", { type: "video/webm" }));
      setPreview(URL.createObjectURL(blob));
    };
    rec.start();
    setRecording(true);
    window.setTimeout(() => {
      if (recorderRef.current?.state === "recording") rec.stop();
      setRecording(false);
    }, 45000);
  }

  function stopVideo() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  async function ensureAfterChallenge() {
    if (!item) return;
    if (code && expiresAt && new Date(expiresAt).getTime() > Date.now()) return;
    const ch = await issueChallenge(item.id);
    setCode(ch.code);
    setExpiresAt(ch.expiresAt);
  }

  async function submit() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        throw new Error("Challenge verlopen. Vernieuw de pagina.");
      }
      let path: string;
      if (item.proof_type === "photo_pair") {
        if (!before || !shot) {
          throw new Error("Maak een foto voor en een foto na.");
        }
        await uploadProofFile({
          commitmentId: item.id,
          file: before,
          slot: "before",
        });
        path = await uploadProofFile({
          commitmentId: item.id,
          file: shot,
          slot: "after",
        });
      } else {
        if (!shot) throw new Error("Maak eerst bewijs met de camera.");
        path = await uploadProofFile({
          commitmentId: item.id,
          file: shot,
          slot: "proof",
        });
      }
      stopCam();
      await finalizeProof(item.id, path);
      try {
        await requestReview(item.id);
      } catch {
        navigate(`/commitment/${item.id}`);
        return;
      }
      navigate(`/commitment/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload mislukt.");
    } finally {
      setBusy(false);
    }
  }

  if (!item) {
    return <p className="text-sm text-mute">{error ?? "Laden…"}</p>;
  }

  if (item.status !== "locked") {
    return (
      <section className="pt-6">
        <h1 className="text-2xl font-semibold">Bewijs</h1>
        <p className="mt-3 text-sm text-mute">
          Deze commitment wacht niet op bewijs.
        </p>
      </section>
    );
  }

  const needChallenge = item.proof_type !== "photo_pair" || Boolean(before);

  return (
    <section className="w-full min-w-0 pt-4">
      <h1 className="text-2xl font-semibold">Bewijs</h1>
      <p className="mt-2 text-sm text-mute">
        {TASK_LABELS[item.task]} · {PROOF_LABELS[item.proof_type]}
      </p>

      {needChallenge && code && (
        <div className="mt-5 rounded-2xl border border-accent bg-panel px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-mute">
            Challenge — houd dit in beeld
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-widest">
            LOCKIN {code}
          </p>
        </div>
      )}

      <video
        ref={videoRef}
        className="mt-5 w-full max-w-full rounded-2xl border border-line bg-black"
        playsInline
        muted
      />

      {preview && (
        <div className="mt-4">
          <p className="text-sm font-medium">Genomen bewijs</p>
          {shot?.type.startsWith("video/") ? (
            <video src={preview} controls className="mt-2 w-full rounded-2xl" />
          ) : (
            <img src={preview} alt="Bewijs" className="mt-2 w-full rounded-2xl" />
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!camOn ? (
          <button
            type="button"
            onClick={startCam}
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
          >
            Camera starten
          </button>
        ) : item.proof_type === "video" ? (
          recording ? (
            <button
              type="button"
              onClick={stopVideo}
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
            >
              Stop opname
            </button>
          ) : (
            <button
              type="button"
              onClick={startVideo}
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
            >
              Start opname
            </button>
          )
        ) : item.proof_type === "photo_pair" && !before ? (
          <button
            type="button"
            onClick={() => snap("before")}
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
          >
            Foto voor
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              if (item.proof_type === "photo_pair") await ensureAfterChallenge();
              await snap(item.proof_type === "photo_pair" ? "after" : "proof");
            }}
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
          >
            {item.proof_type === "photo_pair" ? "Foto na" : "Foto maken"}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-mute">
        {before ? "Voor-foto klaar. " : ""}
        {shot ? "Bewijs klaar om in te sturen." : "Nog geen foto."}
      </p>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={busy || !shot}
        onClick={submit}
        className="mt-8 w-full rounded-full bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
      >
        {busy ? "Bezig…" : "Bewijs insturen"}
      </button>
    </section>
  );
}