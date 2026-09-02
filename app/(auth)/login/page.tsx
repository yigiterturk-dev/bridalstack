"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, shopName }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Signup failed");
        }
      }
      
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      router.push("/dashboard");
      router.refresh();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-4 animate-fade-in-up">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50/40 via-transparent to-stone-100/40 pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-stone-900 tracking-tight flex items-center justify-center gap-2">
            Bridal<span className="text-rose-500 font-normal">Stack</span> <span className="text-rose-300">✧</span>
          </h1>
          <p className="text-stone-500 mt-3 font-medium tracking-wide uppercase text-xs">The Luxury Standard for Bridal Boutiques</p>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 p-10">
          <h2 className="text-2xl font-bold text-stone-900 mb-8 text-center">
            {isSignUp ? "Create your boutique" : "Welcome back"}
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50/80 text-rose-700 text-sm font-medium border border-rose-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Boutique Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required={isSignUp}
                  className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 text-sm font-medium outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all placeholder:text-stone-300"
                  placeholder="e.g. Elegance Bridal"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 text-sm font-medium outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all placeholder:text-stone-300"
                placeholder="you@boutique.com"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <Link href="/forgot-password" className="text-xs font-semibold text-stone-400 hover:text-rose-600 transition-colors">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 text-sm font-medium outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all placeholder:text-stone-300"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-4 px-4 bg-stone-900 text-white rounded-2xl font-bold text-sm hover:bg-rose-600 hover:shadow-[0_8px_20px_-6px_rgba(225,29,72,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Processing...
                </span>
              ) : isSignUp ? (
                "Launch Boutique"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-stone-100 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-sm font-semibold text-stone-500 hover:text-rose-600 transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "New here? Create your boutique"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
