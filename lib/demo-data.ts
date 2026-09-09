/**
 * Tanıtım verisi.
 *
 * Yeni kayıt bomboş bir panele düşüyordu: gelinlik butikçisi ürünü
 * değerlendiremiyor, satış demosunda gösterilecek ekran olmuyordu. Buradaki
 * kayıtlar gerçek kayıtlarla aynı tablolara yazılır ama `metadata.demo` ile
 * işaretlenir — silme yolu yalnız bu işarete bakar, kullanıcının kendi
 * kaydına asla dokunmaz.
 *
 * Bu dosya saf: tarih dışında girdi almaz, veritabanı bilmez.
 */

export const DEMO_MARK = { demo: true } as const;

export type DemoCustomer = {
  name: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  metadata: typeof DEMO_MARK;
};

export type DemoProduct = {
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock_quantity: number;
  description: string;
  metadata: typeof DEMO_MARK;
};

export type DemoOrder = {
  ref_no: string;
  customerName: string;
  order_type: string;
  status: string;
  order_date: string;
  delivery_date: string;
  sales_person: string;
  list_total: number;
  discounted_total: number;
  deposit_amount: number;
  remaining_balance: number;
  notes: string;
  metadata: typeof DEMO_MARK;
};

export type DemoOrderLine = {
  orderRef: string;
  productSku: string;
  name: string;
  kind: string;
  quantity: number;
  unit_price: number;
};

export type DemoAppointment = {
  customerName: string;
  title: string;
  description: string;
  appointment_date: Date;
  status: string;
};

