import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchCommitment, finalizeProof, uploadProofFile } from "../lib/lockin";
import {
  PROOF_LABELS,
  TASK_LABELS,
  type Commitment,
} from "../lib/types";

export function ProofPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Commitment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCommitment(id)
      .then(setItem)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Niet gevonden")
      );
  }, [id]);

  function pick(
    setter: (f: File | null) => void,
    accept: string
  ) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.files?.[0] ?? null;
      if (next && accept.startsWith("image/") && !next.type.startsWith("image/")) {
        setError("Kies een foto.");
        return;
      }
      if (next && accept.startsWith("video/") && !next.type.startsWith("video/")) {
        setError("Kies een video.");
        return;
      }
      setError(null);
      setter(next);
    };
  }

  async function submit() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      let path: string;
      if (item.proof_type === "photo_pair") {
        if (!before || !after) throw new Error("Upload een foto voor en een foto na.");
        await uploadProofFile({
          commitmentId: item.id,
          file: before,
          slot: "before",
        });
        path = await uploadProofFile({
          commitmentId: item.id,
          file: after,
          slot: "after",
        });
      } else {
        if (!file) throw new Error("Kies eerst een bestand.");
        path = await uploadProofFile({
          commitmentId: item.id,
          file,
          slot: "proof",
        });
      }
      await finalizeProof(item.id, path);
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

  const accept =
    item.proof_type === "video"
      ? "video/mp4,video/quicktime"
      : "image/jpeg,image/png,image/webp";

  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold">Bewijs</h1>
      <p className="mt-2 text-sm text-mute">
        {TASK_LABELS[item.task]} · {PROOF_LABELS[item.proof_type]}
      </p>
      <p className="mt-1 text-sm text-mute">
        Deadline {new Date(item.deadline).toLocaleString("nl-NL")}. Inhoud
        wordt nu niet gekeurd — alleen of het bestand op tijd binnen is.
      </p>

      {item.proof_type === "photo_pair" ? (
        <div className="mt-6 space-y-4">
          <label className="block text-sm">
            Foto voor
            <input
              type="file"
              accept={accept}
              capture="environment"
              onChange={pick(setBefore, "image/")}
              className="mt-2 block w-full text-sm text-mute"
            />
          </label>
          <label className="block text-sm">
            Foto na
            <input
              type="file"
              accept={accept}
              capture="environment"
              onChange={pick(setAfter, "image/")}
              className="mt-2 block w-full text-sm text-mute"
            />
          </label>
        </div>
      ) : (
        <label className="mt-6 block text-sm">
          {item.proof_type === "video" ? "Video" : "Foto"}
          <input
            type="file"
            accept={accept}
            capture={item.proof_type === "video" ? undefined : "environment"}
            onChange={pick(
              setFile,
              item.proof_type === "video" ? "video/" : "image/"
            )}
            className="mt-2 block w-full text-sm text-mute"
          />
        </label>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="mt-8 w-full rounded-full bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
      >
        {busy ? "Bezig…" : "Bewijs insturen"}
      </button>
    </section>
  );
}