import Script from "next/script";

// GA4 — reklam izinleri kapalı, yalnız ölçüm. Geliştirmede yüklenmez.
export function GoogleAnalytics({ id, nonce }: { id: string; nonce?: string }) {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" nonce={nonce} />
      <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
