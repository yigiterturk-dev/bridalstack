/**
 * Rehber yazıları.
 *
 * Metin burada, sayfada değil: aynı yazı hem listede hem detayda hem
 * sitemap'te kullanılıyor ve testler uzunluk/benzersizlik kurallarını buradan
 * denetliyor. Şablon doldurulmuş sayfa aranmaz — her yazı bu ürünün gerçekten
 * çözdüğü bir işi anlatır.
 */

export type GuideSection = { heading: string; body: string[] };

export type Guide = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readMinutes: number;
  summary: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "track-a-wedding-dress-from-order-to-pickup",
    title: "How to track a wedding dress from order to pickup",
    description:
      "A practical system for knowing where every gown is — on the rail, at the seamstress, or with the bride — without a spreadsheet.",
    publishedAt: "2026-09-09",
    readMinutes: 6,
    summary:
      "Most bridal shops lose track of gowns at the handoffs, not in the sale. Here is the handful of states worth writing down and the single rule that keeps stock honest.",
    sections: [
      {
        heading: "The problem is handoffs, not sales",
        body: [
          "Almost every bridal boutique can tell you what it sold last month. Far fewer can tell you, without walking to the back room, where a specific gown is standing right now. The gap shows up at the handoffs: the dress leaves the rail for a fitting, goes to the seamstress for alterations, comes back, goes out for cleaning, and finally leaves with the bride. Each of those moves is a moment where a piece of paper gets written and then not read again.",
          "The cost is small every time and large in aggregate. A bride calls to ask whether her dress is back from alterations and nobody can answer without three phone calls. A gown is sold from the floor while it is physically at the cleaner. A sample is counted twice at inventory because it was out of the shop on counting day.",
        ],
      },
      {
        heading: "Write down states, not locations",
        body: [
          "The instinct is to record where a dress physically is: back room, rail three, seamstress. That breaks the moment someone moves it without telling you. What holds up better is recording what is happening to the dress: reserved for a bride, out for a fitting, in alterations, in cleaning, delivered.",
          "States are more durable than shelves because they change only when a person does something deliberate — hands a dress over, finishes a job, takes payment. A shelf number changes whenever anyone tidies up.",
          "Keep the list short. Five or six states cover almost every boutique. Anything longer stops being filled in by the third week, and a field nobody fills in is worse than no field at all: it looks like data.",
        ],
      },
      {
        heading: "One rule keeps stock honest",
        body: [
          "The single most useful rule we have found is this: a gown comes off the shelf only when it leaves with the bride, and it goes back on the shelf exactly once when it returns.",
          "That sounds obvious until you count the ways it gets broken. A reservation is not a sale, so a reserved gown should still be on the shelf — the calendar blocks the date, not the item. A dress that goes to the seamstress has not left the business, so it stays on your books. A dress that comes back dirty does not go on the rail; it goes into cleaning and returns to the rail from there. Skip that step and you will eventually hand a bride a gown that someone else wore.",
          "If you only apply one thing from this article, apply that rule. It makes every stock figure you look at afterwards mean something.",
        ],
      },
      {
        heading: "Make the record readable by one person",
        body: [
          "The point of tracking is not completeness — it is that a single staff member, alone in the shop on a Tuesday afternoon, can answer a bride's question in under a minute. Test your system that way. Ask someone who was not there when the order was taken to find out whether the dress is ready. If they cannot do it from one screen, the system is not finished, no matter how many fields it has.",
        ],
      },
    ],
  },
  {
    slug: "bridal-deposits-and-payment-schedules",
    title: "Bridal deposits and payment schedules that hold up",
    description:
      "How to structure a deposit, when to collect the balance, and which numbers to record so a bridal order never goes out unpaid.",
    publishedAt: "2026-09-09",
    readMinutes: 6,
    summary:
      "Bridal orders are paid in pieces over months. The schedule is easy; keeping the record straight when a bride adds a veil in week nine is the hard part.",
    sections: [
      {
        heading: "Why bridal payments are their own problem",
        body: [
          "A bridal sale is not a retail transaction. Money arrives in pieces over six to nine months, the order changes in the middle, and the item leaves the shop long after the first payment. By the time the dress goes out, the person handing it over is often not the person who wrote the order.",
          "That is why the balance at pickup is the number that matters most, and why it is the number that most often turns out to be wrong.",
        ],
      },
      {
        heading: "Pick a deposit that covers your exposure",
        body: [
          "The deposit exists to cover what you cannot recover if the bride disappears. If you place a special order with a designer, your exposure is the wholesale cost plus any non-refundable fee — so the deposit should at least cover that, not a round percentage that feels friendly.",
          "For an off-the-rail gown that you could sell again, the exposure is smaller and the deposit can be too. Charging every bride the same fifty percent is easy to explain but it either over-charges the low-risk sale or under-covers the special order.",
          "Whatever you choose, write the reason down once and apply it consistently. A deposit policy that changes with the mood of the conversation is the one that gets argued about at pickup.",
        ],
      },
      {
        heading: "Record the total in exactly one place",
        body: [
          "The most common bookkeeping failure in a bridal shop is two totals. Someone writes the agreed price on the order, then later adds a veil and a hair comb as line items, and now the order says one number while the items add up to another. At pickup, whichever number the staff member happens to look at is the one the bride is charged.",
          "Fix it structurally rather than by carefulness: let the line items produce the total, and stop offering a place to type a separate figure. If the order has items, the sum is the price. If you inherited an older order that was written as a single agreed amount, leave it alone — but do not let a single order carry both.",
          "The balance then follows from one subtraction: total minus what has actually been received. Not what was promised, not what was invoiced — what came in.",
        ],
      },
      {
        heading: "Collect the balance before the dress moves",
        body: [
          "The balance is due before the gown leaves, not at the door. In practice that means the schedule should have its last instalment a week or two before the pickup appointment, so a failed card is a phone call rather than a scene in the shop with a bride and her mother present.",
          "Alterations are the exception worth planning for, because their price is not known when the order is written. Treat alteration fees as their own charge, due when the work is handed back, and keep them off the original balance. Mixing an unknown future amount into a fixed schedule is how a schedule stops being trusted.",
        ],
      },
    ],
  },
  {
    slug: "bridal-boutique-stock-counts",
    title: "Stock counts in a bridal boutique, done in an afternoon",
    description:
      "Counting gowns is not retail counting: samples travel, dresses sit at the seamstress, and cost changes with each delivery. Here is a method that survives that.",
    publishedAt: "2026-09-09",
    readMinutes: 5,
    summary:
      "A count that argues with reality gets abandoned. Freeze the expected figure, count what is physically there, and record the difference instead of erasing it.",
    sections: [
      {
        heading: "Counting is a measurement, not a correction",
        body: [
          "The purpose of a stock count is to learn the size of the gap between your records and the rail. Shops that treat the count as a chance to quietly fix the numbers lose exactly the information they were counting to get.",
          "So record three figures for every item: what the system expected, what you actually found, and the difference. The difference is the useful one. A shop with a consistent small shortage in veils has a different problem from a shop with one missing gown, and only the recorded differences tell you which you are.",
        ],
      },
      {
        heading: "Freeze the expected figure when you start",
        body: [
          "The subtle failure in counting is movement during the count. If the expected figure is recalculated as you go, a dress sold at four o'clock silently changes a shelf you counted at two, and the count no longer describes any single moment.",
          "Freeze the expected number the moment the count opens. Sales during the count are real and belong in the ledger, but they must not rewrite a count already taken. The same principle applies to a cash drawer: the expected amount at close is what was expected when you closed, not what a backdated entry says a week later.",
        ],
      },
      {
        heading: "Account for dresses that are not in the building",
        body: [
          "Bridal stock travels. Gowns sit at the seamstress, go out to trunk shows, wait at the cleaner. A count that ignores them shows a shortage every time and slowly teaches everyone to ignore the report.",
          "Before you start, list what is legitimately out and where. Those items are still yours; they are simply not countable on the rail today. Anything out that is not on that list is the actual finding of your count.",
        ],
      },
      {
        heading: "What a delivery should do to cost",
        body: [
          "When new stock arrives at a different price, resist writing the newest invoice price onto the product. That erases what the gowns already on the rail actually cost you and quietly distorts every margin figure afterwards.",
          "Blend it instead: the cost of what you already hold, plus the cost of what just arrived, divided by the new total quantity. And treat a missing unit cost as unknown rather than as zero — a delivery with no price on the paperwork should leave your cost untouched, not drag it toward nothing.",
          "Do that consistently for a season and your margin report becomes something you can price from, rather than a number you explain away.",
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
