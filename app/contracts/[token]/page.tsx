import { prisma } from "@/lib/prisma";
import SignContract from "./sign-contract";

type Props = { params: Promise<{ token: string }> };

export default async function ContractSignPage({ params }: Props) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { token },
    include: {
      customer: { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
  });

  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract Not Found</h1>
          <p className="text-gray-500">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const tenant = contract.tenant;
  const customer = contract.customer;

  if (contract.status === "signed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-green-600 mb-4 block">check_circle</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract Signed</h1>
          <p className="text-gray-500">Signed on {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}</p>
        </div>
      </div>
    );
  }

  if (contract.status !== "sent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-gray-400 mb-4 block" aria-hidden="true">description</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract unavailable</h1>
          <p className="text-gray-500">This contract is no longer available for signing. Please contact the boutique if you need a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{tenant?.name ?? "Bridal Shop"}</h1>
          <p className="text-gray-500 mt-1">Contract for {customer?.name ?? "Client"}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{contract.title}</h2>
          {contract.total_amount > 0 && (
            <div className="inline-flex px-4 py-2 rounded-xl bg-gray-100 text-lg font-bold text-gray-900 mb-6">
              ${Number(contract.total_amount).toLocaleString()}
            </div>
          )}
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {contract.content}
          </div>
        </div>

        <SignContract token={token} customerName={customer?.name ?? ""} />

        <p className="text-center text-xs text-gray-400 mt-8">Powered by BridalStack · Legally binding electronic signature</p>
      </div>
    </div>
  );
}
