import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCommitment, fetchProofSignedUrl } from "../lib/lockin";
import {
  PROOF_LABELS,
  STATUS_LABELS,
  TASK_LABELS,
  type Commitment,
} from "../lib/types";

export function CommitmentDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Commitment | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCommitment(id)
      .then(async (row) => {
        setItem(row);
        if (row?.status === "completed") {
          setProofUrl(await fetchProofSignedUrl(row.id));
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Niet gevonden")
      );
  }, [id]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!item) return <p className="text-sm text-mute">Laden…</p>;

  const isVideo =
    item.proof_type === "video" ||
    Boolean(proofUrl?.includes(".mp4") || proofUrl?.includes(".mov"));

  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold">{TASK_LABELS[item.task]}</h1>
      <p className="mt-2 text-sm text-mute">{STATUS_LABELS[item.status]}</p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between border-b border-line py-2">
          <dt className="text-mute">Bedrag</dt>
          <dd>€{(item.amount_cents / 100).toFixed(0)}</dd>
        </div>
        <div className="flex justify-between border-b border-line py-2">
          <dt className="text-mute">Deadline</dt>
          <dd>{new Date(item.deadline).toLocaleString("nl-NL")}</dd>
        </div>
        <div className="flex justify-between border-b border-line py-2">
          <dt className="text-mute">Bewijs</dt>
          <dd>{PROOF_LABELS[item.proof_type] ?? item.proof_type}</dd>
        </div>
      </dl>

      {proofUrl && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          {isVideo ? (
            <video src={proofUrl} controls className="w-full" />
          ) : (
            <img src={proofUrl} alt="Bewijs" className="w-full" />
          )}
        </div>
      )}

      {item.status === "locked" && (
        <Link
          to={`/commitment/${item.id}/proof`}
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
        >
          Bewijs uploaden
        </Link>
      )}
      {item.status === "failed" && (
        <p className="mt-6 text-sm text-mute">Betaling volgt in v2.</p>
      )}
    </section>
  );
}