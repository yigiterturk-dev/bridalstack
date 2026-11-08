import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import ImportWizard from "./import-wizard";

export default async function ImportCustomersPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const member = await getCurrentMember();
  const canImport =
    hasPermission(member?.role, "import.run") && hasPermission(member?.role, "customers.manage");

  if (!canImport) redirect("/customers?error=forbidden");

  return (
    <div className="max-w-3xl">
      <Link href="/customers" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        ← Back to customers
      </Link>
      <h1 className="text-2xl font-serif font-normal text-gray-900 mb-1">Bulk customer import</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload a CSV file. Columns: <strong>name, phone, email, notes</strong>. A header row is detected automatically.
      </p>
      <ImportWizard />
    </div>
  );
}
