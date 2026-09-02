import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCommitmentDraft, lockCommitment } from "../lib/lockin";
import { TASKS, TASK_LABELS, type TaskId } from "../lib/types";

type Step = "amount" | "task" | "deadline" | "sign" | "done";

function defaultDeadlineValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewCommitmentPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<500 | 1000>(1000);
  const [task, setTask] = useState<TaskId>("workout");
  const [deadlineLocal, setDeadlineLocal] = useState(defaultDeadlineValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);

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

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const deadline = new Date(deadlineLocal);
      if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
        throw new Error("Kies een deadline in de toekomst.");
      }
      const draft = await createCommitmentDraft({
        amountCents: amount,
        task,
        deadlineIso: deadline.toISOString(),
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
    <section className="pt-4">
      {step === "amount" && (
        <>
          <h1 className="text-2xl font-semibold">Hoeveel zet je vast?</h1>
          <p className="mt-2 text-sm text-mute">
            Bij slagen gebeurt er niets. Bij falen volgt later een servicefee.
            Nu wordt niets afgeschreven.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {([500, 1000] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={`rounded-2xl border py-6 text-xl font-semibold ${
                  amount === v
                    ? "border-accent bg-accent text-ink"
                    : "border-line bg-panel"
                }`}
              >
                €{v / 100}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep("task")}
            className="mt-8 w-full rounded-full bg-accent py-3 text-sm font-semibold text-ink"
          >
            Volgende
          </button>
        </>
      )}

      {step === "task" && (
        <>
          <h1 className="text-2xl font-semibold">Wat moet je doen?</h1>
          <ul className="mt-6 space-y-2">
            {TASKS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTask(item.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left ${
                    task === item.id
                      ? "border-accent bg-panel"
                      : "border-line bg-panel text-mute"
                  }`}
                >
                  <span className="block font-medium">{item.label}</span>
                  <span className="mt-1 block text-xs text-mute">
                    Bewijs: {item.proofLabel} — {item.hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("amount")}
              className="flex-1 rounded-full border border-line py-3 text-sm"
            >
              Terug
            </button>
            <button
              type="button"
              onClick={() => setStep("deadline")}
              className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-ink"
            >
              Volgende
            </button>
          </div>
        </>
      )}

      {step === "deadline" && (
        <>
          <h1 className="text-2xl font-semibold">Tot wanneer?</h1>
          <p className="mt-2 text-sm text-mute">
            Voor deze tijd moet het bewijs binnen zijn.
          </p>
          <input
            type="datetime-local"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            className="mt-6 w-full rounded-2xl border border-line bg-panel px-4 py-4 text-sm outline-none focus:border-accent"
          />
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("task")}
              className="flex-1 rounded-full border border-line py-3 text-sm"
            >
              Terug
            </button>
            <button
              type="button"
              onClick={() => setStep("sign")}
              className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-ink"
            >
              Volgende
            </button>
          </div>
        </>
      )}

      {step === "sign" && (
        <>
          <h1 className="text-2xl font-semibold">Teken je commitment</h1>
          <p className="mt-3 text-sm leading-6 text-mute">
            Ik doe {TASK_LABELS[task]} voor{" "}
            {new Date(deadlineLocal).toLocaleString("nl-NL")} of ik accepteer
            later een servicefee van €{amount / 100}. Geen kansspel. Nu geen
            afschrijving.
          </p>
          <canvas
            ref={canvasRef}
            width={360}
            height={160}
            className="mt-5 w-full touch-none rounded-2xl border border-line bg-panel"
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
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("deadline")}
              className="flex-1 rounded-full border border-line py-3 text-sm"
            >
              Terug
            </button>
            <button
              type="button"
              disabled={!signed || busy}
              onClick={confirm}
              className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
            >
              {busy ? "Bezig…" : "Ik zet vast"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <h1 className="text-2xl font-semibold">Vastgezet.</h1>
          <p className="mt-3 text-sm text-mute">
            {TASK_LABELS[task]} · €{amount / 100} · deadline{" "}
            {new Date(deadlineLocal).toLocaleString("nl-NL")}
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(lockedId ? `/commitment/${lockedId}` : "/dashboard")
            }
            className="mt-8 w-full rounded-full bg-accent py-3 text-sm font-semibold text-ink"
          >
            Naar commitment
          </button>
        </>
      )}
    </section>
  );
}