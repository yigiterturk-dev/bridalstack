import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import PrintDocument from "@/components/print-document";
import PrintToolbar from "@/components/print-toolbar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const dateLong = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function ContractPrintPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const contract = await prisma.contract.findFirst({
    where: { id, tenant_id: tenant.id },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      order: { select: { ref_no: true } },
    },
  });
  if (!contract) redirect("/contracts");

  return (
    <div className="py-2">
      <PrintToolbar backHref="/contracts" backLabel="Back to contracts" />

      <PrintDocument
        shopName={tenant.name}
        logoUrl={tenant.logo_url}
        accentColor={tenant.accent_color}
        documentTitle="Agreement"
        reference={contract.order?.ref_no ?? null}
      >
        <h1 className="text-2xl font-bold tracking-tight mb-6">{contract.title}</h1>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Between</div>
            <div className="font-semibold">{tenant.name}</div>
            <div className="text-stone-500">and</div>
            <div className="font-semibold">{contract.customer.name}</div>
            {contract.customer.phone && <div className="text-stone-500">{contract.customer.phone}</div>}
            {contract.customer.email && <div className="text-stone-500">{contract.customer.email}</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Terms</div>
            <div>
              <span className="text-stone-400">Value </span>
              <span className="font-semibold tabular-nums">{formatPrice(contract.total_amount)}</span>
            </div>
            <div>
              <span className="text-stone-400">Issued </span>
              {dateLong(contract.created_at)}
            </div>
            <div>
              <span className="text-stone-400">Status </span>
              <span className="capitalize font-medium">{contract.status}</span>
            </div>
          </div>
        </div>

        <div className="text-sm leading-relaxed whitespace-pre-wrap text-stone-700 mb-10">
          {contract.content}
        </div>

        <div className="print-keep border-t border-stone-200 pt-8">
          {contract.signed_at ? (
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3">
                  Signed by
                </div>
                <div
                  className="text-2xl mb-1"
                  style={{ fontFamily: "var(--font-signature, cursive)" }}
                >
                  {contract.signature_data}
                </div>
                <div className="border-t border-stone-300 pt-2 text-sm text-stone-600">
                  {contract.customer.name}
                </div>
              </div>
              <div className="text-right text-sm text-stone-500">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3">
                  Signed on
                </div>
                <div className="text-stone-800 font-medium">{dateLong(contract.signed_at)}</div>
                <div>
                  {contract.signed_at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
                {contract.ip_address && (
                  <div className="text-xs text-stone-400 mt-2 font-mono">IP {contract.ip_address}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="h-14 border-b border-stone-300" />
                <div className="text-sm text-stone-500 mt-2">{contract.customer.name}</div>
              </div>
              <div>
                <div className="h-14 border-b border-stone-300" />
                <div className="text-sm text-stone-500 mt-2">Date</div>
              </div>
            </div>
          )}
        </div>
      </PrintDocument>
    </div>
  );
}
