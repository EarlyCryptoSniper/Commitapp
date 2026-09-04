/**
 * Estimate-only keyword filter. Not a moral AI. Referee still judges after proof.
 * Create-time block ("Deze belofte laten we niet toe.") is intentionally
 * shorter than the referee reason ("Deze belofte of dit bewijs laten we niet toe.").
 */

const DISALLOWED =
  /\b(geweld|moord|verkracht|zelfmoord|zelfbeschadig|minderjarig|csam|exploitatie|terror|bom\b|haatzaai|drug\s*deal|overdosis|wurg|steekpartij|challenge.*(dood|vergif|vuur))\b/i;

const NEGATIVE_HARD =
  /\b(geen|niet|nooit)\s+(meer\s+)?(takeaway|thuisbezorgd|alcohol|roken|sigaret|drugs|tiktok|snoep|fastfood|bestellen)\b|\bik\s+(doe|ga|zal|eet|drink|kijk|gebruik)\s+(geen|niet|nooit)\b|\bnooit\s+meer\b/i;

const NEGATIVE_SOFT = /\b(niet|geen|nooit)\b/i;

export function promiseGate(
  promiseText: string,
  evidenceRule: string
): { block: string | null; warn: string | null } {
  const blob = `${promiseText} ${evidenceRule}`.trim();
  if (DISALLOWED.test(blob)) {
    return { block: "Deze belofte laten we niet toe.", warn: null };
  }
  const p = promiseText.trim();
  if (NEGATIVE_HARD.test(p)) {
    return {
      block: "Beloof wat je wél doet. 'Ik doe X niet' is niet te bewijzen.",
      warn: null,
    };
  }
  if (NEGATIVE_SOFT.test(p)) {
    return {
      block: null,
      warn: "Let op: iets níét doen is bijna niet te bewijzen. Schrijf wat je wél doet.",
    };
  }
  return { block: null, warn: null };
}