import { Link } from "react-router-dom";
import { supabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

export function LandingPage() {
  const { user } = useAuth();

  return (
    <section className="w-full min-w-0 max-w-full pt-10">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-mute">
        Habit commitment
      </p>
      <h1 className="max-w-full text-3xl font-semibold leading-tight break-words sm:text-4xl">
        Zet een bedrag vast.{" "}
        <br className="hidden sm:block" />
        Doe wat je belooft.
      </h1>
      <p className="mt-4 w-full max-w-md text-sm leading-6 text-mute break-words">
        LockIn is geen kansspel. Je wint geen geld van anderen. Als je de
        belofte haalt, blijft je geld van jou. Als je faalt, volgt later een
        servicefee. In deze versie wordt nog niets afgeschreven.
      </p>

      {!supabaseConfigured && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-4 text-sm text-mute">
          Supabase is nog niet gekoppeld. Kopieer <code>.env.example</code> naar{" "}
          <code>.env.local</code> en vul de project-URL plus de{" "}
          <strong className="text-white">anon</strong>-key in. Gebruik nooit de
          service-role key.
        </div>
      )}

      <div className="mt-8">
        <Link
          to={user ? "/dashboard" : "/auth"}
          className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
        >
          {user ? "Naar overzicht" : "Start commitment"}
        </Link>
      </div>
    </section>
  );
}