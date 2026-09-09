import {
  FREE_PACK_IDS,
  PACKS,
  isPackSellable,
  type PackId,
} from "../config/modules.ts";

export type LineItem = { price: string; quantity: number };

export type CheckoutPlan =
  | { kind: "checkout"; lineItems: LineItem[]; packs: PackId[] }
  | { kind: "downgrade"; packs: PackId[] }
  | { kind: "misconfigured"; missing: PackId[] };

/**
 * Bir plan değişikliği isteğini üç sonuçtan birine çevirir.
 *
 * Buradaki asıl mesele, "kullanıcı ücretli paket istemiyor" ile "ücretli paketin
 * Stripe fiyatı tanımlı değil" durumlarını ayırmaktır. Eskiden ikisi de boş bir
 * satır listesine düşüyordu ve kod bunu iptal sayıp kiracıyı ücretsize
 * indiriyordu: fiyat env'i eksik olduğu için yükseltmeye çalışan kullanıcı,
 * "başarılı" mesajıyla birlikte sahip olduğu paketleri kaybediyordu.
 *
 * Ücretsiz paketler hiçbir yolda kaybolmaz — yeni kayıt onları aldığına göre
 * indirgeme de aynı tabana inmelidir, tek başına "base"e değil.
 */
export function resolveCheckoutPlan(
  requested: PackId[],
  priceIds: Record<string, string>
): CheckoutPlan {
  const paid = Array.from(new Set(requested)).filter(
    (p) => PACKS[p] && PACKS[p].monthlyPrice > 0 && isPackSellable(p)
  );

  if (paid.length === 0) {
    return { kind: "downgrade", packs: [...FREE_PACK_IDS] };
  }

  // Fail-closed: bir tanesinin bile fiyatı yoksa hiçbirini satmayız ve mevcut
  // plana dokunmayız. Yarım bir abonelik kurmak, eksik olanı sessizce düşürmek
  // demek olurdu.
  const missing = paid.filter((p) => !priceIds[p]);
  if (missing.length > 0) {
    return { kind: "misconfigured", missing };
  }

  return {
    kind: "checkout",
    lineItems: paid.map((p) => ({ price: priceIds[p], quantity: 1 })),
    packs: [...FREE_PACK_IDS, ...paid],
  };
}
