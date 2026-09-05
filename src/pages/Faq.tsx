import { TRUST } from "../lib/trustCopy";

const ITEMS = [
  {
    q: "Hoe zit het met het geld?",
    a: TRUST.moneyLine,
  },
  {
    q: "Is dit een kansspel?",
    a: `${TRUST.noGambling} ${TRUST.age18}. Alleen 18+.`,
  },
  {
    q: "Wie is de AI-scheidsrechter?",
    a: `${TRUST.refereeWho} ${TRUST.refereeHow} Geen menselijke jury in deze versie.`,
  },
  {
    id: "privacy",
    q: "Wat gebeurt er met mijn foto's?",
    a: TRUST.privacyLine,
  },
  {
    q: "Wat is de LOCKIN-code?",
    a: "Bij vastzetten krijg je een korte code. Die moet leesbaar op je bewijsfoto staan (zelfde scene als je belofte). Ontbreekt of onleesbaar = meestal onvoldoende.",
  },
  {
    q: "Wat als de keuring twijfelt?",
    a: "Twijfel = onvoldoende. Je mag opnieuw bewijs sturen zolang de deadline niet voorbij is. Geen cadeau-uitspraak.",
  },
  {
    q: "Camera werkt niet / ik wil geen toestemming geven.",
    a: "Kies een foto uit je galerij. Zorg dat de LOCKIN-code en je belofte zichtbaar zijn.",
  },
  {
    q: "Kan ik video gebruiken?",
    a: "Nog niet voor nieuwe beloftes — keuring kan video nu niet eerlijk beoordelen. Gebruik foto of foto voor + na.",
  },
] as const;

export function FaqPage() {
  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Vragen</h1>
      <dl className="mt-6 space-y-6 text-sm">
        {ITEMS.map((item) => (
          <div key={item.q} id={"id" in item ? item.id : undefined}>
            <dt className="font-medium">{item.q}</dt>
            <dd className="mt-1.5 leading-6 text-mute">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}