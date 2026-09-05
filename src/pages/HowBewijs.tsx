import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { TRUST } from "../lib/trustCopy";

export function HowBewijsPage() {
  const { user } = useAuth();
  return (
    <section className="pt-4">
      <p className="font-mono text-4xl font-semibold text-accent">2</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Bewijs</h1>
      <p className="mt-3 text-sm leading-6 text-mute">
        Voor de deadline stuur je bewijs in. Dat is een foto, foto voor + na,
        of video.
      </p>
      <ul className="mt-6 space-y-3 text-sm leading-6">
        <li>Foto = een beeld. Foto voor + na = begin en eind. Video = beweging.</li>
        <li>De LOCKIN-code moet leesbaar in beeld staan.</li>
        <li>
          {TRUST.refereeWho} {TRUST.refereeHow}
        </li>
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