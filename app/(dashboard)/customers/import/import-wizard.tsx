"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCustomerCsv, importCustomers, type ImportRow } from "./actions";

const SAMPLE = `name,phone,email,notes
Emily Carter,+1 212 555 0144,emily@example.com,Wedding September 2026
Olivia Bennett,+1 415 555 0198,,VIP client`;

export default function ImportWizard() {
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleFile(file: File) {
    setError("");
    setDone(null);
    if (file.size > 5_000_000) {
      setError("That file is too large (5MB maximum).");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setParsing(true);
    try {
      const result = await parseCustomerCsv(text);
      setRows(result.rows);
      setValidCount(result.validCount);
      setErrorCount(result.errorCount);
    } catch {
      setError("Could not read that file.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    const res = await importCustomers(csvText);
    setImporting(false);
    if (!res.ok) {
      setError(res.error || "Import failed.");
      return;
    }
    setDone({ inserted: res.inserted ?? 0, skipped: res.skipped ?? 0 });
    router.refresh();
  }

  function reset() {
    setFileName("");
    setCsvText("");
    setRows([]);
    setValidCount(0);
    setErrorCount(0);
    setDone(null);
    setError("");
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-green-500 mb-3 block">
          task_alt
        </span>
        <h2 className="text-lg font-serif font-normal text-gray-900 mb-1">Import complete</h2>
        <p className="text-sm text-gray-500 mb-6">
          {done.inserted} {done.inserted === 1 ? "customer" : "customers"} added
          {done.skipped > 0 ? `, ${done.skipped} ${done.skipped === 1 ? "row" : "rows"} skipped` : ""}.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/customers")}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800"
          >
            View customers
          </button>
          <button
            onClick={reset}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Start another import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <label className="block">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gold transition-colors">
            <span className="material-symbols-outlined text-3xl text-gray-400 mb-2 block">
              upload_file
            </span>
            <p className="text-sm text-gray-600">
              {fileName || "Click to choose a CSV file"}
            </p>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </label>

        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Example format
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-[11px] text-gray-600 overflow-x-auto">
            {SAMPLE}
          </pre>
        </details>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {parsing && <p className="text-sm text-gray-500">Parsing…</p>}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold text-green-600">{validCount} valid</span>
              {errorCount > 0 && (
                <span className="text-red-500 ml-2">{errorCount} errors</span>
              )}
              <span className="text-gray-400 ml-2">/ {rows.length} rows</span>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${validCount} ${validCount === 1 ? "customer" : "customers"}`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className={r._error ? "bg-red-50" : ""}>
                    <td className="px-4 py-2 text-gray-900">{r.name || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{r.phone || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{r.email || "—"}</td>
                    <td className="px-4 py-2">
                      {r._error ? (
                        <span className="text-xs text-red-600">{r._error}</span>
                      ) : (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p className="px-4 py-2 text-xs text-gray-400">
                Showing the first 200 rows…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
