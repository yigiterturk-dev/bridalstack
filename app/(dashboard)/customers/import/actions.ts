"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";

export type ImportRow = {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  _error?: string;
};

export type ImportResult = {
  ok: boolean;
  error?: string;
  inserted?: number;
  skipped?: number;
  errors?: { line: number; reason: string }[];
};

const MAX_ROWS = 2000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Basit, alıntı-bilinçli CSV satır ayrıştırıcı (RFC 4180 alt kümesi)
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const HEADER_ALIASES: Record<string, "name" | "phone" | "email" | "notes"> = {
  name: "name", ad: "name", "ad soyad": "name", isim: "name", "full name": "name", "müşteri": "name",
  phone: "phone", telefon: "phone", tel: "phone", gsm: "phone", "phone number": "phone",
  email: "email", "e-posta": "email", eposta: "email", mail: "email", "e-mail": "email",
  notes: "notes", not: "notes", notlar: "notes", note: "notes", açıklama: "notes",
};

// CSV metnini güvenli şekilde ayrıştırıp doğrulanmış satırlara dönüştürür (insert YOK).
export async function parseCustomerCsv(text: string): Promise<{
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
}> {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], validCount: 0, errorCount: 0 };

  // Başlık tespiti
  const firstCells = parseCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  let colMap: Record<number, "name" | "phone" | "email" | "notes"> = {};
  let startIdx = 0;
  const hasHeader = firstCells.some((c) => c in HEADER_ALIASES);
  if (hasHeader) {
    firstCells.forEach((c, i) => {
      if (c in HEADER_ALIASES) colMap[i] = HEADER_ALIASES[c];
    });
    startIdx = 1;
  } else {
    // Varsayılan sıra: name, phone, email, notes
    colMap = { 0: "name", 1: "phone", 2: "email", 3: "notes" };
  }

  const rows: ImportRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = startIdx; i < lines.length && rows.length < MAX_ROWS; i++) {
    const cells = parseCsvLine(lines[i]);
    const rec: ImportRow = { name: "", phone: null, email: null, notes: null };
    for (const [idxStr, field] of Object.entries(colMap)) {
      const idx = Number(idxStr);
      const val = (cells[idx] ?? "").trim();
      if (field === "name") rec.name = val.slice(0, 120);
      else if (field === "phone") rec.phone = val.slice(0, 40) || null;
      else if (field === "email") rec.email = val.slice(0, 160) || null;
      else if (field === "notes") rec.notes = val.slice(0, 1000) || null;
    }

    if (!rec.name) {
      rec._error = "Name is empty";
      errorCount++;
    } else if (rec.email && !EMAIL_RE.test(rec.email)) {
      rec._error = "Invalid email";
      errorCount++;
    } else {
      validCount++;
    }
    rows.push(rec);
  }

  return { rows, validCount, errorCount };
}

// Doğrulanmış satırları ekler. Yalnızca customers.manage izniyle (fail-closed).
export async function importCustomers(csvText: string): Promise<ImportResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "Not signed in" };
  if (!hasPermission(member.role, "import.run") || !hasPermission(member.role, "customers.manage")) {
    return { ok: false, error: "You do not have permission for this action" };
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Shop not found" };

  if (typeof csvText !== "string" || csvText.length === 0) {
    return { ok: false, error: "The file is empty" };
  }
  if (csvText.length > 5_000_000) {
    return { ok: false, error: "That file is too large (5MB maximum)" };
  }

  const { rows } = await parseCustomerCsv(csvText);
  const valid = rows.filter((r) => !r._error && r.name);
  const errors = rows
    .map((r, i) => (r._error ? { line: i + 1, reason: r._error } : null))
    .filter(Boolean) as { line: number; reason: string }[];

  if (valid.length === 0) {
    return { ok: false, error: "No valid rows found", inserted: 0, skipped: rows.length, errors };
  }

  const payload = valid.map((r) => ({
    tenant_id: tenant.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    notes: r.notes,
    status: "new",
    created_by: member.userId,
  }));

  // Toplu insert. tenant_id her satıra elle yazılıyor — RLS yok, izolasyon burada.
  let count: number;
  try {
    const res = await prisma.customer.createMany({ data: payload });
    count = res.count;
  } catch {
    return { ok: false, error: "Could not save the records", errors };
  }

  revalidatePath("/customers");
  return { ok: true, inserted: count, skipped: errors.length, errors };
}
