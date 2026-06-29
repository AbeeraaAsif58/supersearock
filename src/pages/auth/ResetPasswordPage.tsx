"use client";

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const supabase = createClient();

    const setupRecoverySession = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type") as EmailOtpType | null;
        const hashError = hashParams.get("error");
        const hashErrorCode = hashParams.get("error_code");
        const hashErrorDescription = hashParams.get("error_description");

        if (hashError || hashErrorCode) {
          const decodedDescription = hashErrorDescription
            ? decodeURIComponent(hashErrorDescription.replace(/\+/g, " "))
            : "";
          const fallbackMessage = decodedDescription || "Reset link is invalid.";

          if (hashErrorCode === "otp_expired") {
            setError("Reset link expired. Please request a new password reset email.");
          } else {
            setError(fallbackMessage);
          }
          setIsReady(false);
          return;
        }

        if (code) {
          window.location.replace(
            `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/reset-password")}`,
          );
          return;
        }

        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });

          if (verifyError) {
            setError(verifyError.message);
            setIsReady(false);
            return;
          }

          // Clean up auth params from URL after verification.
          url.searchParams.delete("token_hash");
          url.searchParams.delete("type");
          window.history.replaceState({}, "", url.pathname);
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            setError(setSessionError.message);
            setIsReady(false);
            return;
          }

          window.history.replaceState({}, "", url.pathname);
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError("Auth session missing! Open reset link from your email again.");
          setIsReady(false);
          setIsInitializing(false);
          return;
        }

        setIsReady(true);
      } catch {
        setError("Unable to initialize password reset session.");
      } finally {
        setIsInitializing(false);
      }
    };

    void setupRecoverySession();
  }, []);

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login?message=Password%20updated.%20Please%20sign%20in.";
      }, 900);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F1ED] p-4 md:p-8 flex items-center justify-center">
      <div className="grid min-h-[86vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-[#E0DDD9] bg-[#f8f6f3] shadow-[0_24px_80px_rgba(0,0,0,0.12)] lg:grid-cols-[1.12fr_1fr]">
        <section className="hidden lg:flex bg-[#1A1A1A] text-white p-10 flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#E55B3C]">Super Sea Rock Real Estate</p>
            <p className="mt-2 text-xs uppercase tracking-[0.25em] text-gray-400">Security Update</p>
            <h2 className="mt-5 text-4xl leading-tight tracking-tight">Set a stronger password and continue.</h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>- Minimum 8 characters</li>
            <li>- Mix upper/lowercase and numbers</li>
            <li>- Avoid reused passwords</li>
          </ul>
        </section>

        <Card className="border-0 rounded-none bg-transparent shadow-none h-full flex justify-center">
          <div className="w-full max-w-lg mx-auto">
            <CardHeader className="px-7 pt-9 md:px-10 md:pt-12 pb-4">
              <CardTitle className="text-3xl tracking-tight">Create new password</CardTitle>
              <CardDescription className="text-base">
                This password will be used for your next login.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-7 pb-8 md:px-10 md:pb-12 space-y-5">
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="space-y-2.5">
                  <label htmlFor="password" className="text-sm font-medium text-[#1A1A1A]">
                    New password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    minLength={8}
                    placeholder="At least 8 characters"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={!isReady || isSubmitting}
                    className="h-12 rounded-xl border-[#CEC8BF] bg-white px-4 shadow-sm focus-visible:ring-[#E55B3C]/35 focus-visible:ring-[3px] focus-visible:border-[#E55B3C]"
                  />
                </div>

                {message && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                    {message}
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {isInitializing && !error && (
                  <div className="rounded-lg border border-[#E0DDD9] bg-[#F9F8F6] px-3 py-2.5 text-sm text-gray-700">
                    Verifying reset link...
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!isReady || isSubmitting || isInitializing}
                  className="w-full h-12 bg-[#E55B3C] hover:bg-[#c94b2f]"
                >
                  {isSubmitting ? "Updating..." : isInitializing ? "Verifying link..." : "Update password"}
                </Button>
              </form>
              <p className="text-sm text-gray-600">
                Back to{" "}
                <Link to="/login" className="text-[#1A1A1A] underline">
                  sign in
                </Link>
              </p>
              <p className="text-sm text-gray-600">
                Need a new link?{" "}
                <Link to="/forgot-password?from=reset" className="text-[#1A1A1A] underline">
                  Request password reset
                </Link>
              </p>
            </CardContent>
          </div>
        </Card>
      </div>
    </main>
  );
}
