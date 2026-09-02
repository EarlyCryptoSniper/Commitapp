export function ProofPage() {
  return (
    <section className="pt-6">
      <h1 className="text-2xl font-semibold">Bewijs</h1>
      <p className="mt-3 text-sm leading-6 text-mute">
        Foto-upload komt in phase 2. De database accepteert afronden alleen via
        <code className="mx-1 text-white">finalize_proof</code>
        als de commitment locked is en de deadline nog niet voorbij is.
      </p>
    </section>
  );
}
