import { useMemo, useState } from "react";

type DeadlinePickerProps = {
  value: string;
  min: string;
  max: string;
  error?: string | null;
  onChange: (next: string) => void;
};

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseLocal(value: string): Date {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

function atSeven(d: Date) {
  const next = new Date(d);
  next.setHours(7, 0, 0, 0);
  return next;
}

export function DeadlinePicker({
  value,
  min,
  max,
  error,
  onChange,
}: DeadlinePickerProps) {
  const selected = parseLocal(value);
  const minDate = parseLocal(min);
  const maxDate = parseLocal(max);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1)
  );

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i += 1) cells.push(null);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= last; day += 1) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  function pickDay(day: Date) {
    const next = new Date(day);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(toLocalInput(next));
    setOpen(false);
  }

  function setTime(hours: number, minutes: number) {
    const next = new Date(selected);
    next.setHours(hours, minutes, 0, 0);
    onChange(toLocalInput(next));
  }

  function chip(label: string, date: Date) {
    const stamp = toLocalInput(date);
    const ok = date.getTime() >= minDate.getTime() && date.getTime() <= maxDate.getTime();
    return (
      <button
        key={label}
        type="button"
        disabled={!ok}
        onClick={() => {
          onChange(stamp);
          setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
          setOpen(false);
        }}
        className="rounded-full border border-line px-3 py-1.5 text-xs text-mute disabled:opacity-40"
      >
        {label}
      </button>
    );
  }

  const tomorrow = atSeven(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const week = atSeven(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  return (
    <div className="w-full min-w-0">
      <label htmlFor="deadline-summary" className="block text-xs font-medium text-mute">
        Bewijs voor
      </label>
      <button
        id="deadline-summary"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 w-full min-w-0 rounded-2xl border border-line bg-panel px-4 py-3.5 text-left text-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {selected.toLocaleString("nl-NL", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        {chip("Morgen 07:00", tomorrow)}
        {chip("Over 7 dagen 07:00", week)}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Kalender"
          className="mt-3 w-full min-w-0 rounded-2xl border border-line bg-panel p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-full px-2 py-1 text-sm text-mute"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              aria-label="Vorige maand"
            >
              Vorige
            </button>
            <p className="text-sm font-medium capitalize">{monthLabel(cursor)}</p>
            <button
              type="button"
              className="rounded-full px-2 py-1 text-sm text-mute"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              aria-label="Volgende maand"
            >
              Volgende
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-mute">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <span key={`e-${i}`} />;
              const tooSoon = startOfDay(day).getTime() < startOfDay(minDate).getTime();
              const tooLate = startOfDay(day).getTime() > startOfDay(maxDate).getTime();
              const disabled = tooSoon || tooLate;
              const active = sameDay(day, selected);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={`h-9 rounded-full text-sm disabled:opacity-30 ${
                    active ? "bg-accent text-ink" : "text-white"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="deadline-hour" className="block text-xs text-mute">
                Uur
              </label>
              <input
                id="deadline-hour"
                type="number"
                min={0}
                max={23}
                value={selected.getHours()}
                onChange={(e) =>
                  setTime(Math.min(23, Math.max(0, Number(e.target.value) || 0)), selected.getMinutes())
                }
                className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="deadline-minute" className="block text-xs text-mute">
                Minuut
              </label>
              <input
                id="deadline-minute"
                type="number"
                min={0}
                max={59}
                step={5}
                value={selected.getMinutes()}
                onChange={(e) =>
                  setTime(
                    selected.getHours(),
                    Math.min(59, Math.max(0, Number(e.target.value) || 0))
                  )
                }
                className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}