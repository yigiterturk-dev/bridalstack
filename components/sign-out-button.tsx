"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/**
 * NextAuth v4 çıkış işlemi CSRF jetonu ister; düz form POST'u sessizce başarısız olur.
 * Bu yüzden çıkış istemci tarafındaki signOut() ile yapılır.
 */
export default function SignOutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signOut({ callbackUrl: "/login" });
      }}
      className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {pending ? "Signing out..." : "Sign Out"}
    </button>
  );
}
