import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Prisma migration'ları isim sırasına göre uygulanır. Yerel saat, depodaki
 * mevcut migration'lardan geriyse `prisma migrate dev` daha küçük bir zaman
 * damgası üretir ve yeni migration `init`'ten ÖNCE sıralanır. Bu durumda
 * mevcut veritabanında sorun görünmez ama sıfırdan bir dağıtım çöker:
 * henüz var olmayan tablolara yabancı anahtar eklenmeye çalışılır.
 *
 * Bu test o durumu tespit eder. Kırılırsa yapılacak: yeni migration klasörünü
 * en sona sıralanacak bir zaman damgasıyla yeniden adlandır ve
 * _prisma_migrations tablosundaki migration_name kaydını da güncelle.
 */
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

test("migration klasörleri zaman damgasına göre artan sırada", () => {
  const names = migrationNames();
  const sorted = [...names].sort();
  assert.deepEqual(names.slice().sort(), sorted);

  const timestamps = sorted.map((n) => n.split("_")[0]);
  for (const ts of timestamps) {
    assert.match(ts, /^\d{14}$/, `geçersiz zaman damgası: ${ts}`);
  }
});

test("init migration'ı her zaman ilk sırada", () => {
  const sorted = migrationNames().sort();
  assert.ok(sorted.length > 0, "hiç migration yok");
  assert.ok(
    sorted[0].endsWith("_init"),
    `ilk migration 'init' olmalı ama '${sorted[0]}' bulundu — yeni bir migration ` +
      `yanlışlıkla init'ten önce sıralanmış, sıfırdan dağıtım çöker`
  );
});
