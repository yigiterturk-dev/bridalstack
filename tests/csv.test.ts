import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../lib/csv.ts";

test("boş değerler boş hücre olur", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("virgül, tırnak ve satır sonu kaçışlanır", () => {
  assert.equal(csvCell("Smith, Jane"), '"Smith, Jane"');
  assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
});

test("formül enjeksiyonu etkisizleştirilir", () => {
  // Excel bunları formül olarak çalıştırırdı.
  for (const risky of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
    assert.ok(csvCell(risky).startsWith("'"), `${risky} kaçışlanmalı`);
  }
});

test("formül kaçışı gerektiğinde tırnaklamayla birlikte çalışır", () => {
  assert.equal(csvCell("=cmd,evil"), `"'=cmd,evil"`);
});

test("normal metin dokunulmadan geçer", () => {
  assert.equal(csvCell("Aurora Gown"), "Aurora Gown");
  assert.equal(csvCell(4200), "4200");
});

test("toCsv başlık ve satırları CRLF ile birleştirir", () => {
  const out = toCsv(["a", "b"], [[1, 2], [3, 4]]);
  assert.ok(out.startsWith("﻿"), "Excel için BOM olmalı");
  const lines = out.replace("﻿", "").trimEnd().split("\r\n");
  assert.deepEqual(lines, ["a,b", "1,2", "3,4"]);
});
