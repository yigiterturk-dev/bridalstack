"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fafafa", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 40 }}>
            <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>BridalStack needs a refresh</h1>
            <p style={{ color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
              Please try again. Your saved data is not affected.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 28, border: 0, borderRadius: 12, background: "#111827", color: "#fff", padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
