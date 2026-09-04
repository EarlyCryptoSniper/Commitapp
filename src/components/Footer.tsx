import { Link } from "react-router-dom";
import { TRUST } from "../lib/trustCopy";

export function Footer() {
  return (
    <footer className="mt-auto w-full min-w-0 max-w-full border-t border-line px-4 py-5 text-center text-xs leading-5 text-mute break-words">
      <p>{TRUST.footerLine}</p>
      <Link
        to="/faq"
        className="mt-2 inline-block text-mute underline-offset-2 hover:text-white hover:underline"
      >
        Vragen
      </Link>
    </footer>
  );
}