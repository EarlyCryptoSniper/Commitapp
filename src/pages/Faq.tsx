import { TRUST } from "../lib/trustCopy";

export function FaqPage() {
  return (
    <section className="pt-4">
      <h1 className="text-2xl font-semibold">Vragen</h1>
      <dl className="mt-6 space-y-5 text-sm">
        <div>
          <dt className="font-medium">Wordt er nu geld afgeschreven?</dt>
          <dd className="mt-1 text-mute">{TRUST.feeNow}</dd>
        </div>
        <div>
          <dt className="font-medium">Wat als ik het haal?</dt>
          <dd className="mt-1 text-mute">{TRUST.feePass}</dd>
        </div>
        <div>
          <dt className="font-medium">Wat als ik het niet haal?</dt>
          <dd className="mt-1 text-mute">{TRUST.feeFailLater}</dd>
        </div>
        <div>
          <dt className="font-medium">Is dit een kansspel?</dt>
          <dd className="mt-1 text-mute">{TRUST.noGambling}</dd>
        </div>
        <div>
          <dt className="font-medium">Voor wie?</dt>
          <dd className="mt-1 text-mute">{TRUST.age18}</dd>
        </div>
      </dl>
    </section>
  );
}