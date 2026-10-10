"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
};

export default function SubmitButton({ children, pendingLabel = "Saving…", className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
