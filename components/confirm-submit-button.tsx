"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  message: string;
  className?: string;
  ariaLabel?: string;
  title?: string;
};

export default function ConfirmSubmitButton({
  children,
  message,
  className,
  ariaLabel,
  title,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
