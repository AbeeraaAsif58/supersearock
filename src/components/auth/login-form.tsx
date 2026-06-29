"use client";

import { useActionState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/auth/form-submit-button";

type LoginFormState = {
  error?: string;
};

type LoginFormProps = {
  action: (prevState: LoginFormState, formData: FormData) => Promise<LoginFormState>;
  initialError?: string;
};

export function LoginForm({ action, initialError }: LoginFormProps) {
  const [state, formAction] = useActionState(action, { error: initialError });

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2.5">
        <label htmlFor="email" className="text-sm font-medium text-[#1A1A1A]">
          Email address
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@agency.com"
          required
          className="h-14 rounded-xl border-[#CEC8BF] bg-white px-4 text-base shadow-sm focus-visible:ring-[#E55B3C]/35 focus-visible:ring-[3px] focus-visible:border-[#E55B3C]"
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-[#1A1A1A]">
            Password
          </label>
          <Link to="/forgot-password" className="text-xs text-[#7d7770] hover:text-[#1A1A1A]">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          required
          className="h-14 rounded-xl border-[#CEC8BF] bg-white px-4 text-base shadow-sm focus-visible:ring-[#E55B3C]/35 focus-visible:ring-[3px] focus-visible:border-[#E55B3C]"
        />
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <FormSubmitButton
        idleText="Sign in to dashboard"
        pendingText="Signing in..."
        className="h-12 w-full bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
      />
    </form>
  );
}
