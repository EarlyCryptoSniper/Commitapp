import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { useAuth } from "../lib/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-2 py-1 text-sm ${
    isActive ? "text-accent" : "text-mute hover:text-white"
  }`;

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onHome = pathname === "/";

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-lg flex-col">
      <header className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3.5">
        <Link
          to="/"
          aria-label="Home"
          aria-current={onHome ? "page" : undefined}
          className={`shrink-0 py-1 text-lg font-semibold tracking-tight ${
            onHome ? "text-accent" : "text-white"
          }`}
        >
          LockIn
        </Link>
        {user ? (
          <nav className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <NavLink to="/dashboard" className={linkClass}>
              Overzicht
            </NavLink>
            <NavLink to="/commitment/new" className={linkClass}>
              Nieuw
            </NavLink>
            <NavLink to="/account" className={linkClass}>
              Account
            </NavLink>
          </nav>
        ) : (
          <Link
            to="/auth"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-accent"
          >
            Inloggen
          </Link>
        )}
      </header>
      <main className="w-full min-w-0 max-w-full flex-1 px-4 pb-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}