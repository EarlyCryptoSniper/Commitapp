import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { supabaseConfigured } from "../lib/supabase";

export function ProtectedRoute() {
  const { loading, user } = useAuth();

  if (!supabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <p className="px-4 py-12 text-center text-sm text-mute">Laden…</p>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
