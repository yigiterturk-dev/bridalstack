import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import PortalLinkButton from "@/components/portal-link-button";
import FollowUpEmailButton from "@/components/follow-up-email-button";
import { buildFollowUps, buildGownPerformance } from "@/lib/follow-ups";
import EmptyState from "@/components/empty-state";

export const dynamic = "force-dynamic";

const REACTION_EMOJI: Record<string, string> = { loved: "😍", liked: "👍", maybe: "🤔", no: "👎" };

export default async function FollowUpsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="crm" enabledModules={tenant.enabled_modules}>
      <FollowUpsContent tenantId={tenant.id} />
    </ModuleGuard>
  );
}

async function FollowUpsContent({ tenantId }: { tenantId: string }) {
  const [tryOns, orders] = await Promise.all([
    prisma.tryOn.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 1000,
      select: {
        customer_id: true, product_id: true, reaction: true, rating: true, created_at: true,
      },
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId, status: { not: "cancelled" } },
      select: { customer_id: true, created_at: true },
    }),
  ]);

  const followUps = buildFollowUps(tryOns, orders).slice(0, 50);
  const gowns = buildGownPerformance(tryOns, orders).slice(0, 8);

  // Sadece listede geçen kayıtları çekiyoruz; tüm kataloğu getirmeye gerek yok.
  const customerIds = [...new Set(followUps.map((f) => f.customer_id))];
  const productIds = [...new Set([...followUps.map((f) => f.topProductId), ...gowns.map((g) => g.product_id)])];

  const [customers, products] = await Promise.all([
    customerIds.length
      ? prisma.customer.findMany({
          where: { id: { in: customerIds }, tenant_id: tenantId },
          select: { id: true, name: true, phone: true, email: true, status: true },
        })
      : [],
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds }, tenant_id: tenantId },
          select: { id: true, name: true, category: true, price: true, image_url: true },
        })
      : [],
  ]);

  // Daha önce takip e-postası gönderilmiş gelinler — buton tekrar göstermesin.
  const sentEmails = customerIds.length
    ? await prisma.followUpEmail.findMany({
        where: { tenant_id: tenantId, customer_id: { in: customerIds } },
        orderBy: { sent_at: "desc" },
        select: { customer_id: true, sent_at: true },
      })
    : [];
  const lastSentByCustomer = new Map<string, Date>();
  for (const e of sentEmails) {
    if (!lastSentByCustomer.has(e.customer_id)) lastSentByCustomer.set(e.customer_id, e.sent_at);
  }

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const potentialValue = followUps.reduce(
    (sum, f) => sum + (productById.get(f.topProductId)?.price ?? 0),
    0
  );

  if (tryOns.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <Header count={0} value={0} />
        <EmptyState icon="favorite" action={{ href: "/try-ons", label: "Log a try-on" }} title="No try-ons recorded yet">
          Every time a bride tries a gown, log how she reacted. This page then tells you exactly who to call back, and which gowns get loved but never sell.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <Header count={followUps.length} value={potentialValue} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Brides to call back */}
        <div className="xl:col-span-2">
          <h2 className="text-sm font-serif font-normal text-[var(--muted)] uppercase tracking-wider mb-4">
            Brides to call back
          </h2>

          {followUps.length === 0 ? (
            <EmptyState icon="task_alt" title="Nothing outstanding">
              Every bride who loved a gown has since placed an order. Nice work.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {followUps.map((f) => {
                const c = customerById.get(f.customer_id);
                const p = productById.get(f.topProductId);
                if (!c) return null;
                return (
                  <div
                    key={f.customer_id}
                    className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-5 flex items-start gap-4"
                  >
                    {p?.image_url ? (
                      <Image unoptimized src={p.image_url} alt={p.name} width={56} height={56} className="w-14 h-14 rounded-xl object-cover border border-stone-200 flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gold-soft flex items-center justify-center text-2xl flex-shrink-0">
                        {f.bestReaction ? REACTION_EMOJI[f.bestReaction] : "👗"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/customers/${c.id}`}
                          className="font-bold text-[var(--ink)] hover:text-gold transition-colors"
                        >
                          {c.name}
                        </Link>
                        {f.bestReaction && (
                          <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gold-soft text-gold border border-gold/30">
                            {REACTION_EMOJI[f.bestReaction]} {f.bestReaction}
                          </span>
                        )}
                        {f.bestRating && (
                          <span className="text-xs text-amber-500">{"★".repeat(f.bestRating)}</span>
                        )}
                      </div>

                      <p className="text-sm text-stone-600 mt-1">
                        Tried <strong className="text-stone-800">{p?.name ?? "a gown"}</strong>
                        {p?.price ? <span className="text-stone-400"> · {formatPrice(p.price)}</span> : null}
                        {f.signalCount > 1 && (
                          <span className="text-stone-400"> · and {f.signalCount - 1} more</span>
                        )}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400">
                        <span>
                          {f.daysSince === 0
                            ? "Today"
                            : `${f.daysSince} ${f.daysSince === 1 ? "day" : "days"} ago`}
                        </span>
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span className="truncate">{c.email}</span>}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      <FollowUpEmailButton
                        customerId={c.id}
                        productId={f.topProductId}
                        hasEmail={Boolean(c.email)}
                        lastSentAt={lastSentByCustomer.get(c.id)?.toISOString() ?? null}
                      />
                      <PortalLinkButton customerId={c.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gown performance */}
        <div>
          <h2 className="text-sm font-serif font-normal text-[var(--muted)] uppercase tracking-wider mb-4">
            Loved but not selling
          </h2>
          <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-6">
            <p className="text-sm text-[var(--muted)] mb-5">
              High interest with low conversion usually means price, sizing, or availability.
            </p>
            <div className="flex flex-col gap-4">
              {gowns.map((g) => {
                const p = productById.get(g.product_id);
                if (!p) return null;
                return (
                  <div key={g.product_id} className="flex items-center gap-3">
                    {p.image_url ? (
                      <Image unoptimized src={p.image_url} alt={p.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover border border-stone-200 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-stone-400 text-[18px]">checkroom</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--ink)] truncate">{p.name}</div>
                      <div className="text-xs text-stone-400">
                        {g.tryOnCount} {g.tryOnCount === 1 ? "try-on" : "try-ons"}
                        {g.lovedCount > 0 && ` · ${g.lovedCount} loved`}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {g.conversionRate !== null ? (
                        <div
                          className={`text-sm font-bold tabular-nums ${
                            g.conversionRate >= 50
                              ? "text-emerald-600"
                              : g.conversionRate >= 25
                              ? "text-amber-600"
                              : "text-gold"
                          }`}
                        >
                          {g.conversionRate}%
                        </div>
                      ) : (
                        <div className="text-sm text-stone-300">—</div>
                      )}
                      {g.missedCount > 0 && (
                        <div className="text-[11px] text-stone-400">{g.missedCount} missed</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ count, value }: { count: number; value: number }) {
  return (
    <div className="mb-10">
      <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)] flex items-center gap-3">
        Follow-ups <span className="text-gold font-normal">✧</span>
      </h1>
      <p className="text-[var(--muted)] mt-2 font-medium">
        {count === 0
          ? "Brides who loved a gown but have not ordered yet"
          : `${count} ${count === 1 ? "bride" : "brides"} loved a gown and have not ordered · ${formatPrice(Math.round(value))} in play`}
      </p>
    </div>
  );
}
