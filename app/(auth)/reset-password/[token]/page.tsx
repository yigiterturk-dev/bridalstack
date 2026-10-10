import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { resetPassword } from "./actions";

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
};

const ERRORS: Record<string, string> = {
  short: "Your password must be at least 8 characters.",
  mismatch: "The two passwords do not match.",
  invalid: "This link is no longer valid. Request a new one.",
};

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;

  const record = await prisma.passwordResetToken.findUnique({
    where: { token_hash: hashToken(token) },
    select: { used_at: true, expires_at: true },
  });
  const valid = Boolean(record) && !record!.used_at && record!.expires_at > new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">Choose a new password</h1>

        {!valid ? (
          <>
            <p className="text-stone-500 mb-8">
              This reset link has expired or has already been used. Reset links work once and last one hour.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block py-4 px-6 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <>
            <p className="text-stone-500 mb-8">Pick something you have not used before, at least 8 characters.</p>
            <form action={resetPassword} className="flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              {sp?.error && (
                <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                  {ERRORS[sp.error] ?? "Something went wrong."}
                </div>
              )}
              <div>
                <label htmlFor="new-password" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">New password</label>
                <input
                  id="new-password" name="password" type="password" required minLength={8} autoComplete="new-password" aria-describedby="password-hint"
                  className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 focus-visible:outline-none transition-all"
                />
                <p id="password-hint" className="mt-1.5 text-xs text-stone-400">At least 8 characters.</p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Confirm password</label>
                <input
                  id="confirm-password" name="confirm" type="password" required minLength={8} autoComplete="new-password"
                  className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 focus-visible:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
              >
                Save new password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
