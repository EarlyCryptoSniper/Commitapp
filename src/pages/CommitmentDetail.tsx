import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchCommitment,
  fetchLatestVerdict,
  fetchProofSignedUrl,
  requestReview,
  retryProof,
  type VerdictRow,
} from "../lib/lockin";
import {
  PROOF_LABELS,
  STATUS_LABELS,
  commitmentTitle,
  type Commitment,
} from "../lib/types";

function humanError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && !err.message.startsWith("{")) {
    return err.message;
  }
  return fallback;
}

function isVideoProof(item: Commitment, url: string | null): boolean {
  if (item.proof_type === "video") return true;
  if (!url) return false;
  return /\.(webm|mp4|mov)(\?|$)/i.test(url);
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

function nudge(
  status: Commitment["status"],
  beforeDeadline: boolean
): string {
  if (status === "locked") {
    return beforeDeadline
      ? "Nog tijd. Jij kunt dit."
      : "Deadline voorbij. Bewijs insturen kan niet meer.";
  }
  if (status === "reviewing") return "Bewijs is binnen. Even wachten op de keuring.";
  if (status === "completed") return "Gehaald. Mooi werk.";
  if (status === "insufficient_evidence") {
    return beforeDeadline
      ? "Nog niet overtuigend. Voor de deadline mag je opnieuw."
      : "Nog niet overtuigend. De deadline is voorbij.";
  }
  if (status === "failed") {
    return beforeDeadline
      ? "Nog niet gehaald. Voor de deadline mag je opnieuw."
      : "Niet gehaald. De deadline is voorbij.";
  }
  return "";
}

function polishReason(text: string): string {
  if (/zit nog niet in deze versie/i.test(text) || /video-keuring zit nog niet/i.test(text)) {
    return "Video kan niet worden beoordeeld. Gebruik een foto of foto voor + na.";
  }
  return text;
}

function verdictText(row: VerdictRow | null): string | null {
  if (!row) return null;
  const check = row.checklist ?? {};
  if (typeof check.reason === "string" && check.reason.trim()) {
    return polishReason(check.reason);
  }
  if (row.raw_response) {
    try {
      const parsed = JSON.parse(row.raw_response) as { reason?: string };
      if (parsed.reason) return polishReason(parsed.reason);
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
  const [proofUrl, setProofUrl] = useState<string | null>(null);
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
        if (!row) return;
        setVerdict(await fetchLatestVerdict(row.id));
        if (row.status !== "draft" && row.status !== "locked") {
          setProofUrl(await fetchProofSignedUrl(row.id));
        } else {
          setProofUrl(null);
        }
      })
      .catch((err: unknown) =>
        setError(humanError(err, "Niet gevonden"))
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
      setError(humanError(err, "Opnieuw keuren mislukt."));
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
      setProofUrl(null);
    } catch (err) {
      setError(humanError(err, "Opnieuw bewijs mislukt."));
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

  const why = verdictText(verdict);
  const beforeDeadline = new Date(item.deadline).getTime() > Date.now();
  const videoProof = isVideoProof(item, proofUrl);

  return (
    <section className="min-w-0 pt-2">
      <article className="rounded-2xl border border-line bg-panel p-5">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          {commitmentTitle(item)}
        </h1>
        {item.evidence_rule && (
          <p className="mt-2 text-sm leading-6 text-mute">{item.evidence_rule}</p>
        )}

        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {STATUS_LABELS[item.status]}
        </p>
        <p className="mt-2 text-sm leading-6">{nudge(item.status, beforeDeadline)}</p>
        {why && item.status !== "locked" && (
          <p className="mt-4 border-t border-line pt-4 text-sm leading-6">{why}</p>
        )}
        <p className="mt-4 text-sm" data-tick={tick}>
          {remaining(item.deadline)}
        </p>
        <p className="mt-1 text-xs text-mute">
          {new Date(item.deadline).toLocaleString("nl-NL")}
        </p>

        {error && (
          <p className="mt-4 text-sm text-danger" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        {proofUrl && videoProof && (
          <video
            src={proofUrl}
            controls
            playsInline
            className="mt-5 w-full max-w-full overflow-hidden rounded-xl border border-line bg-black"
            aria-label="Ingestuurd bewijs"
          />
        )}
        {proofUrl && !videoProof && (
          <img
            src={proofUrl}
            alt="Ingestuurd bewijs"
            className="mt-5 w-full max-w-full overflow-hidden rounded-xl border border-line"
          />
        )}

        <p className="mt-4 text-xs text-mute">
          {euro(item.amount_cents)} · {PROOF_LABELS[item.proof_type] ?? item.proof_type}
        </p>
      </article>

      {item.status === "locked" && (
        <Link
          to={`/commitment/${item.id}/proof`}
          className="mt-6 flex w-full items-center justify-center rounded-full bg-accent py-3.5 text-sm font-semibold text-ink hover:brightness-110"
        >
          Bewijs maken
        </Link>
      )}
      {item.status === "reviewing" && (
        <button
          type="button"
          disabled={busy}
          onClick={reviewAgain}
          className="mt-6 w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Bezig…" : "Opnieuw keuren"}
        </button>
      )}
      {(item.status === "insufficient_evidence" || item.status === "failed") &&
        beforeDeadline && (
          <button
            type="button"
            disabled={busy}
            onClick={tryAgain}
            className="mt-6 w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "Bezig…" : "Opnieuw bewijs maken"}
          </button>
        )}
    </section>
  );
}