import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCommitments } from "../lib/lockin";
import { STATUS_LABELS, TASK_LABELS, type Commitment } from "../lib/types";

export function DashboardPage() {
  const [items, setItems] = useState<Commitment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommitments()
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Kon commitments niet laden")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="pt-2">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Overzicht</h1>
        <Link to="/commitment/new" className="text-sm text-accent">
          Nieuw
        </Link>
      </div>

      {loading && <p className="text-sm text-mute">Laden…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-sm text-mute">
            Nog geen commitments. De wizard komt in phase 2. De database en
            beveiliging staan al klaar.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={`/commitment/${item.id}`}
              className="block rounded-2xl border border-line bg-panel p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{TASK_LABELS[item.task]}</p>
                <span className="text-xs text-mute">
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-mute">
                €{(item.amount_cents / 100).toFixed(0)} · deadline{" "}
                {new Date(item.deadline).toLocaleString("nl-NL")}
              </p>
              {item.status === "failed" && (
                <p className="mt-2 text-xs text-mute">Betaling volgt in v2.</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
