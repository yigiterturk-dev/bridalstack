import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createOrder } from "@/lib/actions";

export default async function NewOrderPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const customers = await prisma.customer.findMany({
    where: { tenant_id: tenant.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-xl">
      <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Back to Orders</Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Order</h1>

      <form action={createOrder} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
          <select name="customer_id" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none">
            <option value="">Select customer...</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select name="order_type" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none">
              <option value="sale">Sale</option>
              <option value="rental">Rental</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
            <input name="order_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
            <input name="delivery_date" type="date" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sales Person</label>
            <input name="sales_person" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="Name" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount ($)</label>
            <input name="discounted_total" type="number" step="0.01" min="0" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deposit ($)</label>
            <input name="deposit_amount" type="number" step="0.01" min="0" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="0" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea name="notes" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none resize-y" placeholder="Order details..." />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">Create Order</button>
          <Link href="/orders" className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
