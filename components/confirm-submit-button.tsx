"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  message: string;
  className?: string;
  ariaLabel?: string;
  title?: string;
  pendingLabel?: ReactNode;
};

export default function ConfirmSubmitButton({
  children,
  message,
  className,
  ariaLabel,
  title,
  pendingLabel,
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
