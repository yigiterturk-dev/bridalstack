import { redirect } from "next/navigation";
import { CURRENCY_SYMBOL, formatPrice } from "@/config/modules";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createContract } from "./actions";
import SelectField from "@/components/select-field";
import EmptyState from "@/components/empty-state";

export default async function ContractsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const [contractRows, customers, orders] = await Promise.all([
    prisma.contract.findMany({
      where: { tenant_id: tenant.id },
      orderBy: { created_at: "desc" },
      take: 50,
      include: { customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({ where: { tenant_id: tenant.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({ where: { tenant_id: tenant.id }, select: { id: true, ref_no: true, discounted_total: true }, orderBy: { created_at: "desc" }, take: 20 }),
  ]);

  // Şablon Supabase'in `customers` adını bekliyor.
  const list = contractRows.map(({ customer, ...c }) => ({ ...c, customers: customer }));

  const STATUS_STYLE: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", viewed: "bg-amber-100 text-amber-700",
    signed: "bg-green-100 text-green-700", expired: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-normal text-gray-900">Contracts & E-Sign</h1>
          <p className="text-sm text-gray-500 mt-1">Send contracts, brides sign online</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-serif font-normal text-gray-900 mb-4">New Contract</h2>
          <form id="new" action={createContract} className="scroll-mt-24 flex flex-col gap-3">
            <div>
              <label htmlFor="customer_id-select" className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <SelectField
                name="customer_id"
                required
                placeholder="Select…"
                options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div>
              <label htmlFor="order_id-select" className="block text-sm font-medium text-gray-700 mb-1">Link to Order</label>
              <SelectField
                name="order_id"
                placeholder="None"
                options={(orders ?? []).map((o) => ({
                  value: o.id,
                  label: o.ref_no,
                  hint: formatPrice(Number(o.discounted_total)),
                }))}
              />
            </div>
            <div>
              <label htmlFor="contract-title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input id="contract-title" name="title" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="Bridal Gown Purchase Agreement" />
            </div>
            <div>
              <label htmlFor="contract-total-amount" className="block text-sm font-medium text-gray-700 mb-1">Total Amount ({CURRENCY_SYMBOL})</label>
              <input id="contract-total-amount" name="total_amount" type="number" step="0.01" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="0" />
            </div>
            <div>
              <label htmlFor="contract-content" className="block text-sm font-medium text-gray-700 mb-1">Contract Content *</label>
              <textarea id="contract-content" name="content" rows={6} required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none resize-y" placeholder="Terms and conditions..." />
            </div>
            <button type="submit" className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">Create & Send</button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {list.length > 0 ? (
            <div className="flex flex-col gap-3">
              {list.map((c) => {
                const cust = (Array.isArray(c.customers) ? c.customers[0] : c.customers) as { name: string } | null;
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{c.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{cust?.name ?? "—"} · {formatPrice(Number(c.total_amount))} · {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[c.status] ?? STATUS_STYLE.draft}`}>{c.status}</span>
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/contracts/${c.token}`)} className="text-xs text-gray-500 hover:text-gray-900">Copy Link</button>
                      <Link href={`/print/contract/${c.id}`} className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">print</span>
                        Print
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="draw" action={{ href: "#new", label: "Create a contract" }} title="No contracts yet">
              Create your first e-sign contract.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