const DAY = 86400000;
const money = (n: number) => Number(n.toFixed(2));
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** Günün belirli bir saatine sabitlenmiş tarih — randevular saat başı görünsün. */
function at(base: Date, dayOffset: number, hour: number) {
  const d = new Date(base.getTime() + dayOffset * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

export function buildDemoData(now: Date) {
  const customers: DemoCustomer[] = [
    { name: "Ava Bennett", email: "ava.bennett@example.com", phone: "+1 212 555 0111", status: "ordered", notes: "Ceremony in June. Loves clean A-line silhouettes.", metadata: DEMO_MARK },
    { name: "Sofia Ramirez", email: "sofia.ramirez@example.com", phone: "+1 212 555 0142", status: "ordered", notes: "Bringing her mother to the second fitting.", metadata: DEMO_MARK },
    { name: "Chloe Turner", email: "chloe.turner@example.com", phone: "+1 212 555 0173", status: "appointment", notes: "Booked a first try-on. Budget around $2,000.", metadata: DEMO_MARK },
    { name: "Maya Okafor", email: "maya.okafor@example.com", phone: "+1 212 555 0194", status: "new", notes: "Walked in from the website booking page.", metadata: DEMO_MARK },
    { name: "Elena Rossi", email: "elena.rossi@example.com", phone: "+1 212 555 0128", status: "ordered", notes: "Renting for a destination wedding.", metadata: DEMO_MARK },
    { name: "Hannah Cole", email: "hannah.cole@example.com", phone: "+1 212 555 0165", status: "delivered", notes: "Picked up in August. Sent a thank-you note.", metadata: DEMO_MARK },
  ];

  const products: DemoProduct[] = [
    { name: "Aurelia A-Line Gown", sku: "GWN-101", category: "Gown", price: 2400, cost: 1150, stock_quantity: 3, description: "Ivory crepe A-line with a chapel train.", metadata: DEMO_MARK },
    { name: "Vera Mermaid Gown", sku: "GWN-102", category: "Gown", price: 3200, cost: 1600, stock_quantity: 2, description: "Beaded mermaid silhouette, off-shoulder.", metadata: DEMO_MARK },
    { name: "Lumière Ball Gown", sku: "GWN-103", category: "Gown", price: 4100, cost: 2050, stock_quantity: 1, description: "Full tulle skirt with hand-set crystals.", metadata: DEMO_MARK },
    { name: "Cathedral Veil", sku: "ACC-201", category: "Accessory", price: 380, cost: 120, stock_quantity: 8, description: "Two-tier cathedral length veil.", metadata: DEMO_MARK },
    { name: "Pearl Hair Comb", sku: "ACC-202", category: "Accessory", price: 145, cost: 45, stock_quantity: 12, description: "Freshwater pearls on gold plating.", metadata: DEMO_MARK },
    { name: "Silk Bridal Robe", sku: "ACC-203", category: "Accessory", price: 190, cost: 65, stock_quantity: 6, description: "Getting-ready robe, blush silk.", metadata: DEMO_MARK },
  ];

  // Kalemler toplamı belirler; sipariş toplamı bunlardan okunur (ürünün tek
  // para kaynağı `discounted_total` değişmezi burada da korunur).
  const orderLines: DemoOrderLine[] = [
    { orderRef: "SO-1001", productSku: "GWN-101", name: "Aurelia A-Line Gown", kind: "gown", quantity: 1, unit_price: 2400 },
    { orderRef: "SO-1001", productSku: "ACC-201", name: "Cathedral Veil", kind: "accessory", quantity: 1, unit_price: 340 },
    { orderRef: "SO-1002", productSku: "GWN-102", name: "Vera Mermaid Gown", kind: "gown", quantity: 1, unit_price: 3050 },
    { orderRef: "SO-1003", productSku: "GWN-103", name: "Lumière Ball Gown", kind: "gown", quantity: 1, unit_price: 4100 },
    { orderRef: "SO-1003", productSku: "ACC-202", name: "Pearl Hair Comb", kind: "accessory", quantity: 1, unit_price: 145 },
    { orderRef: "SO-1004", productSku: "ACC-203", name: "Silk Bridal Robe", kind: "accessory", quantity: 2, unit_price: 190 },
  ];

  const orderSeeds: {
    ref_no: string;
    customerName: string;
    status: string;
    placedDaysAgo: number;
    deliveryInDays: number;
    listTotal: number;
    depositRatio: number;
    salesPerson: string;
    notes: string;
  }[] = [
    { ref_no: "SO-1001", customerName: "Ava Bennett", status: "confirmed", placedDaysAgo: 21, deliveryInDays: 45, listTotal: 2780, depositRatio: 0.4, salesPerson: "Nina", notes: "Hem and bustle included." },
    { ref_no: "SO-1002", customerName: "Sofia Ramirez", status: "in_production", placedDaysAgo: 12, deliveryInDays: 60, listTotal: 3200, depositRatio: 0.5, salesPerson: "Nina", notes: "Ordered one size up for alterations." },
    { ref_no: "SO-1003", customerName: "Elena Rossi", status: "confirmed", placedDaysAgo: 5, deliveryInDays: 30, listTotal: 4245, depositRatio: 0.3, salesPerson: "Dana", notes: "Destination wedding — needs early pickup." },
    { ref_no: "SO-1004", customerName: "Hannah Cole", status: "delivered", placedDaysAgo: 40, deliveryInDays: -6, listTotal: 380, depositRatio: 1, salesPerson: "Dana", notes: "Paid in full at pickup." },
  ];

  const orders: DemoOrder[] = orderSeeds.map((seed) => {
    const lines = orderLines.filter((l) => l.orderRef === seed.ref_no);
    const discounted = money(lines.reduce((t, l) => t + l.unit_price * l.quantity, 0));
    const deposit = money(discounted * seed.depositRatio);
    return {
      ref_no: seed.ref_no,
      customerName: seed.customerName,
      order_type: "sale",
      status: seed.status,
      order_date: dateOnly(new Date(now.getTime() - seed.placedDaysAgo * DAY)),
      delivery_date: dateOnly(new Date(now.getTime() + seed.deliveryInDays * DAY)),
      sales_person: seed.salesPerson,
      list_total: Math.max(seed.listTotal, discounted),
      discounted_total: discounted,
      deposit_amount: deposit,
      remaining_balance: money(discounted - deposit),
      notes: seed.notes,
      metadata: DEMO_MARK,
    };
  });

  const appointments: DemoAppointment[] = [
    { customerName: "Chloe Turner", title: "First try-on", description: "Bringing two bridesmaids.", appointment_date: at(now, 1, 11), status: "confirmed" },
    { customerName: "Ava Bennett", title: "Second fitting", description: "Check hem length after shoes arrive.", appointment_date: at(now, 3, 14), status: "confirmed" },
    { customerName: "Maya Okafor", title: "Consultation", description: "Booked online, first visit.", appointment_date: at(now, 5, 10), status: "pending" },
    { customerName: "Sofia Ramirez", title: "Alterations fitting", description: "Mother of the bride joining.", appointment_date: at(now, 9, 16), status: "pending" },
  ];

  return { customers, products, orders, orderLines, appointments };
}
