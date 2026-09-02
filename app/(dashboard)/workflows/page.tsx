import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createWorkflow, toggleWorkflow, deleteWorkflow } from "./actions";

const TRIGGERS = [
  { value: "appointment_created", label: "Appointment Created", icon: "event" },
  { value: "appointment_confirmed", label: "Appointment Confirmed", icon: "check_circle" },
  { value: "order_created", label: "Order Created", icon: "receipt_long" },
  { value: "order_delivered", label: "Order Delivered", icon: "local_shipping" },
  { value: "payment_received", label: "Payment Received", icon: "payments" },
  { value: "customer_created", label: "New Customer", icon: "person_add" },
  { value: "try_on_logged", label: "Try-On Logged", icon: "checkroom" },
];

const ACTIONS = [
  { value: "send_email", label: "Send Email", icon: "email" },
  { value: "send_reminder", label: "Send Reminder (24h before)", icon: "notifications" },
  { value: "update_status", label: "Update Status", icon: "sync" },
  { value: "request_review", label: "Request Google Review", icon: "star" },
];

export default async function WorkflowsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const list = await prisma.workflow.findMany({
    where: { tenant_id: tenant.id },
    orderBy: { created_at: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
        <p className="text-sm text-gray-500 mt-1">When something happens → do something automatically</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Workflow</h2>
          <form action={createWorkflow} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input name="name" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="e.g. Send reminder before appointment" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">When this happens...</label>
              <div className="flex flex-col gap-1.5">
                {TRIGGERS.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 cursor-pointer has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
                    <input type="radio" name="trigger_type" value={t.value} required className="accent-gray-900" />
                    <span className="material-symbols-outlined text-sm text-gray-500">{t.icon}</span>
                    <span className="text-sm text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Do this...</label>
              <div className="flex flex-col gap-1.5">
                {ACTIONS.map((a) => (
                  <label key={a.value} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 cursor-pointer has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
                    <input type="radio" name="action_type" value={a.value} required className="accent-gray-900" />
                    <span className="material-symbols-outlined text-sm text-gray-500">{a.icon}</span>
                    <span className="text-sm text-gray-700">{a.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay (minutes)</label>
              <input name="delay_minutes" type="number" min="0" defaultValue="0" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" />
            </div>
            <button type="submit" className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">Create Workflow</button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {list.length > 0 ? (
            <div className="flex flex-col gap-3">
              {list.map((w) => {
                const trigger = TRIGGERS.find((t) => t.value === w.trigger_type);
                const action = ACTIONS.find((a) => a.value === w.action_type);
                return (
                  <div key={w.id} className={`bg-white rounded-2xl border border-gray-200 p-5 ${!w.is_active ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 text-sm">{w.name}</h3>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">{trigger?.icon ?? "bolt"}</span>
                          {trigger?.label ?? w.trigger_type}
                          <span className="mx-1">→</span>
                          <span className="material-symbols-outlined text-xs">{action?.icon ?? "bolt"}</span>
                          {action?.label ?? w.action_type}
                          {w.delay_minutes > 0 && <span className="ml-1">(+{w.delay_minutes}min)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <form action={toggleWorkflow}>
                          <input type="hidden" name="id" value={w.id} />
                          <input type="hidden" name="is_active" value={w.is_active ? "false" : "true"} />
                          <button type="submit" className={`text-xs px-3 py-1 rounded-lg font-medium ${w.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {w.is_active ? "Active" : "Off"}
                          </button>
                        </form>
                        <form action={deleteWorkflow}>
                          <input type="hidden" name="id" value={w.id} />
                          <button type="submit" className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-4 block">bolt</span>
              <h3 className="text-lg font-semibold text-gray-900">No automations yet</h3>
              <p className="text-sm text-gray-500">Create workflows to automate repetitive tasks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
