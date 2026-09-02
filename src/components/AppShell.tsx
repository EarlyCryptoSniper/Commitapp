import { Link, NavLink, Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { useAuth } from "../lib/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? "text-accent" : "text-mute hover:text-white"}`;

export function AppShell() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-lg flex-col">
      <header className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4">
        <Link
          to={user ? "/dashboard" : "/"}
          className="shrink-0 text-lg font-semibold tracking-tight"
        >
          LockIn
        </Link>
        {user ? (
          <nav className="flex min-w-0 shrink-0 gap-3 sm:gap-4">
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
          <Link to="/auth" className="shrink-0 text-sm text-accent">
            Inloggen
          </Link>
        )}
      </header>
      <main className="w-full min-w-0 max-w-full flex-1 px-4 pb-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}