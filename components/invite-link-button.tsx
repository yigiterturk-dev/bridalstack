"use client";

import { useState, useTransition } from "react";
import { regenerateInvite } from "@/app/(dashboard)/staff/actions";

/**
 * "Davet bağlantısı üret" düğmesi.
 *
 * Bağlantı sunucudan yalnız bu çağrının yanıtında gelir; sayfa kaynağında ya da
 * adres çubuğunda hiç durmaz. Üretmek eski bağlantıyı geçersiz kılar, bu yüzden
 * düğme metni bunu açıkça söyler.
 */
export default function InviteLinkButton({ invitationId }: { invitationId: string }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await regenerateInvite(invitationId);
      if (result.error || !result.link) {
        setError(result.error === "accepted" ? "This invitation was already accepted." : "Invitation not found.");
        return;
      }
      setLink(result.link);
      try {
        await navigator.clipboard.writeText(result.link);
        setCopied(true);
      } catch {
        // Pano yoksa bağlantı aşağıda görünür; kullanıcı elle kopyalar.
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="self-start text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
      >
        {pending ? "Generating…" : link ? "Generate a new link" : "Get invite link"}
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}

      {link && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full max-w-xs px-2 py-1 rounded-lg border border-gray-300 bg-gray-50 text-xs font-mono text-gray-700 outline-none"
          />
          {copied && <span className="text-xs text-green-600 whitespace-nowrap">Copied</span>}
        </div>
      )}
      {link && (
        <span className="text-xs text-gray-400">
          Valid for 7 days. Any earlier link for this person no longer works.
        </span>
      )}
    </div>
  );
}
