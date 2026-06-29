"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type FormSubmitButtonProps = {
  idleText: string;
  pendingText: string;
  className?: string;
};

export function FormSubmitButton({
  idleText,
  pendingText,
  className,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block size-4 animate-spin rounded-full border-2 border-white/50 border-t-white"
          />
          {pendingText}
        </>
      ) : (
        idleText
      )}
    </Button>
  );
}
