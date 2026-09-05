import { TRUST } from "../lib/trustCopy";

const ITEMS = [
  {
    q: "Wordt er nu geld afgeschreven?",
    a: TRUST.feeNow,
  },
  {
    q: "Wat als ik het haal?",
    a: TRUST.feePass,
  },
  {
    q: "Wat als ik het niet haal?",
    a: TRUST.feeFailLater,
  },
  {
    q: "Is dit een kansspel?",
    a: `${TRUST.noGambling} ${TRUST.age18}.`,
  },
  {
    q: "Wie keurt het bewijs?",
    a: `${TRUST.refereeWho} ${TRUST.refereeHow}`,
  },
] as const;

export function FaqPage() {
  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Vragen</h1>
      <dl className="mt-6 space-y-6 text-sm">
        {ITEMS.map((item) => (
          <div key={item.q}>
            <dt className="font-medium">{item.q}</dt>
            <dd className="mt-1.5 leading-6 text-mute">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}