import { Link } from "react-router-dom";
import { supabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TRUST } from "../lib/trustCopy";

const STEPS = [
  { n: "1", t: "Belofte", d: "Jij schrijft wat je doet." },
  { n: "2", t: "Bewijs", d: "Foto voor de deadline." },
  { n: "3", t: "Uitkomst", d: "Gehaald: van jou. Anders later fee." },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <section className="w-full min-w-0 max-w-full pt-5 sm:pt-6">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-accent">
        Belofte met inzet
      </p>
      <h1 className="max-w-[16ch] text-[2.15rem] font-semibold leading-[1.08] tracking-tight break-words sm:max-w-none sm:text-[2.85rem]">
        Zet een bedrag vast.{" "}
        <br className="hidden sm:block" />
        Doe wat je belooft.
      </h1>
      <p className="mt-4 w-full max-w-[32rem] text-[15px] leading-7 text-mute break-words">
        Je kiest een belofte en levert bewijs voor de deadline. {TRUST.feePass}{" "}
        {TRUST.feeFailLater} {TRUST.feeNow} {TRUST.noGambling}
      </p>

      {!supabaseConfigured && (
        <div className="mt-6 rounded-xl border border-line bg-panel p-4 text-sm text-mute">
          Supabase is nog niet gekoppeld. Kopieer <code>.env.example</code> naar{" "}
          <code>.env.local</code> en vul de project-URL plus de{" "}
          <strong className="text-white">anon</strong>-key in. Gebruik nooit de
          service-role key.
        </div>
      )}

      <div className="mt-7">
        <Link
          to={user ? "/dashboard" : "/auth"}
          className="inline-flex rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-ink transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {user ? "Naar overzicht" : "Zet vast"}
        </Link>
      </div>

      <ol className="mt-12 w-full min-w-0 divide-y divide-line border-y border-line sm:mt-14 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {STEPS.map((step) => (
          <li key={step.n} className="min-w-0 py-6 sm:px-5 sm:py-7 first:sm:pl-0 last:sm:pr-0">
            <p className="font-mono text-4xl font-semibold leading-none tracking-tight text-accent">
              {step.n}
            </p>
            <p className="mt-4 text-base font-semibold tracking-tight">{step.t}</p>
            <p className="mt-1.5 max-w-[20ch] text-sm leading-6 text-mute">
              {step.d}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}