import { ACCESS_SECTIONS, isSectionOpen } from "@/lib/member-access";
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
import { addMember, updateRole, removeMember, revokeInvite, toggleAccess } from "./actions";
import SelectField from "@/components/select-field";
import InviteLinkButton from "@/components/invite-link-button";
import SubmitButton from "@/components/submit-button";
import { inviteStatus } from "@/lib/invitations";
import PageHead, { BTN_PRIMARY } from "@/components/page-head";
import AddPanel from "@/components/add-panel";
import ListRow, { ListBox } from "@/components/list-row";

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
    include: { user: { select: { name: true, email: true } } },
  });

  // Kabul edilmemiş davetler: e-posta gitmese bile ekip buradan kurulabilsin.
  const invitations = canManage
    ? await prisma.invitation.findMany({
        where: { tenant_id: tenant.id, accepted_at: null },
        orderBy: { created_at: "desc" },
        select: { id: true, email: true, role: true, expires_at: true, accepted_at: true, created_at: true },
      })
    : [];

  const flash = params?.success
    ? {
        added: "Team member added.",
        invited: "Invitation sent. The link expires in seven days.",
        invited_nomail: "Invitation created, but the email could not be sent. Use “Get invite link” below and share it yourself.",
        invite_revoked: "Invitation revoked.",
        role_updated: "Role updated.",
        removed: "Team member removed.",
      }[params.success]
    : null;
  const flashError = params?.error
    ? { forbidden: "You do not have permission for this action.", email: "Enter a valid email address.", role: "Invalid role." }[params.error]
    : null;

  return (
    <div>
      <PageHead
        title="Team"
        sub={`${list.length} ${list.length === 1 ? "person can" : "people can"} sign in${
          invitations.length > 0 ? ` · ${invitations.length} invite${invitations.length === 1 ? "" : "s"} waiting` : ""
        }`}
      />

      {flash && <div className="mb-4 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)]">{flash}</div>}
      {flashError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-late">{flashError}</div>}

      <div className="flex flex-col gap-6">
        {canManage && (
          <AddPanel title="Invite a team member">
            <form action={addMember} className="flex flex-col gap-3">
              <Field label="Email">
                <input id="staff-email" name="email" type="email" required className={INPUT} placeholder="team@example.com" />
              </Field>
              <Field label="Role">
                <SelectField
                  name="role"
                  defaultValue="stylist"
                  searchable={false}
                  options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], hint: ROLE_DESCRIPTIONS[r] }))}
                />
              </Field>
              <p className="text-sm text-[var(--muted)]">
                Already on BridalStack? They are added right away. Otherwise they get a link that works for seven days.
              </p>
              <SubmitButton pendingLabel="Sending invite…" className={`${BTN_PRIMARY} justify-center disabled:cursor-wait disabled:opacity-60`}>
                Send invite
              </SubmitButton>
            </form>
          </AddPanel>
        )}

        <ListBox>
          {list.map((m) => {
            const role = normalizeRole(m.role);
            const isSelf = m.user_id === userId;
            const editable = canManage && role !== "owner" && !isSelf;
            const joined = new Date(m.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={m.id} id={`member-${m.id}`} className="px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  {/* Kimlik değil ad: "a9cad29f…" kimseye bir şey söylemiyor. */}
                  <div className="truncate font-medium text-[var(--ink)]">
                    {m.display_name || m.user.name || m.user.email}
                    {isSelf && <span className="font-normal text-[var(--muted)]"> (you)</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted)] sm:truncate">
                    {(m.display_name || m.user.name) ? `${m.user.email} · ` : ""}joined {joined}
                  </p>
                </div>
                {editable ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <form action={updateRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <div className="w-36">
                        <SelectField
                          name="role"
                          defaultValue={role}
                          searchable={false}
                          options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                        />
                      </div>
                      <button type="submit" className="text-sm font-medium text-gold hover:underline">Save</button>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-sm text-[var(--muted)] hover:text-late">Remove</button>
                    </form>
                  </div>
                ) : (
                  <div className="shrink-0 text-right font-serif text-lg text-[var(--ink)]">{ROLE_LABELS[role]}</div>
                )}
              </div>
              {editable && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">What they can open · tap to switch</p>
                  <div className="flex flex-wrap gap-2">
                    {ACCESS_SECTIONS.map((sec) => {
                      const open = isSectionOpen(m.hidden_modules, sec.key);
                      return (
                        <form key={sec.key} action={toggleAccess}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="section" value={sec.key} />
                          <button
                            type="submit"
                            title={`${sec.hint} — ${open ? "open, tap to close" : "closed, tap to open"}`}
                            aria-pressed={open}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                              open
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                                : "border-[var(--line)] bg-white text-[var(--muted)] line-through decoration-[var(--muted)]/50"
                            }`}
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{open ? "check" : "block"}</span>
                            {sec.label}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </ListBox>

        {canManage && invitations.length > 0 && (
          <section>
            <h2 className="mb-1 font-serif text-lg text-[var(--ink)]">Waiting to accept</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">If the email did not arrive, copy the link and send it yourself.</p>
            <ListBox>
              {invitations.map((inv) => {
                const expired = inviteStatus(inv) === "expired";
                return (
                  <div key={inv.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {expired && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber" />}
                        <span className="truncate font-medium text-[var(--ink)]">{inv.email}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">
                        {ROLE_LABELS[normalizeRole(inv.role)]} · {expired ? "link expired" : "invite sent"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <InviteLinkButton invitationId={inv.id} />
                      <form action={revokeInvite}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button type="submit" className="text-sm text-[var(--muted)] hover:text-late">Revoke</button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </ListBox>
          </section>
        )}

        <section>
          <h2 className="mb-3 font-serif text-lg text-[var(--ink)]">What each role can do</h2>
          <ListBox>
            {(["owner", "admin", "stylist", "viewer"] as const).map((r) => (
              <ListRow key={r} title={ROLE_LABELS[r]} sub={ROLE_DESCRIPTIONS[r]} />
            ))}
          </ListBox>
        </section>
      </div>
    </div>
  );
}

const INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-[var(--ink)] outline-none focus:border-stone-400 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</label>
      {children}
    </div>
  );
}
