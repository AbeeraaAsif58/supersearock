"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/auth/form-submit-button";

type ForgotPasswordFormState = {
  message?: string;
  error?: string;
};

type ForgotPasswordFormProps = {
  action: (prevState: ForgotPasswordFormState, formData: FormData) => Promise<ForgotPasswordFormState>;
  initialMessage?: string;
  initialError?: string;
};

export function ForgotPasswordForm({
  action,
  initialMessage,
  initialError,
}: ForgotPasswordFormProps) {
  const [state, formAction] = useActionState(action, {
    message: initialMessage,
    error: initialError,
  });

  return (
    <form action={formAction} className="space-y-5">
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
          className="h-12 rounded-xl border-[#CEC8BF] bg-white px-4 shadow-sm focus-visible:ring-[#E55B3C]/35 focus-visible:ring-[3px] focus-visible:border-[#E55B3C]"
        />
      </div>

      {state.message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
          {state.message}
        </div>
      )}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <FormSubmitButton
        idleText="Send reset link"
        pendingText="Sending..."
        className="w-full h-12 bg-[#E55B3C] hover:bg-[#c94b2f]"
      />
    </form>
  );
}
