import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { DEMO_TENANT_SLUG } from "@/lib/demo-identity";
import { FREE_PACK_IDS } from "@/config/modules";
import { trialDaysLeft } from "@/lib/trial";

// Platform yöneticisi paneli: kim kayıt oldu, hangisi ödüyor, kim kullanıyor.
// ADMIN_EMAILS dışındaki herkese sayfa yokmuş gibi davranır (404).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ops", robots: { index: false, follow: false } };

const DAY = 86_400_000;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function OpsPage() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session?.user?.email)) notFound();

  const tenants = await prisma.tenant.findMany({
    where: { slug: { not: DEMO_TENANT_SLUG } },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      created_at: true,
      packs: true,
      plan: true,
      trial_ends_at: true,
      owner: { select: { email: true, last_login_at: true } },
      _count: { select: { members: true, customers: true, orders: true, appointments: true } },
    },
  });

  const now = new Date();
  const free = new Set<string>(FREE_PACK_IDS);
  const rows = tenants.map((t) => {
    const paidPacks = t.packs.filter((p) => !free.has(p));
    return { ...t, paidPacks, trialLeft: trialDaysLeft(t.trial_ends_at, now) };
  });
  const last7 = rows.filter((r) => now.getTime() - r.created_at.getTime() < 7 * DAY).length;
  const paying = rows.filter((r) => r.paidPacks.length > 0).length;
  const loggedIn24h = rows.filter((r) => r.owner.last_login_at && now.getTime() - r.owner.last_login_at.getTime() < DAY).length;
  const active = rows.filter((r) => r._count.customers > 0 || r._count.orders > 0 || r._count.appointments > 0).length;

  const stats = [
    { label: "Shops", value: rows.length },
    { label: "New in last 7 days", value: last7 },
    { label: "Logged in last 24h", value: loggedIn24h },
    { label: "Paying", value: paying },
    { label: "Using it (has data)", value: active },
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-gray-900 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-serif text-3xl">Ops</h1>
        <p className="mt-1 text-sm text-gray-500">Every shop except the demo. Newest first.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-200 p-4">
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Shop</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Signed up</th>
                <th className="px-3 py-2">Last login</th>
                <th className="px-3 py-2">Billing</th>
                <th className="px-3 py-2 text-right">Team</th>
                <th className="px-3 py-2 text-right">Brides</th>
                <th className="px-3 py-2 text-right">Appts</th>
                <th className="px-3 py-2 text-right">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">No shops yet.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.slug}</div>
                  </td>
                  <td className="px-3 py-2">{r.owner.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.owner.last_login_at ? r.owner.last_login_at.toISOString().slice(0, 16).replace("T", " ") + " UTC" : <span className="text-gray-500">never</span>}</td>
                  <td className="px-3 py-2">
                    {r.paidPacks.length > 0
                      ? <span className="text-[#8a6a3f]">Paid: {r.paidPacks.join(", ")}</span>
                      : r.trialLeft
                        ? `Trial, ${r.trialLeft}d left`
                        : <span className="text-gray-500">Free</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{r._count.members}</td>
                  <td className="px-3 py-2 text-right">{r._count.customers}</td>
                  <td className="px-3 py-2 text-right">{r._count.appointments}</td>
                  <td className="px-3 py-2 text-right">{r._count.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
