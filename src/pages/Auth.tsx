import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { requireSupabase, supabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

type Mode = "login" | "signup" | "magic";

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
        setMessage("Check je inbox voor de magic link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-6">
      <h1 className="text-2xl font-semibold">
        {mode === "signup" ? "Account maken" : "Inloggen"}
      </h1>
      <p className="mt-2 text-sm text-mute">
        Magic link maakt geen nieuw account. Gebruik daarvoor Account maken.
      </p>

      <div className="mt-5 flex gap-2 text-sm">
        <button
          className={mode === "login" ? "text-accent" : "text-mute"}
          onClick={() => setMode("login")}
          type="button"
        >
          Wachtwoord
        </button>
        <button
          className={mode === "magic" ? "text-accent" : "text-mute"}
          onClick={() => setMode("magic")}
          type="button"
        >
          Magic link
        </button>
        <button
          className={mode === "signup" ? "text-accent" : "text-mute"}
          onClick={() => setMode("signup")}
          type="button"
        >
          Account maken
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
        />
        {mode !== "magic" && (
          <input
            type="password"
            required
            minLength={8}
            placeholder="Wachtwoord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm outline-none focus:border-accent"
          />
        )}
        <button
          disabled={busy}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Bezig…" : mode === "signup" ? "Account maken" : "Doorgaan"}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-accent">{message}</p>}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </section>
  );
}
