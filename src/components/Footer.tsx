import { Link } from "react-router-dom";
import { TRUST } from "../lib/trustCopy";

export function Footer() {
  return (
    <footer className="mt-auto w-full min-w-0 max-w-full border-t border-line px-4 py-5 text-center text-xs leading-5 text-mute break-words">
      <p>{TRUST.footerLine}</p>
      <p className="mt-3 flex items-center justify-center gap-4">
        <Link
          to="/faq"
          className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
        >
          Vragen
        </Link>
        <Link
          to="/faq#privacy"
          className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
        >
          Privacy
        </Link>
      </p>
    </footer>
  );
}