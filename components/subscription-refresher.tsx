"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Ödeme dönüşünde paketler webhook'la birkaç saniye sonra yazılır. Sayfayı
 * kısa bir süre tazeleyerek kullanıcının elle yenilemesine gerek bırakmaz.
 */
export default function SubscriptionRefresher() {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= 8) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
