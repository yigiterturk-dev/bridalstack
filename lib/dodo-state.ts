import { FREE_PACK_IDS, type PackId } from "../config/modules.ts";

/**
 * Dodo abonelik durumunun SAF çekirdeği.
 *
 * Kiracının hangi paketlere eriştiği, ödeme sağlayıcısının webhook'larından
 * gelen abonelik kimliklerinden türetilir. Bu kararı route içine gömmek,
 * test edilemeyen ve iki yerde ayrışabilecek bir kural üretirdi.
 *
 * Her paket AYRI bir aboneliktir (Dodo multi-subscription cart). Bir paketin
 * iptali yalnız o paketi düşürür; diğerleri durur. `packs` alanı hiçbir zaman
 * doğrudan webhook'tan yazılmaz — abonelik kimliklerinden YENİDEN hesaplanır,
 * böylece eski bir iptal olayı yeni bir aboneliği yanlışlıkla silemez.
 */

export type PaidPackId = "sales" | "finance" | "inventory" | "pro";
export const PAID_PACK_IDS: PaidPackId[] = ["sales", "finance", "inventory", "pro"];

export type DodoState = {
  customerId: string | null;
  subscriptions: Partial<Record<PaidPackId, string>>;
};

export class DodoStateError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPaidPack(value: unknown): value is PaidPackId {
  return typeof value === "string" && (PAID_PACK_IDS as string[]).includes(value);
}

export function readDodoState(settings: Record<string, unknown> | null | undefined): DodoState {
  const root = isRecord(settings) && isRecord(settings.dodo) ? settings.dodo : {};
  const rawSubscriptions = isRecord(root.subscriptions) ? root.subscriptions : {};
  const subscriptions: Partial<Record<PaidPackId, string>> = {};
  for (const pack of PAID_PACK_IDS) {
    const id = rawSubscriptions[pack];
    if (typeof id === "string" && id.trim()) subscriptions[pack] = id.trim();
  }
  return {
    customerId: typeof root.customer_id === "string" && root.customer_id.trim() ? root.customer_id.trim() : null,
    subscriptions,
  };
}

function writeDodoState(settings: Record<string, unknown> | null | undefined, state: DodoState) {
  const current = isRecord(settings) ? settings : {};
  const previousDodo = isRecord(current.dodo) ? current.dodo : {};
  return {
    ...current,
    dodo: {
      ...previousDodo,
      customer_id: state.customerId,
      subscriptions: state.subscriptions,
    },
  };
}

export function paidPacksFromState(state: DodoState): PaidPackId[] {
  return PAID_PACK_IDS.filter((pack) => Boolean(state.subscriptions[pack]));
}

export function packsFromState(state: DodoState): PackId[] {
  return [...FREE_PACK_IDS, ...paidPacksFromState(state)];
}

export function planFromPacks(packs: PackId[]): "free" | "starter" {
  return packs.some((pack) => isPaidPack(pack)) ? "starter" : "free";
}

export type SubscriptionChange = {
  settings: Record<string, unknown>;
  state: DodoState;
  packs: PackId[];
  plan: "free" | "starter";
  converted: boolean;
  removedPack: PaidPackId | null;
};

/** `subscription.active` / `subscription.renewed`: paketi aboneliğe bağlar. */
export function applyActiveSubscription(
  settings: Record<string, unknown> | null | undefined,
  input: { pack: PaidPackId; subscriptionId: string; customerId?: string | null },
): SubscriptionChange {
  if (!isPaidPack(input.pack)) throw new DodoStateError("Unknown paid pack.");
  if (!input.subscriptionId.trim()) throw new DodoStateError("Subscription id is required.");

  const previous = readDodoState(settings);
  const wasPaid = paidPacksFromState(previous).length > 0;
  const state: DodoState = {
    customerId: input.customerId?.trim() || previous.customerId,
    subscriptions: { ...previous.subscriptions, [input.pack]: input.subscriptionId.trim() },
  };
  const packs = packsFromState(state);
  const paidNow = paidPacksFromState(state).length > 0;
  return {
    settings: writeDodoState(settings, state),
    state,
    packs,
    plan: planFromPacks(packs),
    converted: !wasPaid && paidNow,
    removedPack: null,
  };
}

/**
 * İptal/expire: yalnız KİMLİĞİ eşleşen aboneliği düşürür.
 *
 * Aynı paket için yeni bir abonelik açıldıysa eski aboneliğin geç gelen iptal
 * olayı yenisini silmemeli. Eşleşme yoksa hiçbir şey değişmez.
 */
export function removeSubscription(
  settings: Record<string, unknown> | null | undefined,
  subscriptionId: string,
): SubscriptionChange {
  const previous = readDodoState(settings);
  const removedPack = PAID_PACK_IDS.find((pack) => previous.subscriptions[pack] === subscriptionId) ?? null;
  if (!removedPack) {
    const packs = packsFromState(previous);
    return {
      settings: writeDodoState(settings, previous),
      state: previous,
      packs,
      plan: planFromPacks(packs),
      converted: false,
      removedPack: null,
    };
  }

  const subscriptions = { ...previous.subscriptions };
  delete subscriptions[removedPack];
  const state: DodoState = { customerId: previous.customerId, subscriptions };
  const packs = packsFromState(state);
  return {
    settings: writeDodoState(settings, state),
    state,
    packs,
    plan: planFromPacks(packs),
    converted: false,
    removedPack,
  };
}
