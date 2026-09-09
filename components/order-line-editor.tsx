"use client";

import { useState } from "react";
import SelectField from "@/components/select-field";
import { LINE_KINDS, lineNet, totals } from "@/lib/order-lines";
import { formatPrice } from "@/config/modules";

/**
 * Sipariş kurulurken kalem girme.
 *
 * Değişmez korunur: kalem girilirse toplam KALEMLERDEN okunur, o yüzden
 * elle yazılan "Total Amount" alanı kalem eklenince ekrandan kalkar —
 * iki ayrı toplam aynı anda gönderilemez, çelişki doğmaz. Hiç kalem
 * eklenmezse form eskisi gibi tek toplamla çalışır.
 */

const INPUT =
  "w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 outline-none focus:border-gray-500 transition-colors";

export type LineProduct = { id: string; name: string; sku?: string | null; price?: number | null };

type Row = {
  key: number;
  kind: string;
  description: string;
  product_id: string;
  quantity: string;
  unit_price: string;
  discount: string;
};

function emptyRow(key: number): Row {
  return { key, kind: "gown", description: "", product_id: "", quantity: "1", unit_price: "", discount: "" };
}

export default function OrderLineEditor({ products }: { products: LineProduct[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [nextKey, setNextKey] = useState(1);

  function patch(key: number, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  /** Katalogdan seçim: boş bırakılan ad ve fiyatı doldurur, yazılanı ezmez. */
  function pickProduct(row: Row, productId: string) {
    const product = products.find((p) => p.id === productId);
    patch(row.key, {
      product_id: productId,
      description: row.description || product?.name || "",
      unit_price: row.unit_price || (product?.price != null ? String(product.price) : ""),
    });
  }

  const parsed = rows.map((row) => ({
    quantity: Math.max(1, Math.floor(Number(row.quantity) || 0) || 1),
    unit_price: Math.max(0, Number(row.unit_price) || 0),
    discount: Math.max(0, Number(row.discount) || 0),
    kind: row.kind,
  }));
  const summary = totals(parsed);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Items</label>
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          + Add item
        </button>
      </div>

      {rows.length === 0 ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount ($)</label>
          <input name="discounted_total" type="number" step="0.01" min="0" className={INPUT} placeholder="0" />
          <p className="text-xs text-gray-400 mt-1">
            Add items to build the total from them instead of typing one figure.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={row.key} className="grid grid-cols-2 lg:grid-cols-12 gap-2 items-end">
              <div className="col-span-2 lg:col-span-4">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">From the catalogue</label>}
                <SelectField
                  name="line_product_id"
                  placeholder="Optional…"
                  options={products.map((p) => ({ value: p.id, label: p.name, hint: p.sku ?? undefined }))}
                  onChange={(value) => pickProduct(row, value)}
                />
              </div>
              <div className="col-span-2 lg:col-span-3">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Or type a name</label>}
                <input
                  name="line_description"
                  type="text"
                  value={row.description}
                  onChange={(e) => patch(row.key, { description: e.target.value })}
                  placeholder="Veil, alteration…"
                  className={INPUT}
                />
              </div>
              <div className="lg:col-span-2">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Kind</label>}
                <SelectField
                  name="line_kind"
                  defaultValue={row.kind}
                  searchable={false}
                  options={LINE_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                  onChange={(value) => patch(row.key, { kind: value })}
                />
              </div>
              <div className="lg:col-span-1">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>}
                <input
                  name="line_quantity"
                  type="number"
                  min="1"
                  max="99"
                  value={row.quantity}
                  onChange={(e) => patch(row.key, { quantity: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div className="lg:col-span-1">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>}
                <input
                  name="line_unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.unit_price}
                  onChange={(e) => patch(row.key, { unit_price: e.target.value })}
                  placeholder="Auto"
                  className={INPUT}
                />
              </div>
              <div className="lg:col-span-1">
                {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Off</label>}
                <input
                  name="line_discount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.discount}
                  onChange={(e) => patch(row.key, { discount: e.target.value })}
                  placeholder="0"
                  className={INPUT}
                />
              </div>
              <div className="col-span-2 lg:col-span-12 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Line total {formatPrice(Math.round(lineNet(parsed[index])))}
                </span>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
            <span className="text-gray-500">
              {summary.lines} item{summary.lines === 1 ? "" : "s"} · {summary.units} unit
              {summary.units === 1 ? "" : "s"}
              {summary.discount > 0 ? ` · ${formatPrice(Math.round(summary.discount))} off` : ""}
            </span>
            <span className="font-semibold text-gray-900">
              Total {formatPrice(Math.round(summary.net))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
