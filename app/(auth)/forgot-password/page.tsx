import Link from "next/link";
import { requestPasswordReset } from "./actions";

type Props = { searchParams?: Promise<{ sent?: string; error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">Forgot your password?</h1>
        <p className="text-stone-500 mb-8">
          Enter the email you sign in with and we will send you a link to choose a new password.
        </p>

        {params?.sent ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
            If an account exists for that address, a reset link is on its way. The link works once and
            expires in one hour.
          </div>
        ) : (
          <form action={requestPasswordReset} className="flex flex-col gap-4">
            {params?.error && (
              <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                Please enter a valid email address.
              </div>
            )}
            <div>
              <label htmlFor="reset-email" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Email</label>
              <input
                id="reset-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@boutique.com"
                className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 focus-visible:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
            >
              Send reset link
            </button>
          </form>
        )}

        <p className="mt-8 text-sm text-stone-500">
          <Link href="/login" className="font-semibold text-stone-700 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 rounded">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
