import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCommitments } from "../lib/lockin";
import { STATUS_LABELS, TASK_LABELS, type Commitment } from "../lib/types";

type Filter = "all" | "open" | "reviewing" | "done";

function matches(item: Commitment, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return item.status === "locked" || item.status === "draft";
  if (filter === "reviewing") return item.status === "reviewing";
  return (
    item.status === "completed" ||
    item.status === "failed" ||
    item.status === "insufficient_evidence"
  );
}

export function DashboardPage() {
  const [items, setItems] = useState<Commitment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetchCommitments()
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Kon commitments niet laden")
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = items.filter((item) => matches(item, filter));

  return (
    <section className="pt-2">
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Overzicht</h1>
        <Link to="/commitment/new" className="text-sm text-accent">
          Nieuw
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "Alles"],
            ["open", "Open"],
            ["reviewing", "In beoordeling"],
            ["done", "Afgerond"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === id
                ? "bg-accent text-ink"
                : "border border-line text-mute"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-mute">Laden…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && visible.length === 0 && (
        <p className="text-sm text-mute">Niets in deze filter.</p>
      )}

      <ul className="space-y-3">
        {visible.map((item) => (
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
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}