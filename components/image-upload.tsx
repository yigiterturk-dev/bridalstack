"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/uploads";

type Props = {
  /** Yüklenen adresin yazılacağı gizli alanın adı. */
  name: string;
  scope: "product" | "try-on";
  /** Birden fazla dosya seçilebilsin mi (prova fotoğrafları). */
  multiple?: boolean;
  defaultValue?: string[];
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
};

/**
 * Dosyayı doğrudan tarayıcıdan Blob'a yükler, adresi gizli alana yazar.
 * Sunucu gövde sınırına takılmaz; yetki ve yol /api/upload tarafında belirlenir.
 */
export default function ImageUpload({
  name,
  scope,
  multiple = false,
  defaultValue = [],
  label = "Photo",
  disabled = false,
  disabledHint,
}: Props) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
          throw new Error(`${file.name} is not a supported image type.`);
        }
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error(`${file.name} is larger than 10 MB.`);
        }
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ scope }),
        });
        uploaded.push(blob.url);
      }
      setUrls((prev) => (multiple ? [...prev, ...uploaded] : uploaded.slice(-1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (disabled) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
          {disabledHint ?? "Photo uploads are not available yet."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {urls.map((u) => (
        <input key={u} type="hidden" name={name} value={u} />
      ))}

      {urls.length > 0 && (
        <div className={`grid gap-2 mb-3 ${multiple ? "grid-cols-4" : "grid-cols-1 max-w-[160px]"}`}>
          {urls.map((u) => (
            <div key={u} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-full aspect-square object-cover rounded-xl border border-gray-200" />
              <button
                type="button"
                onClick={() => setUrls((prev) => prev.filter((x) => x !== u))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 text-gray-500 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple={multiple}
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
        className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800 file:cursor-pointer disabled:opacity-50"
      />

      <p className="text-xs text-gray-400 mt-1.5">
        {busy ? "Uploading…" : `JPG, PNG, WebP, AVIF or HEIC. Up to 10 MB${multiple ? " each" : ""}.`}
      </p>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
}
