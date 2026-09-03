import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SchoolsPage } from "./pages/SchoolsPage";
import { StudentsPage } from "./pages/StudentsPage";
import { FleetPage } from "./pages/FleetPage";
import { DriversPage } from "./pages/DriversPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PlannerPage } from "./pages/PlannerPage";
import { ComparePage } from "./pages/ComparePage";
import { TwinPage } from "./pages/TwinPage";
import { DispatchPage } from "./pages/DispatchPage";
import { TripDetailPage } from "./pages/TripDetailPage";
import { DrivePage } from "./pages/DrivePage";
import { SchoolDetailPage } from "./pages/SchoolDetailPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { AdminPage } from "./pages/AdminPage";
import type { Role } from "./types";

function Guard({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="glass px-8 py-6 text-center">
          <div className="h-8 w-8 mx-auto mb-3 rounded-full border-2 border-route border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-slate">Loading session…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && user.role !== "platform_admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Guard>
            <AppShell />
          </Guard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="schools" element={<SchoolsPage />} />
        <Route path="schools/:id" element={<SchoolDetailPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="twin" element={<TwinPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="drive" element={<DrivePage />} />
        <Route path="drive/:id" element={<DrivePage />} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
