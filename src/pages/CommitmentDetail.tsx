import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCommitment } from "../lib/lockin";
import { STATUS_LABELS, TASK_LABELS, type Commitment } from "../lib/types";

export function CommitmentDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Commitment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCommitment(id)
      .then(setItem)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Niet gevonden")
      );
  }, [id]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!item) return <p className="text-sm text-mute">Laden…</p>;

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
          <dd>Foto</dd>
        </div>
      </dl>
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
