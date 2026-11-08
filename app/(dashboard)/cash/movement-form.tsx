"use client";

import { useState } from "react";
import SelectField from "@/components/select-field";
import { CASH_METHODS, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/finance";
import { createMovement } from "./actions";

const INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-[var(--ink)] outline-none focus:border-stone-400 transition-colors";

/**
 * Kasa hareketi formu. Yön değişince kategori listesi de değişir —
 * gider kaydına "Deposit" seçtirmek kayıtları çöpe çevirir.
 */
export default function MovementForm({ today, back }: { today: string; back: string }) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const categories = direction === "out" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <form action={createMovement} className="flex flex-col gap-3">
      <input type="hidden" name="back" value={back} />

      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-stone-100">
        {(["in", "out"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              direction === d ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)]"
            }`}
          >
            {d === "in" ? "Money in" : "Money out"}
          </button>
        ))}
      </div>
      <input type="hidden" name="direction" value={direction} />

      <Field label="Amount *">
        <input name="amount" type="number" step="0.01" min="0.01" required className={INPUT} placeholder="0.00" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          {/* key: yön değişince seçim sıfırlansın */}
          <SelectField
            key={direction}
            name="category"
            defaultValue={categories[0].id}
            searchable={false}
            options={categories.map((c) => ({ value: c.id, label: c.label }))}
          />
        </Field>
        <Field label="Method">
          <SelectField
            name="method"
            defaultValue="cash"
            searchable={false}
            options={CASH_METHODS.map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>
      </div>

      <Field label="Date">
        <input name="occurred_on" type="date" defaultValue={today} className={INPUT} />
      </Field>

      <Field label="Note">
        <input name="description" maxLength={160} className={INPUT} placeholder="What was this for?" />
      </Field>

      <button
        type="submit"
        className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-gold transition-colors"
      >
        Record {direction === "in" ? "payment" : "expense"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}
