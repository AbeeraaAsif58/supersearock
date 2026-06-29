import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { getAppHomePath } from "@/lib/auth/routes";

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F1ED] text-sm text-gray-600">
      Loading...
    </div>
  );
}

function MissingProfile() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F1ED] p-6">
      <div className="max-w-md rounded-xl border border-[#E0DDD9] bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-medium text-[#1A1A1A]">Profile not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your account is signed in but no CRM profile exists. Contact your admin.
        </p>
        <button
          type="button"
          onClick={() => void signOut().then(() => window.location.assign("/login"))}
          className="mt-4 rounded-lg bg-[#E55B3C] px-4 py-2 text-sm text-white hover:bg-[#c94b2f]"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!profile) return <MissingProfile />;

  return <Outlet />;
}

export function RequireAdmin() {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!profile) return <MissingProfile />;

  if (profile.role !== "admin" || !profile.is_primary_admin) {
    return <Navigate to="/dashboard?error=Admin%20access%20required." replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireAgent() {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!profile) return <MissingProfile />;

  if (profile.role !== "agent") {
    if (profile.role === "admin" && profile.is_primary_admin) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard?error=Agent%20access%20required." replace state={{ from: location }} />;
  }

  if (profile.status === "blocked") {
    return <Navigate to="/login?error=Account%20is%20blocked.%20Contact%20admin." replace />;
  }

  return <Outlet />;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <AuthLoading />;
  if (user && profile) return <Navigate to={getAppHomePath(profile)} replace />;

  return <>{children}</>;
}
