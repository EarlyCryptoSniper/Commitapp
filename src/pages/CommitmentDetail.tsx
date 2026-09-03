import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchCommitment,
  fetchLatestVerdict,
  requestReview,
  retryProof,
  type VerdictRow,
} from "../lib/lockin";
import {
  PROOF_LABELS,
  STATUS_LABELS,
  TASK_LABELS,
  type Commitment,
} from "../lib/types";

function remaining(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Deadline voorbij";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}u ${m}m resterend`;
}

function nudge(status: Commitment["status"]): string {
  if (status === "locked") return "Nog tijd. Jij kunt dit.";
  if (status === "reviewing") return "Bewijs is binnen. Even wachten op de keuring.";
  if (status === "completed") return "Gehaald. Mooi werk.";
  if (status === "insufficient_evidence")
    return "Nog niet overtuigend. Voor de deadline mag je opnieuw.";
  if (status === "failed") return "Niet gehaald. De volgende telt weer.";
  return "";
}

function verdictText(row: VerdictRow | null): string | null {
  if (!row) return null;
  const check = row.checklist ?? {};
  if (typeof check.reason === "string" && check.reason.trim()) return check.reason;
  if (row.raw_response) {
    try {
      const parsed = JSON.parse(row.raw_response) as { reason?: string };
      if (parsed.reason) return parsed.reason;
    } catch {
      /* raw is not json */
    }
  }
  if (row.result === "passed") return "De criteria zijn gehaald.";
  if (row.result === "failed") return "De criteria zijn aantoonbaar niet gehaald.";
  return "De keuring kon het bewijs niet hard maken.";
}

export function CommitmentDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<Commitment | null>(null);
  const [verdict, setVerdict] = useState<VerdictRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchCommitment(id)
      .then(async (row) => {
        setItem(row);
        if (row) setVerdict(await fetchLatestVerdict(row.id));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Niet gevonden")
      );
  }, [id]);

  async function reviewAgain() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      await requestReview(item.id);
      const next = await fetchCommitment(item.id);
      setItem(next);
      if (next) setVerdict(await fetchLatestVerdict(next.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Keuring mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function tryAgain() {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const next = await retryProof(item.id);
      setItem(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opnieuw proberen mislukt");
    } finally {
      setBusy(false);
    }
  }

  if (!item) return <p className="text-sm text-mute">{error ?? "Laden…"}</p>;

  const why = verdictText(verdict);
  const beforeDeadline = new Date(item.deadline).getTime() > Date.now();

  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold">{TASK_LABELS[item.task]}</h1>
      <p className="mt-2 text-sm text-mute">{STATUS_LABELS[item.status]}</p>
      <p className="mt-1 text-sm">{nudge(item.status)}</p>
      <p className="mt-1 text-xs text-mute" data-tick={tick}>
        {remaining(item.deadline)} ·{" "}
        {new Date(item.deadline).toLocaleString("nl-NL")}
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {why && item.status !== "locked" && (
        <p className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-sm">
          {why}
        </p>
      )}
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between border-b border-line py-2">
          <dt className="text-mute">Bedrag</dt>
          <dd>€{(item.amount_cents / 100).toFixed(0)}</dd>
        </div>
        <div className="flex justify-between border-b border-line py-2">
          <dt className="text-mute">Bewijs</dt>
          <dd>{PROOF_LABELS[item.proof_type] ?? item.proof_type}</dd>
        </div>
      </dl>
      {item.status === "locked" && (
        <Link
          to={`/commitment/${item.id}/proof`}
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
        >
          Bewijs maken
        </Link>
      )}
      {item.status === "reviewing" && (
        <button
          type="button"
          disabled={busy}
          onClick={reviewAgain}
          className="mt-6 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? "Bezig…" : "Opnieuw keuren"}
        </button>
      )}
      {item.status === "insufficient_evidence" && beforeDeadline && (
        <button
          type="button"
          disabled={busy}
          onClick={tryAgain}
          className="mt-6 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? "Bezig…" : "Opnieuw bewijs maken"}
        </button>
      )}
    </section>
  );
}