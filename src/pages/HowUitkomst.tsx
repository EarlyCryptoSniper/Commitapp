import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { TRUST } from "../lib/trustCopy";

export function HowUitkomstPage() {
  const { user } = useAuth();
  return (
    <section className="pt-4">
      <p className="font-mono text-4xl font-semibold text-accent">3</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Uitkomst</h1>
      <p className="mt-3 text-sm leading-6 text-mute">
        Jij kiest de deadline. Daarna volgt de keuring.
      </p>
      <ul className="mt-6 space-y-3 text-sm leading-6">
        <li>Gehaald: mooi werk. {TRUST.feePass}</li>
        <li>Niet gehaald: {TRUST.feeFailLater}</li>
        <li>{TRUST.feeNow} {TRUST.noGambling}</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="rounded-full border border-line px-5 py-3 text-sm">
          Terug
        </Link>
        <Link
          to={user ? "/commitment/new" : "/auth"}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
        >
          Zet vast
        </Link>
      </div>
    </section>
  );
}