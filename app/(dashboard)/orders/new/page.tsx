import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createOrder } from "@/lib/actions";
import SelectField from "@/components/select-field";
import OrderLineEditor from "@/components/order-line-editor";
import SubmitButton from "@/components/submit-button";
import { CURRENCY_SYMBOL } from "@/config/modules";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";

const ERRORS: Record<string, string> = {
  required: "Pick the bride this order is for.",
  line_invalid: "One of the items is no longer in stock records. Remove it and add it again.",
  line_required: "Every item needs a name.",
  deposit_exceeds: "The deposit is more than the order total. Add the items or type the total first.",
  insert: "The order could not be saved. Try again.",
};

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, name: true, sku: true, price: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/orders" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] mb-4 inline-block">← Back to Orders</Link>
      <h1 className="font-serif text-3xl font-normal text-[var(--ink)] lg:text-4xl mb-6">New order</h1>
      {params?.error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-late">
          {ERRORS[params.error] ?? "Something went wrong."}
        </div>
      )}

      <form action={createOrder} className="bg-white rounded-2xl border border-[var(--line)] p-6 flex flex-col gap-4">
        <div>
          <label htmlFor="customer_id-select" className="block text-sm font-medium text-[var(--ink)] mb-1">Customer *</label>
          <SelectField
            name="customer_id"
            required
            placeholder="Select customer…"
            options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="order_type-select" className="block text-sm font-medium text-[var(--ink)] mb-1">Type</label>
            <SelectField
              name="order_type"
              defaultValue="sale"
              searchable={false}
              options={[
                { value: "sale", label: "Sale" },
                { value: "rental", label: "Rental" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="order-date" className="block text-sm font-medium text-[var(--ink)] mb-1">Order Date</label>
            <input id="order-date" name="order_date" type="date" defaultValue={dateInTimeZone(new Date(), normalizeTimeZone(tenant.settings.time_zone))} className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="delivery-date" className="block text-sm font-medium text-[var(--ink)] mb-1">Delivery Date</label>
            <input id="delivery-date" name="delivery_date" type="date" className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm outline-none" />
          </div>
          <div>
            <label htmlFor="sales-person" className="block text-sm font-medium text-[var(--ink)] mb-1">Sales Person</label>
            <input id="sales-person" name="sales_person" className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm outline-none" placeholder="Name" />
          </div>
        </div>
        <OrderLineEditor products={products} />
        <div>
          <label htmlFor="deposit-amount" className="block text-sm font-medium text-[var(--ink)] mb-1">Deposit ({CURRENCY_SYMBOL})</label>
          <input id="deposit-amount" name="deposit_amount" type="number" step="0.01" min="0" className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm outline-none" placeholder="0" />
        </div>
        <div>
          <label htmlFor="order-notes" className="block text-sm font-medium text-[var(--ink)] mb-1">Notes</label>
          <textarea id="order-notes" name="notes" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm outline-none resize-y" placeholder="Order details..." />
        </div>
        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Creating order…" className="px-6 py-2.5 bg-[var(--ink)] text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-60 disabled:cursor-wait">Create Order</SubmitButton>
          <Link href="/orders" className="px-6 py-2.5 border border-stone-300 rounded-xl text-sm font-medium text-[var(--ink)] hover:bg-stone-50 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
