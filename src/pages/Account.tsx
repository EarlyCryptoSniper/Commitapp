import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../lib/lockin";
import { requireSupabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export function AccountPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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