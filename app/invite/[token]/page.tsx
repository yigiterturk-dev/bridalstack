import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { getCurrentUserId } from "@/lib/tenant";
import { ROLE_LABELS, normalizeRole } from "@/lib/rbac";
import { acceptInvite, acceptInviteWithSignup } from "./actions";

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
};

const ERRORS: Record<string, string> = {
  invalid: "This invitation has expired or has already been used.",
  wrong_account: "You are signed in with a different email than the one this invitation was sent to.",
  short: "Your password must be at least 8 characters.",
  mismatch: "The two passwords do not match.",
};

const shell = (children: React.ReactNode) => (
  <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] px-6">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;

  const invite = await prisma.invitation.findUnique({
    where: { token_hash: hashToken(token) },
    select: {
      email: true, role: true, accepted_at: true, expires_at: true,
      tenant: { select: { name: true } },
    },
  });

  const valid = Boolean(invite) && !invite!.accepted_at && invite!.expires_at > new Date();

  if (!valid) {
    return shell(
      <>
        <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">Invitation not valid</h1>
        <p className="text-stone-500 mb-8">
          This invitation has expired or has already been used. Ask the shop owner to send a new one.
        </p>
        <Link href="/login" className="inline-block py-4 px-6 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all">
          Go to sign in
        </Link>
      </>
    );
  }

  const shopName = invite!.tenant?.name ?? "the team";
  const roleLabel = ROLE_LABELS[normalizeRole(invite!.role)];
  const [userId, existingUser] = await Promise.all([
    getCurrentUserId(),
    prisma.user.findUnique({ where: { email: invite!.email }, select: { id: true } }),
  ]);

  const error = sp?.error ? (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 mb-4">
      {ERRORS[sp.error] ?? "Something went wrong."}
    </div>
  ) : null;

  const header = (
    <>
      <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">Join {shopName}</h1>
      <p className="text-stone-500 mb-8">
        You have been invited as <strong className="text-stone-700">{roleLabel}</strong> for{" "}
        <span className="font-mono text-sm">{invite!.email}</span>.
      </p>
    </>
  );

  // Oturum açıksa tek tıkla kabul.
  if (userId) {
    return shell(
      <>
        {header}
        {error}
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all duration-300">
            Accept invitation
          </button>
        </form>
      </>
    );
  }

  // Hesabı varsa giriş yaptıktan sonra buraya dönsün.
  if (existingUser) {
    return shell(
      <>
        {header}
        {error}
        <p className="text-stone-500 mb-6">You already have an account. Sign in to accept.</p>
        <Link
          href={`/login?callbackUrl=/invite/${token}`}
          className="block text-center py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all duration-300"
        >
          Sign in to accept
        </Link>
      </>
    );
  }

  // Hesabı yoksa parolasını belirleyip aynı adımda katılsın.
  return shell(
    <>
      {header}
      {error}
      <form action={acceptInviteWithSignup} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="invite-name" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Your name</label>
          <input
            id="invite-name"
            name="name" required autoComplete="name"
            className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all"
          />
        </div>
        <div>
          <label htmlFor="invite-password" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Choose a password</label>
          <input
            id="invite-password"
            name="password" type="password" required minLength={8} autoComplete="new-password"
            className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all"
          />
        </div>
        <div>
          <label htmlFor="invite-confirm-password" className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Confirm password</label>
          <input
            id="invite-confirm-password"
            name="confirm" type="password" required minLength={8} autoComplete="new-password"
            className="w-full px-5 py-4 rounded-2xl border border-stone-200 bg-white/50 text-stone-900 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-50 transition-all"
          />
        </div>
        <button type="submit" className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all duration-300">
          Create account and join
        </button>
      </form>
    </>
  );
}
