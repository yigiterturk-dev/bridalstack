import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import PortalLinkButton from "@/components/portal-link-button";
import SelectField from "@/components/select-field";
import JourneyBar from "@/components/journey-bar";
import { countdownLabel } from "@/components/bride-row";
import { formatPrice } from "@/config/modules";
import { kindLabel } from "@/lib/alterations";
import { buildJourney } from "@/lib/journey";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";
import { updateCustomer, updateEventDate } from "./actions";

type Props = { params: Promise<{ id: string }> };
type FeedItem = { key: string; date: string; title: string; detail: string; href: string };

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function BridePage({ params }: Props) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const t = tenant.id;

  // Her sorguda tenant_id: RLS yok, izolasyon burada kuruluyor.
  const [customer, orders, appointments, alterations, installments] = await Promise.all([
    prisma.customer.findFirst({ where: { id, tenant_id: t } }),
    prisma.order.findMany({ where: { customer_id: id, tenant_id: t }, orderBy: { created_at: "desc" }, take: 20 }),
    prisma.appointment.findMany({ where: { customer_id: id, tenant_id: t }, orderBy: { appointment_date: "desc" }, take: 20 }),
    prisma.alteration.findMany({ where: { customer_id: id, tenant_id: t }, orderBy: { created_at: "desc" }, take: 20 }),
    prisma.installment.findMany({ where: { customer_id: id, tenant_id: t, status: { not: "cancelled" } }, orderBy: { due_date: "desc" }, take: 30 }),
  ]);
  if (!customer) redirect("/customers");

  const tz = normalizeTimeZone((tenant.settings as Record<string, unknown> | null)?.time_zone);
  const today = dateInTimeZone(new Date(), tz);
  const journey = buildJourney({
    eventDate: customer.event_date,
    today,
    orders,
    appointments: appointments.map((a) => ({ status: a.status, date: dateInTimeZone(a.appointment_date, tz) })),
    alterations,
    installments,
  });

  const feed: FeedItem[] = [
    ...orders.map((o) => ({ key: `o${o.id}`, date: o.order_date ?? o.created_at.toISOString().slice(0, 10), title: `Order ${o.ref_no}`, detail: `${o.status.replace(/_/g, " ")} · ${formatPrice(Number(o.discounted_total))}`, href: `/orders/${o.id}` })),
    ...appointments.map((a) => ({ key: `a${a.id}`, date: dateInTimeZone(a.appointment_date, tz), title: a.title ?? "Appointment", detail: a.status, href: "/appointments" })),
    ...alterations.map((a) => ({ key: `l${a.id}`, date: a.promised_date ?? a.fitting_date ?? a.created_at.toISOString().slice(0, 10), title: `${kindLabel(a.kind)} alteration`, detail: `${a.status.replace(/_/g, " ")}${a.promised_date ? ` · promised ${fmtDate(a.promised_date)}` : ""}`, href: "/alterations" })),
    ...installments.map((i) => ({ key: `i${i.id}`, date: i.due_date, title: `Payment ${i.installment_no} of ${i.total_count}`, detail: `${formatPrice(i.amount)} · ${i.status}`, href: i.order_id ? `/orders/${i.order_id}` : "/installments" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const latestOrder = orders.find((o) => o.status !== "cancelled");
  const married = journey.risk === "married";
  const box = journey.risk === "late" ? "border-late bg-late-soft" : "border-amber bg-amber-soft";

  return (
    <div className="flex flex-col gap-8">
      <Link href="/customers" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Brides</Link>

      {/* Hero */}
      <section className="rounded-2xl border border-[var(--line)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[var(--ink)]">{customer.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}</p>
          </div>
          <div className="sm:text-right">
            {customer.event_date ? (
              <>
                <p className="font-serif text-5xl tabular-nums text-[var(--ink)]">{married ? "Married" : countdownLabel(journey.daysToWedding)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Wedding {fmtDate(customer.event_date)}</p>
              </>
            ) : (
              <form action={updateEventDate} className="flex items-center gap-2">
                <input type="hidden" name="id" value={customer.id} />
                <label htmlFor="hero-event-date" className="sr-only">Wedding date</label>
                <input id="hero-event-date" name="event_date" type="date" required className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm" />
                <button type="submit" className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white">Add wedding date</button>
              </form>
            )}
          </div>
        </div>
        <div className="mt-8"><JourneyBar steps={journey.steps} risk={journey.risk} labels /></div>
      </section>

      {(journey.risk === "late" || journey.risk === "behind") && (
        <section className={`rounded-2xl border px-5 py-4 ${box}`}>
          <ul className="flex flex-col gap-1 text-sm text-[var(--ink)]">
            {journey.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>
      )}

      {/* Quick actions — en fazla 3 */}
      <section className="flex flex-wrap gap-3">
        <Link href={`/appointments?customer=${customer.id}`} className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white">Book fitting</Link>
        <Link href={`/alterations?customer=${customer.id}`} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]">New alteration</Link>
        {latestOrder ? (
          <Link href={`/orders/${latestOrder.id}`} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]">See payments</Link>
        ) : (
          <Link href={`/orders/new?customer=${customer.id}`} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]">New order</Link>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feed */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Everything so far</h2>
          {feed.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] px-4 py-6 text-[var(--muted)]">
              Nothing yet. Start with her dress.
              <Link href={`/orders/new?customer=${customer.id}`} className="ml-2 font-medium text-[var(--ink)] underline">New order</Link>
            </div>
          ) : (
            <ol className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
              {feed.map((f) => (
                <li key={f.key}>
                  <Link href={f.href} className="grid grid-cols-[6.5rem_1fr] gap-4 px-4 py-3 hover:bg-stone-50">
                    <span className="text-sm tabular-nums text-[var(--muted)]">{fmtDate(f.date)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">{f.title}</span>
                      <span className="block truncate text-sm capitalize text-[var(--muted)]">{f.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Details (eski düzenleme formu, düğün tarihiyle) */}
        <section className="rounded-2xl border border-[var(--line)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl text-[var(--ink)]">Details</h2>
            <PortalLinkButton customerId={customer.id} />
          </div>
          <form action={updateCustomer} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={customer.id} />
            <Field label="Name"><input name="name" defaultValue={customer.name} required className={INPUT} /></Field>
            <Field label="Wedding date"><input name="event_date" type="date" defaultValue={customer.event_date ?? ""} className={INPUT} /></Field>
            <Field label="Phone"><input name="phone" defaultValue={customer.phone ?? ""} className={INPUT} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={customer.email ?? ""} className={INPUT} /></Field>
            <Field label="Status">
              <SelectField
                name="status"
                defaultValue={customer.status ?? "new"}
                searchable={false}
                options={["new", "hot_lead", "appointment_set", "fitting_done", "sold", "delivered", "lost"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
              />
            </Field>
            <Field label="Notes"><textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className={`${INPUT} resize-y`} /></Field>
            <button type="submit" className="mt-1 rounded-xl bg-[var(--ink)] py-2 text-sm font-medium text-white">Save changes</button>
          </form>
        </section>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
