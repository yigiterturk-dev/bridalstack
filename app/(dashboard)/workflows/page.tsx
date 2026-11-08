import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createWorkflow, toggleWorkflow, deleteWorkflow } from "./actions";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import SubmitButton from "@/components/submit-button";
import EmptyState from "@/components/empty-state";

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
        <h1 className="text-2xl font-serif font-normal text-gray-900">Automations</h1>
        <p className="text-sm text-gray-500 mt-1">When something happens → do something automatically</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-serif font-normal text-gray-900 mb-4">New Workflow</h2>
          <form id="new" action={createWorkflow} className="scroll-mt-24 flex flex-col gap-3">
            <div>
              <label htmlFor="workflow-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input id="workflow-name" name="name" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-1" placeholder="e.g. Send reminder before appointment" />
            </div>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">When this happens...</legend>
              <div className="flex flex-col gap-1.5">
                {TRIGGERS.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 cursor-pointer has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
                    <input type="radio" name="trigger_type" value={t.value} required className="accent-gray-900" />
                    <span className="material-symbols-outlined text-sm text-gray-500">{t.icon}</span>
                    <span className="text-sm text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">Do this...</legend>
              <div className="flex flex-col gap-1.5">
                {ACTIONS.map((a) => (
                  <label key={a.value} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 cursor-pointer has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
                    <input type="radio" name="action_type" value={a.value} required className="accent-gray-900" />
                    <span className="material-symbols-outlined text-sm text-gray-500">{a.icon}</span>
                    <span className="text-sm text-gray-700">{a.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="workflow-delay" className="block text-sm font-medium text-gray-700 mb-1">Delay (minutes)</label>
              <input id="workflow-delay" name="delay_minutes" type="number" min="0" max={365 * 24 * 60} defaultValue="0" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-1" />
            </div>
            <SubmitButton pendingLabel="Creating…" className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">Create Workflow</SubmitButton>
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
                          <ConfirmSubmitButton
                            message={`Delete workflow “${w.name}”? This cannot be undone.`}
                            ariaLabel={`Delete workflow ${w.name}`}
                            className="text-xs text-red-500 hover:text-red-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="bolt" action={{ href: "#new", label: "Create an automation" }} title="No automations yet">
              Create workflows to automate repetitive tasks.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
