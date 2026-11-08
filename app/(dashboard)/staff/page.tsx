import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember, getCurrentUserId } from "@/lib/tenant";
import {
  hasPermission,
  normalizeRole,
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from "@/lib/rbac";
import { addMember, updateRole, removeMember, revokeInvite } from "./actions";
import SelectField from "@/components/select-field";
import InviteLinkButton from "@/components/invite-link-button";
import SubmitButton from "@/components/submit-button";
import { inviteStatus } from "@/lib/invitations";

type PageProps = { searchParams?: Promise<{ success?: string; error?: string }> };

export default async function StaffPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const userId = await getCurrentUserId();
  const member = await getCurrentMember();
  const canManage = hasPermission(member?.role, "staff.manage");

  const list = await prisma.tenantMember.findMany({
    where: { tenant_id: tenant.id },
    orderBy: { created_at: "asc" },
  });

  // Kabul edilmemiş davetler: e-posta gitmese bile ekip buradan kurulabilsin.
  const invitations = canManage
    ? await prisma.invitation.findMany({
        where: { tenant_id: tenant.id, accepted_at: null },
        orderBy: { created_at: "desc" },
        select: { id: true, email: true, role: true, expires_at: true, accepted_at: true, created_at: true },
      })
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-normal text-gray-900">Team &amp; Roles</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage who can sign in and what they can do
        </p>
      </div>

      {params?.success && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          {params.success === "added" && "Team member added."}
          {params.success === "invited" && "Invitation sent. The link expires in seven days."}
          {params.success === "invited_nomail" &&
            "Invitation created, but the email could not be sent. Use “Get invite link” below and share it yourself."}
          {params.success === "invite_revoked" && "Invitation revoked."}
          {params.success === "role_updated" && "Role updated."}
          {params.success === "removed" && "Team member removed."}
        </div>
      )}
      {params?.error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {params.error === "forbidden" && "You do not have permission for this action."}
          {params.error === "email" && "Enter a valid email address."}
          {params.error === "role" && "Invalid role."}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canManage && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-serif font-normal text-gray-900 mb-4">Invite a team member</h2>
            <form action={addMember} className="flex flex-col gap-3">
              <div>
                <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="staff-email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                  placeholder="team@example.com"
                />
              </div>
              <div>
                <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <SelectField
                  name="role"
                  defaultValue="stylist"
                  searchable={false}
                  options={ASSIGNABLE_ROLES.map((r) => ({
                    value: r,
                    label: ROLE_LABELS[r],
                    hint: ROLE_DESCRIPTIONS[r],
                  }))}
                />
              </div>
              <SubmitButton
                pendingLabel="Sending invite…"
                className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-wait"
              >
                Send invite
              </SubmitButton>
            </form>
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                If this person already has a BridalStack account they are added right away.
                Otherwise they get an invite link that is valid for seven days.
              </p>
            </div>
          </div>
        )}

        <div
          className={`${canManage ? "lg:col-span-2" : "lg:col-span-3"} bg-white rounded-2xl border border-gray-200 overflow-x-auto`}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                {canManage && (
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((m) => {
                const role = normalizeRole(m.role);
                const isSelf = m.user_id === userId;
                const editable = canManage && role !== "owner" && !isSelf;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {m.user_id.slice(0, 8)}…{isSelf ? " (you)" : ""}
                    </td>
                    <td className="px-6 py-4">
                      {editable ? (
                        <form action={updateRole} className="inline-flex items-center gap-2">
                          <input type="hidden" name="id" value={m.id} />
                          <div className="w-36">
                            <SelectField
                              name="role"
                              defaultValue={role}
                              searchable={false}
                              options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                            />
                          </div>
                          <button
                            type="submit"
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            role === "owner"
                              ? "bg-gold-soft text-gold"
                              : role === "admin"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ROLE_LABELS[role]}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(m.created_at).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        {editable && (
                          <form action={removeMember} className="inline">
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                              Remove
                            </button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && invitations.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-serif font-normal text-gray-900">Pending invitations</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Nobody has accepted these yet. Generate a link if the email did not arrive.
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Link</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invitations.map((inv) => {
                const status = inviteStatus(inv);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 align-top">
                    <td className="px-6 py-4 text-sm text-gray-900">{inv.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {ROLE_LABELS[normalizeRole(inv.role)]}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          status === "expired"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {status === "expired" ? "Expired" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <InviteLinkButton invitationId={inv.id} />
                    </td>
                    <td className="px-6 py-4">
                      <form action={revokeInvite} className="inline">
                        <input type="hidden" name="id" value={inv.id} />
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                          Revoke
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rol açıklamaları */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(["owner", "admin", "stylist", "viewer"] as const).map((r) => (
          <div key={r} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="font-semibold text-gray-900 text-sm mb-1">{ROLE_LABELS[r]}</div>
            <p className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
