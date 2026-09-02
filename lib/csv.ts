/**
 * CSV üretimi.
 *
 * Formül enjeksiyonuna dikkat: bir hücre `=`, `+`, `-` veya `@` ile
 * başlıyorsa Excel onu formül olarak çalıştırır. Müşteri adı gibi kullanıcı
 * verisi doğrudan hücreye gittiği için başına tek tırnak koyup etkisizleştiriyoruz.
 */
const RISKY_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (RISKY_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // BOM: Excel'in UTF-8'i doğru okuması için.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "Cache-Control": "no-store",
    },
  });
}
