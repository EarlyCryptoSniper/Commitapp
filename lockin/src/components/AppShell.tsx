import { Link, NavLink, Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { useAuth } from "../lib/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? "text-accent" : "text-mute hover:text-white"}`;

export function AppShell() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <Link to={user ? "/dashboard" : "/"} className="text-lg font-semibold tracking-tight">
          LockIn
        </Link>
        {user ? (
          <nav className="flex gap-4">
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
          <Link to="/auth" className="text-sm text-accent">
            Inloggen
          </Link>
        )}
      </header>
      <main className="flex-1 px-4 pb-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
