import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../lib/lockin";
import { requireSupabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export function AccountPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => undefined);
  }, []);

  async function logout() {
    await requireSupabase().auth.signOut();
    navigate("/");
  }

  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="mt-3 text-sm text-mute">{profile?.email ?? "—"}</p>
      <button
        onClick={logout}
        className="mt-8 w-full rounded-full border border-line py-3 text-sm"
      >
        Uitloggen
      </button>
    </section>
  );
}
