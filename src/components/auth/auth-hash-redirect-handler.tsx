"use client";

import { useEffect } from "react";

export function AuthHashRedirectHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (code) {
      window.location.replace(
        `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/reset-password")}`,
      );
      return;
    }

    const hash = window.location.hash;
    if (!hash.startsWith("#")) return;

    const hashParams = new URLSearchParams(hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");

    if (!accessToken) return;

    // Supabase invite/recovery links can arrive at root depending on template config.
    // Forward to reset-password so session+password setup can complete correctly.
    if (type === "invite" || type === "recovery") {
      window.location.replace(`/reset-password${hash}`);
      return;
    }

    window.location.replace("/dashboard");
  }, []);

  return null;
}
