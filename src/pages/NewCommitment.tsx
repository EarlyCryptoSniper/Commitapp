import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCommitmentDraft, lockCommitment } from "../lib/lockin";
import { promiseGate } from "../lib/promisePolicy";
import { TRUST } from "../lib/trustCopy";
import { PROOF_LABELS, type ProofType } from "../lib/types";

type Step = "write" | "amount" | "deadline" | "contract" | "sign" | "done";

const STEPS: Step[] = ["write", "amount", "deadline", "contract", "sign", "done"];
const PROOF_CHOICES = ["photo", "photo_pair"] as const;

/** Product: bewijs mag maximaal 30 dagen vooruit liggen. */
const MAX_DEADLINE_DAYS = 30;

const fieldClass =
  "mt-1.5 w-full min-w-0 rounded-2xl border border-line bg-panel px-4 py-3.5 text-sm outline-none transition focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const primaryBtn =
  "flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40";
const secondaryBtn =
  "flex-1 rounded-full border border-line py-3 text-sm text-mute transition hover:text-white";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeadlineValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  return toLocalInput(d);
}

function deadlineBounds() {
  const min = new Date(Date.now() + 60_000);
  const max = new Date(Date.now() + MAX_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
  return { min: toLocalInput(min), max: toLocalInput(max) };
}

function deadlineError(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Kies een geldige datum en tijd.";
  if (d.getTime() <= Date.now() + 30_000) {
    return "Kies een moment in de toekomst.";
  }
  const max = Date.now() + MAX_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  if (d.getTime() > max) {
    return `Maximaal ${MAX_DEADLINE_DAYS} dagen vooruit.`;
  }
  return null;
}

function StepMark({ step }: { step: Step }) {
  const i = STEPS.indexOf(step);
  return (
    <div className="mb-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mute">
        Stap {i + 1} van {STEPS.length}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {STEPS.map((id, n) => (
          <span
            key={id}
            className={`h-1.5 flex-1 rounded-full ${
              n <= i ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function NewCommitmentPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const [step, setStep] = useState<Step>("write");
  const [amount, setAmount] = useState<500 | 1000>(1000);
  const [promiseText, setPromiseText] = useState("");
  const [evidenceRule, setEvidenceRule] = useState("");
  const [proofType, setProofType] = useState<ProofType>("photo");
  const [deadlineLocal, setDeadlineLocal] = useState(defaultDeadlineValue);
  const [deadlineHint, setDeadlineHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);

  const kind: ProofType = proofType === "photo_pair" ? "photo_pair" : "photo";
  const gate = promiseGate(promiseText, evidenceRule);
  const canWrite =
    promiseText.trim().length >= 8 &&
    evidenceRule.trim().length >= 8 &&
    !gate.block;
  const bounds = deadlineBounds();
  const timeError = deadlineError(deadlineLocal);

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function clearSign() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
  }

  function goContract() {
    const msg = deadlineError(deadlineLocal);
    setDeadlineHint(msg);
    if (msg) return;
    setStep("contract");
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const msg = deadlineError(deadlineLocal);
      if (msg) throw new Error(msg);
      const blocked = promiseGate(promiseText, evidenceRule).block;
      if (blocked) throw new Error(blocked);
      const deadline = new Date(deadlineLocal);
      const draft = await createCommitmentDraft({
        amountCents: amount,
        deadlineIso: deadline.toISOString(),
        promiseText: promiseText.trim(),
        evidenceRule: evidenceRule.trim(),
        proofType: kind,
        timezone: "Europe/Amsterdam",
      });
      const locked = await lockCommitment(draft.id);
      setLockedId(locked.id);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vastzetten mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-w-0 flex-col pt-2">
      {step !== "done" && <StepMark step={step} />}

      {step === "write" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Wat beloof je?</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            Schrijf wat je wél doet, en hoe je dat op een foto laat zien.
            Geen "ik doe X niet".
          </p>
          <label htmlFor="promise-text" className="mt-7 block text-xs font-medium text-mute">
            Belofte
          </label>
          <textarea
            id="promise-text"
            value={promiseText}
            onChange={(e) => setPromiseText(e.target.value)}
            rows={4}
            maxLength={280}
            placeholder="Bijvoorbeeld: ik ruim mijn bureau op vóór morgen 07:00."
            className={fieldClass}
          />
          <label htmlFor="evidence-rule" className="mt-5 block text-xs font-medium text-mute">
            Wat telt als bewijs?
          </label>
          <textarea
            id="evidence-rule"
            value={evidenceRule}
            onChange={(e) => setEvidenceRule(e.target.value)}
            rows={4}
            maxLength={400}
            placeholder="Bijvoorbeeld: foto van hetzelfde bureau, daarna zichtbaar leger."
            className={fieldClass}
          />
          <p className="mt-5 text-xs font-medium text-mute">Soort bewijs</p>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
            {PROOF_CHOICES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setProofType(id)}
                className={`rounded-full px-4 py-2 text-xs font-medium ${
                  kind === id
                    ? "bg-accent text-ink"
                    : "border border-line text-mute"
                }`}
              >
                {PROOF_LABELS[id]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-mute">
            Bewijs is foto of foto voor + na. Video kan nu niet worden beoordeeld.
          </p>
          {gate.warn && !gate.block && (
            <p className="mt-4 text-sm text-mute">{gate.warn}</p>
          )}
          {gate.block && (
            <p className="mt-4 text-sm text-danger" role="alert" aria-live="polite">
              {gate.block}
            </p>
          )}
          <div className="mt-8">
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setStep("amount")}
              className={`w-full ${primaryBtn}`}
            >
              Volgende
            </button>
          </div>
        </>
      )}

      {step === "amount" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Hoeveel zet je vast?</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            {TRUST.feePass} {TRUST.feeFailLater} {TRUST.feeNow}
          </p>
          <p className="mt-2 text-sm leading-6 text-mute">
            Bewijs moet vóór de deadline binnen zijn. De regels zijn jouw
            bewijseis, niet dit bedrag.
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3">
            {([500, 1000] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`min-h-[5.5rem] rounded-2xl border text-xl font-semibold ${
                  amount === v
                    ? "border-accent bg-accent text-ink"
                    : "border-line bg-panel text-mute"
                }`}
              >
                €{v / 100}
              </button>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setStep("write")} className={secondaryBtn}>
              Terug
            </button>
            <button type="button" onClick={() => setStep("deadline")} className={primaryBtn}>
              Volgende
            </button>
          </div>
        </>
      )}

      {step === "deadline" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Tot wanneer?</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            Jij kiest tot wanneer het bewijs binnen moet zijn. Voorstel:
            morgen 07:00 — pas gerust aan.
          </p>
          <label htmlFor="commitment-deadline" className="mt-7 block text-xs font-medium text-mute">
            Bewijs vóór
          </label>
          <input
            id="commitment-deadline"
            type="datetime-local"
            min={bounds.min}
            max={bounds.max}
            value={deadlineLocal}
            onChange={(e) => {
              setDeadlineLocal(e.target.value);
              setDeadlineHint(deadlineError(e.target.value));
            }}
            className={`${fieldClass} min-h-[3.5rem]`}
          />
          {(deadlineHint || timeError) && (
            <p className="mt-2 text-sm text-danger" role="alert" aria-live="polite">
              {deadlineHint ?? timeError}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setStep("amount")} className={secondaryBtn}>
              Terug
            </button>
            <button
              type="button"
              disabled={Boolean(timeError)}
              onClick={goContract}
              className={primaryBtn}
            >
              Volgende
            </button>
          </div>
        </>
      )}

      {step === "contract" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Bewijscontract</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            {promiseText.trim()} · {PROOF_LABELS[kind]}. Dit wordt vastgezet bij
            je handtekening. Geen vrije interpretatie achteraf.
          </p>
          <dl className="mt-6 space-y-4">
            {(
              [
                [
                  "Gehaald",
                  evidenceRule.trim()
                    ? `${evidenceRule.trim()} Dat toont de belofte.`
                    : "Bewijs voldoet aan je bewijseis en toont de belofte.",
                ],
                [
                  "Niet gehaald",
                  "Bewijs toont aantoonbaar dat de belofte niet is nagekomen.",
                ],
                [
                  "Onvoldoende",
                  "Bewijs ontbreekt, is onleesbaar, of niet hard genoeg. Twijfel = onvoldoende. Geen cadeau-PASS.",
                ],
                [
                  "Opdrachtcode",
                  kind === "photo_pair"
                    ? "LOCKIN-code leesbaar op de na-foto."
                    : "LOCKIN-code leesbaar in de foto.",
                ],
              ] as const
            ).map(([label, body]) => (
              <div key={label} className="rounded-2xl border border-line bg-panel px-4 py-4">
                <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-mute">
                  {label}
                </dt>
                <dd className="mt-2 text-sm leading-6">{body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setStep("deadline")} className={secondaryBtn}>
              Terug
            </button>
            <button type="button" onClick={() => setStep("sign")} className={primaryBtn}>
              Ik snap het
            </button>
          </div>
        </>
      )}

      {step === "sign" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Teken je belofte</h1>
          <p className="mt-3 text-sm leading-6 text-mute">
            Ik doe "{promiseText.trim()}" voor{" "}
            {new Date(deadlineLocal).toLocaleString("nl-NL")}. {TRUST.feePass}{" "}
            {TRUST.feeFailLater} {TRUST.feeNow} {TRUST.noGambling} Bewijs:{" "}
            {evidenceRule.trim()}
          </p>
          <canvas
            ref={canvasRef}
            width={360}
            height={160}
            role="img"
            aria-label="Handtekening"
            className="mt-6 w-full max-w-full min-w-0 touch-none rounded-2xl border border-line bg-panel"
            onPointerDown={(e) => {
              drawing.current = true;
              canvasRef.current?.getContext("2d")?.beginPath();
              paint(e);
            }}
            onPointerMove={(e) => {
              if (drawing.current) {
                paint(e);
                setSigned(true);
              }
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
          />
          <button
            type="button"
            onClick={clearSign}
            className="mt-2 text-xs text-mute"
          >
            Wis handtekening
          </button>
          {error && (
            <p className="mt-3 text-sm text-danger" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setStep("contract")} className={secondaryBtn}>
              Terug
            </button>
            <button
              type="button"
              disabled={!signed || busy}
              onClick={confirm}
              className={primaryBtn}
            >
              {busy ? "Bezig…" : "Ik zet vast"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Vastgezet.</h1>
          <p className="mt-3 text-sm leading-6">{promiseText.trim()}</p>
          <p className="mt-2 text-sm text-mute">
            {new Date(deadlineLocal).toLocaleString("nl-NL")}
          </p>
          <p className="mt-1 text-xs text-mute">
            €{amount / 100} · {TRUST.feeNow}
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(lockedId ? `/commitment/${lockedId}` : "/dashboard")
            }
            className={`mt-8 w-full ${primaryBtn}`}
          >
            Naar belofte
          </button>
        </>
      )}
    </section>
  );
}