import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { loadBriefing } from "./briefing";
import StylistChat from "./stylist-chat";

export const dynamic = "force-dynamic";

const TONE_STYLE: Record<string, { chip: string; dot: string; label: string }> = {
  urgent: { chip: "bg-gold-soft text-gold border-gold/30", dot: "bg-gold", label: "Do today" },
  opportunity: { chip: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-emerald-500", label: "Earns money" },
  watch: { chip: "bg-stone-100 text-stone-600 border-stone-200", dot: "bg-stone-400", label: "Keep an eye on" },
};

export default async function AIStylistPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  // Brifing yapay zekâ anahtarı olmadan da çalışır: kendi verinizden hesaplanır.
  const briefing = await loadBriefing(tenant.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-normal text-gray-900">AI Stylist ✨</h1>
        <p className="text-sm text-gray-500 mt-1">
          What needs your attention today, and answers about your inventory and brides
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-gold">bolt</span>
          <h2 className="font-serif font-normal text-gray-900">Today at {tenant.name}</h2>
        </div>

        {briefing.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nothing needs chasing right now. No unpaid installments, no unanswered bookings, and
            every bride who loved a gown has ordered.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {briefing.map((item) => {
              const tone = TONE_STYLE[item.tone];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50/60 transition-all"
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${tone.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{item.title}</span>
                      <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone.chip}`}>
                        {tone.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{item.detail}</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0">
                    arrow_forward
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <StylistChat />
    </div>
  );
}
