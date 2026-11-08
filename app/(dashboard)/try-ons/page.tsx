import { getCurrentTenant } from "@/lib/tenant";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ImageUpload from "@/components/image-upload";
import { uploadsEnabled } from "@/lib/uploads";
import { addTryOn } from "./actions";
import SelectField from "@/components/select-field";
import SubmitButton from "@/components/submit-button";
import EmptyState from "@/components/empty-state";

const REACTIONS = [
  { value: "loved", emoji: "😍", label: "Loved it" },
  { value: "liked", emoji: "👍", label: "Liked" },
  { value: "maybe", emoji: "🤔", label: "Maybe" },
  { value: "no", emoji: "👎", label: "Not for me" },
];
export default async function TryOnsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return <TryOnsContent tenantId={tenant.id} />;
}

type OptionRow = { id: string; name: string; barcode?: string | null; category?: string | null };
type TryOnRow = {
  id: string;
  reaction?: string | null;
  rating?: number | null;
  stylist?: string | null;
  notes?: string | null;
  photo_urls?: string[] | null;
  created_at: string;
  customers?: { name: string } | { name: string }[] | null;
  products?: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
};

async function TryOnsContent({ tenantId }: { tenantId: string }) {
  let tryOns: TryOnRow[] = [], customers: OptionRow[] = [], products: OptionRow[] = [];
  try {
    const [r1, r2, r3] = await Promise.all([
      prisma.tryOn.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: "desc" },
        take: 50,
        include: {
          customer: { select: { name: true } },
          product: { select: { name: true, category: true, barcode: true } },
        },
      }),
      prisma.customer.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.product.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true, barcode: true, category: true }, orderBy: { name: "asc" } }),
    ]);
    // Şablon Supabase'in `customers` / `products` adlarını bekliyor.
    tryOns = r1.map(({ customer, product, created_at, ...t }) => ({
      ...t, created_at: created_at.toISOString(), customers: customer, products: product,
    }));
    customers = r2; products = r3;
  } catch {}

  const list = tryOns ?? [];
  const REACTION_EMOJI: Record<string, string> = { loved: "😍", liked: "👍", maybe: "🤔", no: "👎" };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-normal text-gray-900">Try-On Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">Record which gowns each bride tried and their reaction</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Try-On Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-serif font-normal text-gray-900 mb-4">Log a Try-On</h2>
          <form id="new" action={addTryOn} className="scroll-mt-24 flex flex-col gap-3">
            <div>
              <label htmlFor="customer_id-select" className="block text-sm font-medium text-gray-700 mb-1">Bride *</label>
              <SelectField
                name="customer_id"
                required
                placeholder="Select bride…"
                options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div>
              <label htmlFor="product_id-select" className="block text-sm font-medium text-gray-700 mb-1">Gown *</label>
              <SelectField
                name="product_id"
                required
                placeholder="Select gown…"
                options={(products ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.barcode ?? undefined }))}
              />
            </div>
            <div>
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-1">Reaction</legend>
              <div className="flex gap-2">
                {REACTIONS.map((r) => (
                  <label key={r.value} className="flex-1">
                    <input type="radio" name="reaction" value={r.value} className="peer hidden" />
                    <div className="text-center p-2 rounded-xl border border-gray-200 cursor-pointer peer-checked:border-gray-900 peer-checked:bg-gray-50 transition-all">
                      <div className="text-xl">{r.emoji}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{r.label}</div>
                    </div>
                  </label>
                ))}
              </div>
              </fieldset>
            </div>
            <div>
              <label htmlFor="rating-select" className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <SelectField
                name="rating"
                placeholder="Skip"
                searchable={false}
                options={[
                  { value: "5", label: "★★★★★ Perfect" },
                  { value: "4", label: "★★★★☆ Great" },
                  { value: "3", label: "★★★☆☆ Good" },
                  { value: "2", label: "★★☆☆☆ Okay" },
                  { value: "1", label: "★☆☆☆☆ Not great" },
                ]}
              />
            </div>
            <div>
              <label htmlFor="try-on-stylist" className="block text-sm font-medium text-gray-700 mb-1">Stylist</label>
              <input id="try-on-stylist" name="stylist" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="Stylist name" />
            </div>
            <div>
              <label htmlFor="try-on-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea id="try-on-notes" name="notes" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none resize-y" placeholder="Loved the lace detail, needed bigger size..." />
            </div>
            <ImageUpload
              name="photo_urls"
              scope="try-on"
              multiple
              label="Fitting photos"
              disabled={!uploadsEnabled()}
              disabledHint="Photo uploads need BLOB_READ_WRITE_TOKEN to be configured."
            />
            <SubmitButton pendingLabel="Saving try-on…" className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-wait">
              Log Try-On
            </SubmitButton>
          </form>
        </div>

        {/* Try-On History */}
        <div className="lg:col-span-2">
          {list.length > 0 ? (
            <div className="flex flex-col gap-3">
              {list.map((t) => {
                const cust = (Array.isArray(t.customers) ? t.customers[0] : t.customers) as { name: string } | null;
                const prod = (Array.isArray(t.products) ? t.products[0] : t.products) as { name: string; category: string | null } | null;
                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gold-soft flex items-center justify-center text-2xl flex-shrink-0">
                      {t.reaction ? REACTION_EMOJI[t.reaction] : "👗"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-gray-900 text-sm truncate">{cust?.name ?? "—"}</h3>
                        <span className="text-xs text-gray-400 flex-shrink-0">{new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        Tried <strong>{prod?.name ?? "—"}</strong>
                        {prod?.category && <span className="text-gray-400"> · {prod.category}</span>}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {t.rating && <span className="text-xs text-amber-500">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</span>}
                        {t.stylist && <span className="text-xs text-gray-400">by {t.stylist}</span>}
                      </div>
                      {t.notes && <p className="text-xs text-gray-500 mt-1.5">{t.notes}</p>}
                      {t.photo_urls && t.photo_urls.length > 0 && (
                        <div className="flex gap-2 mt-2.5">
                          {t.photo_urls.slice(0, 5).map((url: string) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                              <Image
                                unoptimized
                                src={url}
                                alt="Fitting photo"
                                width={400}
                                height={300}
                                className="w-14 h-14 rounded-lg object-cover border border-gray-200 hover:border-gold/30 transition-colors"
                              />
                            </a>
                          ))}
                          {t.photo_urls.length > 5 && (
                            <span className="w-14 h-14 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                              +{t.photo_urls.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="checkroom" action={{ href: "#new", label: "Log a try-on" }} title="No try-ons yet">
              Log gown try-ons during appointments to build bride profiles.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
