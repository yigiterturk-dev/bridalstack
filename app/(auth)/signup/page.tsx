"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Landing'in "Start Free" butonunun indiği yer. Login sayfasındaki signup
// modunun ayrılmış hali — ziyaretçi burada doğrudan butik kurar.
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, shopName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Signup failed");
      }

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        // Hesap kuruldu; oturum açılamadıysa login'e yönlendir (şifre geçerli).
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FDFCFB] px-4 animate-fade-in-up"
      style={{ backgroundImage: "radial-gradient(rgba(120,113,108,0.12) 0.7px, transparent 0.7px)", backgroundSize: "18px 18px" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50/40 via-transparent to-stone-100/40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-[var(--ink)] tracking-tight">
            Bridal<span className="text-gold">Stack</span>
          </h1>
          <p className="text-stone-500 mt-3 font-medium tracking-wide uppercase text-xs">For bridal boutiques</p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--line)] p-8 sm:p-10">
          <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center">Create your boutique</h2>
          <p className="text-center text-stone-500 text-sm mb-8">
            Free plan — customers &amp; appointments included. No credit card required.
          </p>

          {error && (
            <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="mb-6 p-4 rounded-2xl bg-rose-50/80 text-rose-700 text-sm font-medium border border-rose-100 flex items-center gap-2 focus:outline-none">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="shop-name" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Boutique Name</label>
              <input
                id="shop-name"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                autoComplete="organization"
                className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 text-sm font-medium outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 focus-visible:outline-none transition-all placeholder:text-stone-300"
                placeholder="e.g. Elegance Bridal"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 text-sm font-medium outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 focus-visible:outline-none transition-all placeholder:text-stone-300"
                placeholder="you@boutique.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  className="w-full px-5 py-4 pr-14 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 text-sm font-medium outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 focus-visible:outline-none transition-all placeholder:text-stone-300"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-3 px-2 text-stone-400 hover:text-stone-700 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
              <p id="password-hint" className="mt-1.5 text-xs text-stone-400">At least 8 characters.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full mt-4 py-4 px-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-rose-600 hover:shadow-[0_8px_20px_-6px_rgba(225,29,72,0.4)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Creating your boutique...
                </span>
              ) : (
                "Launch Boutique"
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-stone-100 text-center">
            <Link href="/login" className="text-sm font-semibold text-stone-500 hover:text-rose-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
