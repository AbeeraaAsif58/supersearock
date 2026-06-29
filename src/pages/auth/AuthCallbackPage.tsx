"use client";

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
    const safeNext = next.startsWith("/") ? next : "/dashboard";

    if (!code) {
      navigate("/login?error=Missing%20auth%20code.", { replace: true });
      return;
    }

    const supabase = createClient();

    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        navigate(`/login?error=${encodeURIComponent(error.message)}`, { replace: true });
        return;
      }

      navigate(safeNext, { replace: true });
    });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F1ED] text-sm text-gray-600">
      Completing sign in...
    </div>
  );
}
