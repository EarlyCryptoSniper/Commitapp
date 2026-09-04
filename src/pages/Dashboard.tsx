import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCommitments } from "../lib/lockin";
import {
  STATUS_LABELS,
  commitmentTitle,
  type Commitment,
  type CommitmentStatus,
} from "../lib/types";

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

function remaining(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Deadline voorbij";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}u ${m}m resterend`;
}

function euro(cents: number): string {
  return `EUR ${(cents / 100).toFixed(0)}`;
}

function pillClass(status: CommitmentStatus): string {
  if (status === "completed") return "bg-accent text-ink";
  if (status === "reviewing") return "border border-accent text-accent";
  if (status === "failed") return "border border-danger text-danger";
  if (status === "insufficient_evidence") return "border border-line text-white";
  return "border border-line text-mute";
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
        setError(err instanceof Error ? err.message : "Kon beloftes niet laden")
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = items.filter((item) => matches(item, filter));

  return (
    <section className="w-full min-w-0 pt-2">
      <div className="mb-5 flex min-w-0 items-end justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
          Mijn beloftes
        </h1>
        <Link
          to="/commitment/new"
          className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-ink"
        >
          Nieuw
        </Link>
      </div>

      <div
        className="mb-6 grid w-full min-w-0 grid-cols-4 gap-1 rounded-full border border-line bg-panel p-1"
        role="tablist"
        aria-label="Filter"
      >
        {(
          [
            ["all", "Alles"],
            ["open", "Open"],
            ["reviewing", "Beoordeling"],
            ["done", "Klaar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`min-w-0 rounded-full px-1 py-2 text-center text-[11px] font-medium leading-tight sm:text-xs ${
              filter === id ? "bg-accent text-ink" : "text-mute"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-mute">Laden…</p>}
      {error && (
        <p className="text-sm text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-line bg-panel px-4 py-6">
          <p className="text-sm leading-6 text-mute">
            Nog geen beloftes hier. Zet er een vast — jij kunt dit.
          </p>
          <Link
            to="/commitment/new"
            className="mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink"
          >
            Nieuwe belofte
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((item) => (
          <li key={item.id} className="min-w-0">
            <Link
              to={`/commitment/${item.id}`}
              className="block min-w-0 rounded-2xl border border-line bg-panel p-4 transition hover:border-accent/50"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="min-w-0 break-words text-[15px] font-semibold leading-5 tracking-tight">
                  {commitmentTitle(item)}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${pillClass(
                    item.status
                  )}`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="mt-3 text-sm">{remaining(item.deadline)}</p>
              <p className="mt-1 text-xs text-mute">
                {euro(item.amount_cents)} ·{" "}
                {new Date(item.deadline).toLocaleString("nl-NL")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}