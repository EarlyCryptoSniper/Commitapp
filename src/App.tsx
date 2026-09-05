import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./pages/Landing";
import { AuthPage } from "./pages/Auth";
import { FaqPage } from "./pages/Faq";
import { HowBeloftePage } from "./pages/HowBelofte";
import { HowBewijsPage } from "./pages/HowBewijs";
import { HowUitkomstPage } from "./pages/HowUitkomst";
import { DashboardPage } from "./pages/Dashboard";
import { NewCommitmentPage } from "./pages/NewCommitment";
import { CommitmentDetailPage } from "./pages/CommitmentDetail";
import { ProofPage } from "./pages/Proof";
import { AccountPage } from "./pages/Account";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/hoe/belofte" element={<HowBeloftePage />} />
            <Route path="/hoe/bewijs" element={<HowBewijsPage />} />
            <Route path="/hoe/uitkomst" element={<HowUitkomstPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/commitment/new" element={<NewCommitmentPage />} />
              <Route path="/commitment/:id" element={<CommitmentDetailPage />} />
              <Route path="/commitment/:id/proof" element={<ProofPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}