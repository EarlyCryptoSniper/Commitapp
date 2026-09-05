import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../lib/lockin";
import { requireSupabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export function AccountPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await requireSupabase().auth.signOut();
    navigate("/");
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 8) {
      setError("Minimaal 8 tekens.");
      return;
    }
    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await requireSupabase().auth.updateUser({
        password,
      });
      if (err) throw err;
      setPassword("");
      setConfirm("");
      setMessage("Wachtwoord is opgeslagen.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-w-0 pt-2">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mt-2 text-sm leading-6 text-mute">
        Jouw LockIn. Geen kansspel, geen pot.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-panel px-5 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mute">
          E-mail
        </p>
        <p className="mt-2 break-words text-sm">
          {loading ? "Laden…" : profile?.email ?? "—"}
        </p>
      </div>

      <form
        onSubmit={savePassword}
        className="mt-4 rounded-2xl border border-line bg-panel px-5 py-5"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mute">
          Wachtwoord
        </p>
        <p className="mt-2 text-sm leading-6 text-mute">
          Stel een wachtwoord in of wijzig het. Minimaal 8 tekens.
        </p>
        <label htmlFor="new-password" className="mt-4 block text-xs text-mute">
          Nieuw wachtwoord
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          className="mt-1.5 w-full min-w-0 rounded-2xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <label htmlFor="confirm-password" className="mt-4 block text-xs text-mute">
          Bevestig wachtwoord
        </label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
          className="mt-1.5 w-full min-w-0 rounded-2xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-accent"
        />
        {error && (
          <p className="mt-3 text-sm text-danger" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        {message && <p className="mt-3 text-sm text-accent">{message}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-full bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {busy ? "Bezig…" : "Wachtwoord opslaan"}
        </button>
      </form>

      <button
        type="button"
        onClick={logout}
        className="mt-8 w-full rounded-full border border-line py-3.5 text-sm text-mute transition hover:text-white"
      >
        Uitloggen
      </button>
    </section>
  );
}