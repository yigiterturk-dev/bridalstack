"use client";

import { useState } from "react";
import Link from "next/link";
import { createProduct, updateProduct } from "@/lib/actions";
import BarcodeScanner from "@/components/barcode-scanner";
import ImageUpload from "@/components/image-upload";
import SelectField from "@/components/select-field";
import SubmitButton from "@/components/submit-button";
import { CURRENCY_SYMBOL } from "@/config/modules";

const CATEGORIES = ["Bridal Gown", "Veil", "Tiara", "Accessories", "Bridesmaid", "Evening", "Other"];

export type ProductValues = {
  id: string; name: string; sku: string | null; category: string | null; supplier_id: string | null;
  barcode: string | null; price: number; cost: number; stock_quantity: number; description: string | null; image_url: string | null;
};

const FIELD = "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
const LABEL = "mb-1.5 block text-sm font-medium text-[var(--ink)]";

/** Ürün ekleme ve düzenleme aynı form: `product` varsa düzenler. */
export default function ProductForm({
  uploadsOn,
  suppliers,
  product,
}: {
  uploadsOn: boolean;
  suppliers: { id: string; name: string }[];
  product?: ProductValues;
}) {
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [showScanner, setShowScanner] = useState(false);

  function handleScanSuccess(code: string) {
    setBarcode(code);
    setShowScanner(false);
  }

  const categories = product?.category && !CATEGORIES.includes(product.category) ? [product.category, ...CATEGORIES] : CATEGORIES;

  return (
    <div className="max-w-xl">
      <form action={product ? updateProduct : createProduct} className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-white p-5">
        {product && <input type="hidden" name="id" value={product.id} />}
        <ImageUpload
          name="image_url"
          scope="product"
          label="Product photo"
          disabled={!uploadsOn}
          disabledHint="Photo uploads are not switched on yet."
          defaultValue={product?.image_url ? [product.image_url] : []}
        />

        <div>
          <label htmlFor="product-name" className={LABEL}>Name</label>
          <input id="product-name" name="name" required defaultValue={product?.name} className={FIELD} placeholder="Aurelia A-line gown" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="category-select" className={LABEL}>Category</label>
            <SelectField
              name="category"
              placeholder="Choose"
              searchable={false}
              defaultValue={product?.category ?? ""}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <label htmlFor="sku" className={LABEL}>Your code <span className="font-normal text-[var(--muted)]">(optional)</span></label>
            <input id="sku" name="sku" defaultValue={product?.sku ?? ""} className={FIELD} placeholder="BG-001" />
          </div>
        </div>

        <div>
          <label htmlFor="supplier_id-select" className={LABEL}>Supplier</label>
          {suppliers.length > 0 ? (
            <SelectField name="supplier_id" placeholder="Who do you order this from?" defaultValue={product?.supplier_id ?? ""} options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          ) : (
            <p className="py-1 text-sm text-[var(--muted)]">
              No suppliers yet. <Link href="/suppliers" className="underline">Add one</Link> to track how long orders take.
            </p>
          )}
        </div>

        {/* Barcode Scanner Input */}
        <div>
          <label htmlFor="barcode" className={LABEL}>Barcode <span className="font-normal text-[var(--muted)]">(optional)</span></label>
          <div className="relative">
            <input
              id="barcode"
              name="barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className={`${FIELD} pr-12`}
              placeholder="We make one if you leave it empty"
            />
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              aria-label="Scan barcode with camera"
              className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-stone-400 transition-colors hover:text-[var(--ink)]"
              title="Scan barcode with camera"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">barcode_scanner</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="product-price" className={LABEL}>Price ({CURRENCY_SYMBOL})</label>
            <input id="product-price" name="price" type="number" step="0.01" min="0" defaultValue={product?.price ?? ""} className={FIELD} placeholder="0" />
          </div>
          <div>
            <label htmlFor="product-cost" className={LABEL}>You paid ({CURRENCY_SYMBOL})</label>
            <input id="product-cost" name="cost" type="number" step="0.01" min="0" defaultValue={product?.cost ?? ""} className={FIELD} placeholder="0" />
          </div>
          <div>
            <label htmlFor="stock-quantity" className={LABEL}>In stock</label>
            <input id="stock-quantity" name="stock_quantity" type="number" defaultValue={product?.stock_quantity ?? 1} min="0" className={FIELD} />
          </div>
        </div>

        <div>
          <label htmlFor="product-description" className={LABEL}>Notes <span className="font-normal text-[var(--muted)]">(optional)</span></label>
          <textarea id="product-description" name="description" rows={2} defaultValue={product?.description ?? ""} className={`${FIELD} resize-y`} placeholder="Fabric, sizes, anything you want to remember" />
        </div>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Saving…" className="rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60">{product ? "Save changes" : "Add it"}</SubmitButton>
          <Link href="/products" className="rounded-xl border border-[var(--line)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-stone-300">Cancel</Link>
        </div>
      </form>

      {showScanner && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
