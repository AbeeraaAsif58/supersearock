import { useEffect } from "react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { setAppNavigate } from "@/lib/navigation";
import { GuestOnly, RequireAdmin, RequireAgent, RequireAuth } from "@/components/auth/protected-route";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import AuthCallbackPage from "@/pages/auth/AuthCallbackPage";
import AdminLayout from "@/layouts/AdminLayout";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminAgentsPage from "@/pages/admin/AdminAgentsPage";
import AdminLeadsPage from "@/pages/admin/AdminLeadsPage";
import AdminDistributionPage from "@/pages/admin/AdminDistributionPage";
import AdminFollowUpsPage from "@/pages/admin/AdminFollowUpsPage";
import AdminNotificationsPage from "@/pages/admin/AdminNotificationsPage";
import AdminReportsPage from "@/pages/admin/AdminReportsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AgentDashboardPage from "@/pages/dashboard/AgentDashboardPage";
import AgentLeadsPage from "@/pages/dashboard/AgentLeadsPage";
import AgentLeadDetailPage from "@/pages/dashboard/AgentLeadDetailPage";
import AgentFollowUpsPage from "@/pages/dashboard/AgentFollowUpsPage";
import AgentNotificationsPage from "@/pages/dashboard/AgentNotificationsPage";
import AgentSettingsPage from "@/pages/dashboard/AgentSettingsPage";

function NavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    setAppNavigate(navigate);
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <>
      <NavigationBridge />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireAgent />}>
            <Route path="/dashboard" element={<AgentDashboardPage />} />
            <Route path="/dashboard/leads" element={<AgentLeadsPage />} />
            <Route path="/dashboard/leads/:leadId" element={<AgentLeadDetailPage />} />
            <Route path="/dashboard/follow-ups" element={<AgentFollowUpsPage />} />
            <Route path="/dashboard/notifications" element={<AgentNotificationsPage />} />
            <Route path="/dashboard/settings" element={<AgentSettingsPage />} />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="agents" element={<AdminAgentsPage />} />
              <Route path="leads" element={<AdminLeadsPage />} />
              <Route path="distribution" element={<AdminDistributionPage />} />
              <Route path="follow-ups" element={<AdminFollowUpsPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
