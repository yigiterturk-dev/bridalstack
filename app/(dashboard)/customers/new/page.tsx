import Link from "next/link";
import { createCustomer } from "@/lib/actions";
import SubmitButton from "@/components/submit-button";

export default function NewCustomerPage() {
  return (
    <div className="max-w-xl">
      <Link href="/customers" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Back to Customers</Link>
      <h1 className="text-2xl font-serif font-normal text-gray-900 mb-6">New Customer</h1>

      <form action={createCustomer} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
        <div>
          <label htmlFor="customer-name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input id="customer-name" name="name" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gold/40 focus:border-transparent outline-none text-sm" placeholder="Jane Smith" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input id="customer-phone" name="phone" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gold/40 focus:border-transparent outline-none text-sm" placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="customer-email" name="email" type="email" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gold/40 focus:border-transparent outline-none text-sm" placeholder="jane@example.com" />
          </div>
        </div>
        <div>
          <label htmlFor="customer-event-date" className="block text-sm font-medium text-gray-700 mb-1">Wedding date</label>
          <input id="customer-event-date" name="event_date" type="date" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gold/40 focus:border-transparent outline-none text-sm" />
        </div>
        <div>
          <label htmlFor="customer-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="customer-notes" name="notes" rows={3} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gold/40 focus:border-transparent outline-none text-sm resize-y" placeholder="Style, budget, who she brings..." />
        </div>
        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Saving customer…" className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-wait">Save Customer</SubmitButton>
          <Link href="/customers" className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
