import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function HowBeloftePage() {
  const { user } = useAuth();
  return (
    <section className="pt-4">
      <p className="font-mono text-4xl font-semibold text-accent">1</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Belofte</h1>
      <p className="mt-3 text-sm leading-6 text-mute">
        LockIn is een belofte aan jezelf. Je zegt wat je doet. Daarna doe je
        dat.
      </p>
      <ul className="mt-6 space-y-3 text-sm leading-6">
        <li>Schrijf iets positiefs: wat je wel doet.</li>
        <li>Niet: "ik doe X niet". Dat is niet te bewijzen.</li>
        <li>Schrijf hoe je het op een foto of video laat zien.</li>
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