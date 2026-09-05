import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchCommitment,
  finalizeProof,
  issueChallenge,
  requestReview,
  uploadProofFile,
} from "../lib/lockin";
import { commitmentTitle, type Commitment } from "../lib/types";

function humanError(err: unknown): string {
  if (err instanceof Error && err.message && !err.message.startsWith("{")) {
    return err.message;
  }
  return "Er ging iets mis.";
}

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
      .catch((err: unknown) => setError(humanError(err)));
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

  async function snap(kind: "proof" | "before" | "after", stamp?: string | null) {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      setError("Camera is nog niet klaar. Wacht een seconde.");
      return;
    }
    const mark = stamp ?? code;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    if (kind !== "before" && mark) {
      const bar = Math.max(56, Math.round(canvas.height * 0.12));
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, canvas.height - bar, canvas.width, bar);
      ctx.fillStyle = "#39ff14";
      ctx.font = `bold ${Math.max(28, Math.round(canvas.width * 0.07))}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(`LOCKIN ${mark}`, 24, canvas.height - bar / 2);
    }
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

  async function takeAfter(row: Commitment) {
    let mark = code;
    if (!mark || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
      const ch = await issueChallenge(row.id);
      setCode(ch.code);
      setExpiresAt(ch.expiresAt);
      mark = ch.code;
    }
    await snap(row.proof_type === "photo_pair" ? "after" : "proof", mark);
  }

  async function submit() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        throw new Error("Opdrachtcode verlopen. Vernieuw de pagina.");
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
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!item) {
    return (
      <p
        className="text-sm text-mute"
        {...(error ? { role: "alert", "aria-live": "polite" } : {})}
      >
        {error ?? "Laden…"}
      </p>
    );
  }

  if (item.status !== "locked") {
    return (
      <section className="pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bewijs</h1>
        <p className="mt-3 text-sm leading-6 text-mute">
          Deze belofte wacht nu niet op een nieuwe foto. Open de belofte voor
          de status.
        </p>
        <Link
          to={`/commitment/${item.id}`}
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-ink"
        >
          Naar belofte
        </Link>
      </section>
    );
  }

  const row = item;
  const needChallenge = row.proof_type !== "photo_pair" || Boolean(before);
  const primaryLabel = !camOn
    ? "Camera starten"
    : row.proof_type === "video"
      ? recording
        ? "Stop opname"
        : shot
          ? "Opnieuw opnemen"
          : "Start opname"
      : row.proof_type === "photo_pair" && !before
        ? "Foto voor"
        : shot
          ? "Opnieuw foto"
          : row.proof_type === "photo_pair"
            ? "Foto na"
            : "Foto maken";

  function onPrimary() {
    if (!camOn) {
      void startCam();
      return;
    }
    if (row.proof_type === "video") {
      recording ? stopVideo() : startVideo();
      return;
    }
    if (row.proof_type === "photo_pair" && !before) {
      void snap("before");
      return;
    }
    void takeAfter(row);
  }

  const ready = Boolean(shot);
  const hint = !camOn
    ? "Houd de opdrachtcode in beeld als je fotografeert."
    : before && !shot
      ? "Voor-foto klaar. Nu de na-foto."
      : shot
        ? "Mooi. Insturen als het beeld scherp is."
        : "Houd de opdrachtcode in beeld. Jij kunt dit.";

  return (
    <section className="w-full min-w-0">
      <div className="relative -mx-4 overflow-hidden bg-black">
        <video
          ref={videoRef}
          aria-label="Cameravoorbeeld"
          className="block h-[64vh] min-h-[300px] w-full max-w-full object-cover"
          playsInline
          muted
        />
        {needChallenge && code && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/85 px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
              Komt op de foto
            </p>
            <p className="mt-1 break-words text-[1.85rem] font-semibold leading-none tracking-[0.14em] text-accent sm:text-4xl">
              LOCKIN {code}
            </p>
          </div>
        )}
        {!camOn && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-mute">
            Camera staat uit.
          </p>
        )}
      </div>

      <p className="mt-3 truncate text-sm text-mute">{commitmentTitle(row)}</p>

      {row.proof_type === "video" && (
        <p className="mt-2 text-xs leading-5 text-mute">
          Video kan nu niet worden beoordeeld. Nieuwe beloftes gebruiken foto
          of foto voor + na.
        </p>
      )}

      {preview &&
        (shot?.type.startsWith("video/") ? (
          <video
            src={preview}
            muted
            className="mt-3 h-14 w-14 rounded-xl object-cover"
            aria-label="Opgenomen bewijs"
          />
        ) : (
          <img
            src={preview}
            alt="Genomen bewijs"
            className="mt-3 h-14 w-14 rounded-xl object-cover"
          />
        ))}

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <p className="mt-3 text-center text-xs leading-5 text-mute">{hint}</p>

      <button
        type="button"
        onClick={onPrimary}
        className={`mt-4 w-full rounded-full py-3.5 text-sm font-semibold ${
          ready
            ? "border border-line text-white"
            : "bg-accent text-ink hover:brightness-110"
        }`}
      >
        {primaryLabel}
      </button>

      <button
        type="button"
        disabled={busy || !shot}
        onClick={submit}
        className={`mt-3 w-full rounded-full py-3.5 text-sm font-semibold disabled:opacity-40 ${
          ready
            ? "bg-accent text-ink hover:brightness-110"
            : "border border-line text-mute"
        }`}
      >
        {busy ? "Bezig met keuren…" : "Bewijs insturen"}
      </button>
    </section>
  );
}