/**
 * Copy for the create-flow bewijscontract step.
 * Referee verdict reasons stay in review-proof — do not invent fee-%.
 */
export const CONTRACT = {
  title: "Bewijscontract",
  passedTitle: "Gehaald",
  passedBody:
    "Bewijs voldoet aan je bewijseis en toont de belofte. LOCKIN-code leesbaar als die nodig is.",
  failedTitle: "Niet gehaald",
  failedBody: "Bewijs toont duidelijk dat de belofte niet is nagekomen.",
  insufficientTitle: "Onvoldoende",
  insufficientBody:
    "Bewijs ontbreekt, is onleesbaar of niet hard genoeg. Twijfel = onvoldoende. Geen cadeau-uitspraak.",
  lockinNote: "LOCKIN-code moet leesbaar in de foto staan.",
} as const;