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
import { addMember, updateRole, removeMember } from "./actions";

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ekip &amp; Roller</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kimin erişebileceğini ve ne yapabileceğini yönetin
        </p>
      </div>

      {params?.success && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          {params.success === "added" && "Team member added."}
          {params.success === "invited" && "Invitation sent. The link expires in seven days."}
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Üye Davet Et</h2>
            <form action={addMember} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                  placeholder="ekip@ornek.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  name="role"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none"
                  defaultValue="stylist"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
              >
                Davet Gönder
              </button>
            </form>
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                Davet edilen kişinin bir BridalStack hesabı olmalı. Giriş yaptıktan sonra bu
                mağazayı görür.
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
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Kullanıcı</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Katıldı</th>
                {canManage && (
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
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
                      {m.user_id.slice(0, 8)}…{isSelf ? " (siz)" : ""}
                    </td>
                    <td className="px-6 py-4">
                      {editable ? (
                        <form action={updateRole} className="inline-flex items-center gap-2">
                          <input type="hidden" name="id" value={m.id} />
                          <select
                            name="role"
                            defaultValue={role}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 outline-none"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Kaydet
                          </button>
                        </form>
                      ) : (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            role === "owner"
                              ? "bg-rose-100 text-rose-700"
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
                      {new Date(m.created_at).toLocaleDateString("tr-TR", {
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
                              Kaldır
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
