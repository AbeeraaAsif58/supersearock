"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type AdminFormSubmitButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
};

export function AdminFormSubmitButton({
  idleText,
  pendingText,
  className,
  variant = "default",
}: AdminFormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block size-4 animate-spin rounded-full border-2 border-current/40 border-t-current"
          />
          {pendingText}
        </>
      ) : (
        idleText
      )}
    </Button>
  );
}
