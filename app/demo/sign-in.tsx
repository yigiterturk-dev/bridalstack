"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";

/**
 * Tanıtım hesabına giriş. Parola gizli değil: hesap salt okunur ve herkese
 * açık — `viewer` rolü yazmayı zaten reddediyor.
 */
export default function DemoSignIn({
  email,
  password,
  signOutFirst = false,
}: {
  email: string;
  password: string;
  /** Kendi hesabıyla gezen biri demoyu açmayı seçtiyse önce oturumu kapat. */
  signOutFirst?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // NextAuth'un kendi çıkış sayfası markasız ve fazladan bir tık istiyor;
    // ziyaretçiyi oraya uğratmıyoruz. Çıkıştan sonra TAM SAYFA yenileniyor:
    // sunucu bileşeni çerezi yeniden okusun, yoksa kapanmış oturumu hâlâ
    // açık sanıp "zaten girişlisin" ekranında döner.
    if (signOutFirst) {
      signOut({ redirect: false })
        .then(() => {
          window.location.href = "/demo";
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }

    signIn("credentials", { email, password, callbackUrl: "/dashboard", redirect: true }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [email, password, signOutFirst]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      {failed ? (
        <>
          <h1 className="text-xl font-semibold text-neutral-900">The demo didn&rsquo;t open</h1>
          <p className="text-neutral-600">
            Something on our side went wrong. Email{" "}
            <a className="underline" href="mailto:hello@bridalstack.com">
              hello@bridalstack.com
            </a>{" "}
            and we&rsquo;ll walk you through it live.
          </p>
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900"
          />
          <p className="text-neutral-600">Opening a sample boutique&hellip;</p>
        </>
      )}
    </main>
  );
}
