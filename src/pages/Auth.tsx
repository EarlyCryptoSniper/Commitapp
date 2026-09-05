import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { requireSupabase, supabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

type Mode = "login" | "signup" | "magic";

function authError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const t = raw.toLowerCase();
  if (t.includes("invalid login")) return "E-mail of wachtwoord klopt niet.";
  if (t.includes("email not confirmed")) return "Bevestig eerst je e-mail.";
  if (t.includes("user already registered")) return "Dit e-mailadres heeft al een account.";
  if (t.includes("signups not allowed")) return "Registreren staat nu uit.";
  if (t.includes("rate limit") || t.includes("too many")) return "Te veel pogingen. Wacht even.";
  if (t.includes("user not found") || t.includes("otp")) {
    return "Geen account met dit e-mailadres, of de link is verlopen.";
  }
  return "Lukt niet. Check e-mail/wachtwoord of probeer later.";
}

const TABS: { id: Mode; label: string }[] = [
  { id: "login", label: "Inloggen" },
  { id: "magic", label: "Link per e-mail" },
  { id: "signup", label: "Account maken" },
];

const inputClass =
  "mt-1.5 w-full min-w-0 rounded-2xl border border-line bg-panel px-4 py-3.5 text-sm outline-none transition focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AuthPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const db = requireSupabase();

    try {
      if (mode === "signup") {
        const { error: err } = await db.auth.signUp({ email, password });
        if (err) throw err;
        setMessage("Account aangemaakt. Bevestig je e-mail als dat gevraagd wordt.");
      } else if (mode === "login") {
        const { error: err } = await db.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
      } else {
        const { error: err } = await db.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (err) throw err;
        setMessage("Check je inbox voor de link.");
      }
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full min-w-0 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signup" ? "Account maken" : "Inloggen"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-mute">
        Log in om beloftes vast te zetten en bij te houden.
      </p>
      <p className="mt-1 text-sm leading-6 text-mute">
        {mode === "magic"
          ? "We sturen een loginlink. Nieuw? Kies Account maken."
          : mode === "signup"
            ? "Kies een wachtwoord van minimaal 8 tekens."
            : "Wachtwoord of een link per e-mail."}
      </p>

      <div
        className="mt-6 grid w-full min-w-0 grid-cols-3 gap-1 rounded-full border border-line bg-panel p-1"
        role="tablist"
        aria-label="Inlogmethode"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => switchMode(tab.id)}
            className={`min-w-0 rounded-full px-1 py-2.5 text-center text-[11px] font-medium leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-xs ${
              mode === tab.id ? "bg-accent text-ink" : "text-mute"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="auth-email" className="block text-xs font-medium text-mute">
            E-mail
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="jij@email.nl"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            className={inputClass}
          />
        </div>
        {mode !== "magic" && (
          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-mute">
              Wachtwoord
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              title="Minimaal 8 tekens."
              placeholder="Wachtwoord"
              value={password}
              onInvalid={(e) => {
                e.currentTarget.setCustomValidity("Minimaal 8 tekens.");
              }}
              onChange={(e) => {
                e.currentTarget.setCustomValidity("");
                setPassword(e.target.value);
                setError(null);
              }}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-mute">Minimaal 8 tekens.</p>
          </div>
        )}
        <button
          disabled={busy}
          className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Bezig…" : mode === "signup" ? "Account maken" : "Doorgaan"}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-accent">{message}</p>}
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}