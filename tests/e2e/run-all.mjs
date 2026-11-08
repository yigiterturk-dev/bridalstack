// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Uçtan uca testleri sırayla koşturur ve tek bir özet basar.              ║
// ║                                                                          ║
// ║  Önkoşullar (README'ye bakın):                                           ║
// ║    • Ayakta bir dev sunucusu:  PORT=3100 npm run dev                     ║
// ║    • .env.local içinde RATE_LIMIT_DISABLED=1, EMAIL_DRY_RUN=1,           ║
// ║      CRON_SECRET=<bir şey>                                               ║
// ║    • İzole DB aşamaları (14-20) için boş bir veritabanı. Varsayılan:     ║
// ║      bridalstack_e2e_iso. E2E_ISO_URL ile değiştirilebilir.              ║
// ║                                                                          ║
// ║  Kullanım:  node tests/e2e/run-all.mjs                                   ║
// ║             node tests/e2e/run-all.mjs stage12 stage21-ai-gate           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const HTTP_STAGES = [
  "stage1", "stage2", "stage3", "stage4", "stage5", "stage6", "stage7",
  "stage8", "stage9", "stage10", "stage11", "stage12", "stage13",
  "stage21-ai-gate", "stage22-booking-concurrency",
];

const DB_STAGES = [
  "stage14-db", "stage15-purchasing", "stage16-order-lines",
  "stage17-commission-kinds", "stage18-cash-sessions",
  "stage19-calendar-suppliers", "stage20-trial-demo", "stage23-account",
];

const args = process.argv.slice(2);
const only = args.length ? new Set(args) : null;
const isoUrl =
  process.env.E2E_ISO_URL ?? "postgresql://yigiterturk@localhost:5432/bridalstack_e2e_iso";

function run(name) {
  const isDb = DB_STAGES.includes(name);
  const env = { ...process.env };
  if (isDb) {
    env.DATABASE_URL = isoUrl;
    env.DIRECT_URL = isoUrl;
  }
  const result = spawnSync(process.execPath, [join(HERE, `${name}.mjs`)], {
    cwd: join(HERE, "..", ".."),
    env,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const summary =
    output.match(/(Geçen:\s*\d+\s+Kalan:\s*\d+|\d+ geçti,\s*\d+ kaldı)/g)?.pop() ?? "";
  const failed = result.status !== 0;
  return { name, failed, output, summary: summary || (failed ? "ÇALIŞTIRILAMADI" : "tamam") };
}

const stages = [...HTTP_STAGES, ...DB_STAGES].filter((s) => !only || only.has(s));
const results = [];
for (const stage of stages) {
  process.stdout.write(`▶ ${stage} ... `);
  const outcome = run(stage);
  console.log(outcome.failed ? `KIRMIZI (${outcome.summary})` : `yeşil (${outcome.summary})`);
  if (outcome.failed) process.stdout.write(outcome.output);
  results.push(outcome);
}

const red = results.filter((r) => r.failed);
console.log(`\n${results.length - red.length}/${results.length} aşama yeşil.`);
if (red.length) {
  console.log("Kırmızı: " + red.map((r) => r.name).join(", "));
}
process.exit(red.length ? 1 : 0);
