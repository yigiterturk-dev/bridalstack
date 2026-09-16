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
  {
    slug: "bridal-rental-tracking",
    title: "How to run a bridal rental line without losing a gown",
    description:
      "Double bookings, late returns and deposits counted as profit are the three ways a rental line leaks. Here is how to close each one.",
    publishedAt: "2026-09-17",
    readMinutes: 7,
    summary:
      "Renting gowns is a different business from selling them: the same dress earns money many times, and every one of those times is a chance to lose it. Four rules keep a rental rail honest.",
    sections: [
      {
        heading: "A rental is a calendar problem before it is a stock problem",
        body: [
          "When you sell a gown, it leaves once and the question is closed. When you rent it, the same gown has to be in two places in a season and in none of them at the same time. That makes the first failure mode a diary failure, not a warehouse failure: two brides promised the same dress on overlapping dates.",
          "The fix is to treat dates as inclusive on both ends. A dress out from the 10th to the 12th is not available from the 12th to the 14th, because on the 12th two brides are both expecting it. Half a day of laundry and inspection is not slack you can lend out. Most double bookings we have seen came from a booking sheet where the return date and the next collection date were allowed to touch.",
          "Block the dates at the moment you take the reservation, not when the bride pays the balance. The reservation is the promise; the payment only settles it.",
        ],
      },
      {
        heading: "Reserved is not gone",
        body: [
          "The second leak is quieter. A shop that blocks the calendar correctly often also removes the gown from stock the moment it is reserved, weeks before anyone collects it. Now the stock figure answers a question nobody asked. The dress is still hanging on the rail, still needs counting, still needs insuring, and is still available for a fitting.",
          "Keep the two ideas apart. The calendar says who has claimed the dress on which dates. Stock says whether the dress is physically in your possession. A reservation touches the first and not the second. The gown only comes off the shelf when it actually walks out of the door with the bride, and it goes back on exactly once when it comes home.",
          "A cancelled reservation should also release the dates immediately, and a returned rental should stop blocking the calendar the day it is back. If cancelled and returned bookings keep holding dates, your availability shrinks a little every month until the rail looks fully booked while half of it hangs untouched.",
        ],
      },
      {
        heading: "The deposit is not income",
        body: [
          "Rental money arrives in two shapes that behave completely differently. The rental fee is yours: it is earned when the gown goes out. The security deposit is not yours at all — you are holding someone else's money against damage, and in most cases you will hand it straight back.",
          "Mixing them makes a good month look great and a bad month look survivable. Worse, it makes refunds feel like losses, which is exactly when a shop starts inventing reasons to keep part of a deposit and loses a customer who would have come back with three friends.",
          "Record the fee as revenue on the day the dress leaves. Record the deposit as money held, and clear it on return. If you keep part of it for real damage, that part becomes revenue on the day you decide, with a note about what happened — not a silent adjustment months later that nobody can explain to the bride who calls about it.",
        ],
      },
      {
        heading: "Late returns cost more than the late fee",
        body: [
          "A gown that comes back three days late is not a three-day problem. It is a missed cleaning window, a rushed inspection, and a next bride who collects a dress nobody had time to check. The financial penalty you charge is almost never the real cost.",
          "So make lateness visible before it happens rather than after. A list of what is due back this week, sorted by how soon, read once every morning, prevents more losses than any fee schedule. One phone call the day before a return is due is worth more than an argument the week after.",
          "And when a rented gown does come back, do not put it straight on the rail. Send it to cleaning and let it return to the rail from there. It is the same rule that governs sold gowns after a fitting, and for the same reason: the fastest way to destroy a rental business is to hand one bride a dress that still carries the last one's evening.",
        ],
      },
    ],
  },
  {
    slug: "tracking-alterations-in-a-bridal-shop",
    title: "How to track alterations without promising the same week twice",
    description:
      "Alterations are where bridal shops overpromise. A short status list, one promised date per job and one charge rule fix most of it.",
    publishedAt: "2026-09-17",
    readMinutes: 6,
    summary:
      "Fittings are booked months ahead but alterations are agreed in a corridor conversation. Writing down four things at that moment is what keeps the seamstress's week from being sold twice.",
    sections: [
      {
        heading: "The job is agreed in the worst possible place",
        body: [
          "A sale gets an order form. A fitting gets a calendar slot. Alterations get agreed standing next to a mirror, with a bride in a gown and pins in someone's hand, and the whole record is a sentence: we'll take the hem up and add a bustle, ready in two weeks.",
          "Everything that goes wrong later is already contained in that sentence. Nobody wrote down which gown, who agreed the price, or what two weeks means as a date. The seamstress finds out on the day she opens her list, and by then three other brides have been told the same fortnight.",
          "You do not need a form with twenty fields. You need four things captured before the bride has her coat on: which dress, what work, what it costs, and the date you promised.",
        ],
      },
      {
        heading: "Keep the status list short enough to be true",
        body: [
          "Four working states cover nearly every alteration: requested, on the table, ready for pickup, delivered. Add cancelled for the jobs that evaporate and stop there.",
          "The temptation is to add more — awaiting fabric, first fitting done, second fitting booked, pressed. Every extra state is a state somebody will forget to move a job out of, and a job parked in a stage nobody updates looks handled while it rots. Short lists get filled in; long lists get abandoned, and an abandoned list is more dangerous than no list because people trust it.",
          "Make the transitions one-directional in practice. A job that is ready can be delivered or cancelled; it does not quietly slide back to requested because someone changed their mind about the hem. If the bride asks for more work, that is a new job on the same dress, with its own price and its own promised date. That is not bureaucracy — it is the only way the second piece of work gets paid for.",
        ],
      },
      {
        heading: "One promised date, and read the overdue list first",
        body: [
          "Every job carries exactly one promised date: the date you told the bride. Not the date the seamstress hopes for, not the wedding date. Those are useful but they are not the promise, and the promise is what you will be judged on.",
          "Then sort the open work by that date and read the overdue ones before anything else each morning. This is the entire discipline. A shop that looks at its late jobs daily is calling brides before they call in; a shop that looks weekly is apologising.",
          "Delivered and cancelled jobs should drop off that list entirely. A working list that shows finished work is a list people stop reading, and the day they stop reading it is the day a dress misses a wedding.",
        ],
      },
      {
        heading: "Charge on delivery, not on agreement",
        body: [
          "The cleanest money rule for alterations is that the fee is earned when the gown is handed back, not when the work is agreed and not when it comes off the table.",
          "It matches what the bride believes — she is paying for a finished dress — and it keeps your books honest about work in progress. Charging on agreement books income for a hem that has not been sewn; charging when the work is finished books income for a dress still hanging in your back room. Delivery is the one moment both sides agree the job is done.",
          "Whatever rule you pick, apply it once per job. The most common bookkeeping mess in a bridal shop is not a missing charge, it is the same alteration charged twice because two people both tried to be helpful on the same afternoon. Tie the charge to the job moving into delivered, and the second attempt has nothing left to do.",
        ],
      },
    ],
  },
  {
    slug: "bridal-consultant-commission",
    title: "How to pay bridal consultants commission without arguments",
    description:
      "Commission fights come from three unwritten answers: discounts, accessories, and cancelled orders. Decide those once and pay from one figure.",
    publishedAt: "2026-09-17",
    readMinutes: 7,
    summary:
      "Most bridal commission schemes are one line long and generate arguments for years. The disputes are always about the same three edges, and each has an answer you can write down in a sentence.",
    sections: [
      {
        heading: "Gross or net decides everything downstream",
        body: [
          "Ten percent of the sale is not a commission scheme. It is the start of one, because it does not say what the sale is.",
          "If a gown lists at 2,000 and the consultant agrees 1,600 to close it, commission on the list price pays her for money the shop never received — and quietly makes discounting free for the person doing it. Commission on what the customer actually pays makes the consultant feel the discount she gave, which is usually what you want, because she is the only person in the room who can protect the price.",
          "Pay on the net figure after discount, and say so in writing on the day someone is hired. The shop that leaves this unstated is not avoiding an argument, it is scheduling one for the first big discount of the season.",
        ],
      },
      {
        heading: "Not every line deserves the same rate",
        body: [
          "The second argument is about what counts. A veil, a pair of shoes, an alteration fee and a rental all arrive on the same order, and they are nothing like each other in effort or margin.",
          "It is entirely reasonable to pay one rate on gowns, a different one on accessories, and nothing at all on alterations you subcontract to a seamstress you also pay. What is not reasonable is deciding that after the order is written. Set a rate per kind of line, publish it, and let anyone check their own order against it.",
          "The same goes for flat bonuses and thresholds. If there is a bonus for orders over a certain size, say whether that size is measured before or after discount — it is the same gross-versus-net question wearing a different hat, and it produces the same fight.",
        ],
      },
      {
        heading: "Say when it is earned, and what happens when it unwinds",
        body: [
          "Commission that is calculated when an order is written and paid before the money arrives turns your consultants into your creditors. Commission that waits until the final balance clears can mean a six-month gap between the sale and the reward, which kills the incentive it was designed to create.",
          "Most bridal shops land somewhere sensible: commission is earned when the order is written, and it becomes payable when the order is complete. Pick your point and hold it.",
          "Then answer the question nobody wants to answer: what happens when a bride cancels, or when half an order is refunded. If commission has already been paid, it comes off the next payout — and that has to be understood before it happens, not explained afterwards. A cancelled order that silently keeps its commission is a hole that grows every season, and the first person to notice it will be the consultant who did not cancel anything.",
        ],
      },
      {
        heading: "One figure, visible to both sides",
        body: [
          "The practical test of a commission scheme is not whether it is generous. It is whether the consultant and the owner, working separately, arrive at the same number.",
          "That only happens when the rules and the orders live in the same place. A rate sheet on a noticeboard and sales in a spreadsheet will diverge within a month, because someone will apply a rule from memory. When the rule is attached to the order, the payout is a readout rather than a negotiation, and the monthly commission conversation stops being a conversation at all.",
          "Keep the history too. When you change a rate, change it going forward and leave last season's orders calculated the way they were sold. Retroactive rates are how a shop loses the consultant it spent two years training.",
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string): Guide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
