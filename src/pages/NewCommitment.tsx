import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeadlinePicker } from "../components/DeadlinePicker";
import { SignPad } from "../components/SignPad";
import { createCommitmentDraft, lockCommitment } from "../lib/lockin";
import { CONTRACT } from "../lib/contractCopy";
import { PROMISE_EXAMPLES } from "../lib/promiseExamples";
import { promiseGate } from "../lib/promisePolicy";
import { TRUST } from "../lib/trustCopy";
import { PROOF_LABELS, type ProofType } from "../lib/types";

type Step = "write" | "amount" | "deadline" | "contract" | "sign" | "done";

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

function phaseOf(step: Step): { n: number; label: string } {
  if (step === "write") return { n: 1, label: "Belofte" };
  if (step === "amount") return { n: 2, label: "Inzet" };
  if (step === "deadline") return { n: 2, label: "Deadline" };
  return { n: 3, label: "Vastzetten" };
}

function StepMark({ step }: { step: Step }) {
  const phase = phaseOf(step);
  return (
    <div className="mb-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mute">
        Fase {phase.n} van 3 · {phase.label}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${
              n <= phase.n ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-mute">
        Foto insturen doe je na het vastzetten.
      </p>
    </div>
  );
}

export function NewCommitmentPage() {
  const navigate = useNavigate();
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

  const kind: ProofType =
    proofType === "photo_pair" ? "photo_pair" : "photo";
  const gate = promiseGate(promiseText, evidenceRule);
  const canWrite =
    promiseText.trim().length >= 8 &&
    evidenceRule.trim().length >= 8 &&
    !gate.block;
  const bounds = deadlineBounds();
  const timeError = deadlineError(deadlineLocal);

  function applyExample(id: string) {
    const example = PROMISE_EXAMPLES.find((item) => item.id === id);
    if (!example) return;
    setPromiseText(example.promiseText);
    setEvidenceRule(example.evidenceRule);
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
            Schrijf wat je wel doet, en hoe je dat op een foto laat zien.
            Geen "ik doe X niet".
          </p>
          <p className="mt-5 text-xs font-medium text-mute">Voorbeelden</p>
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
            {PROMISE_EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => applyExample(example.id)}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-mute"
              >
                {example.label}
              </button>
            ))}
          </div>
          <label htmlFor="promise-text" className="mt-7 block text-xs font-medium text-mute">
            Belofte
          </label>
          <textarea
            id="promise-text"
            value={promiseText}
            onChange={(e) => setPromiseText(e.target.value)}
            rows={4}
            maxLength={280}
            placeholder="Bijvoorbeeld: ik ruim mijn bureau op voor morgen 07:00."
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
            Foto = een beeld. Foto voor + na = begin en eind.
          </p>
          <p className="mt-1 text-xs leading-5 text-mute" aria-disabled="true">
            Video volgt later — keuring kan dat nu niet eerlijk.
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
            {TRUST.moneyLine}
          </p>
          <p className="mt-2 text-sm leading-6 text-mute">
            Bewijs moet voor de deadline binnen zijn. De regels zijn jouw
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
                EUR {v / 100}
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
            morgen 07:00 - pas gerust aan.
          </p>
          <div className="mt-7">
            <DeadlinePicker
              value={deadlineLocal}
              min={bounds.min}
              max={bounds.max}
              error={deadlineHint ?? timeError}
              onChange={(next) => {
                setDeadlineLocal(next);
                setDeadlineHint(deadlineError(next));
              }}
            />
          </div>
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
          <h1 className="text-2xl font-semibold tracking-tight">{CONTRACT.title}</h1>
          <p className="mt-2 text-sm leading-6 text-mute">
            {promiseText.trim()} · {PROOF_LABELS[kind]}. Dit wordt vastgezet bij
            je handtekening. Geen vrije interpretatie achteraf.
          </p>
          <dl className="mt-6 space-y-4">
            {(
              [
                [CONTRACT.passedTitle, CONTRACT.passedBody],
                [CONTRACT.failedTitle, CONTRACT.failedBody],
                [CONTRACT.insufficientTitle, CONTRACT.insufficientBody],
                ["Opdrachtcode", CONTRACT.lockinNote],
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
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-mute">
            Zo ziet keuring LOCKIN:
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-accent/40 bg-panel px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
                {CONTRACT.proofGoodTitle}
              </p>
              <p className="mt-2 text-sm leading-6">{CONTRACT.proofGoodBody}</p>
            </div>
            <div className="rounded-2xl border border-line bg-panel px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mute">
                {CONTRACT.proofBadTitle}
              </p>
              <p className="mt-2 text-sm leading-6">{CONTRACT.proofBadBody}</p>
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setStep("deadline")} className={secondaryBtn}>
              Terug
            </button>
            <button type="button" onClick={() => setStep("sign")} className={primaryBtn}>
              Verder naar handtekening
            </button>
          </div>
        </>
      )}

      {step === "sign" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Teken je belofte</h1>
          <p className="mt-3 text-sm leading-6 text-mute">
            Belofte: "{promiseText.trim()}" ·{" "}
            {new Date(deadlineLocal).toLocaleString("nl-NL")}. {TRUST.noGambling}{" "}
            Bewijs: {evidenceRule.trim()}
          </p>
          <p className="mt-3 text-sm font-medium">
            Inzet: EUR {amount / 100} · {TRUST.feeNow}
          </p>
          <div className="mt-6">
            <SignPad onSignedChange={setSigned} />
          </div>
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
            EUR {amount / 100} · {TRUST.feeNow}
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