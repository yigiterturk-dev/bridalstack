import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  UPLOAD_SCOPES,
  blobPath,
  uploadsEnabled,
  type UploadScope,
} from "@/lib/uploads";

/**
 * İstemci yüklemesi için jeton ucu.
 *
 * Dosya doğrudan tarayıcıdan Blob'a gider (sunucu gövde sınırına takılmaz),
 * ama jetonu burada üretiyoruz. Yetki kontrolü ve yol seçimi sunucuda kalır:
 * istemcinin verdiği yola güvenmiyoruz, yolu kiracı kimliğinden kuruyoruz.
 */
export async function POST(request: Request) {
  if (!uploadsEnabled()) {
    return NextResponse.json(
      { error: "File uploads are not configured. Set BLOB_READ_WRITE_TOKEN." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const member = await getCurrentMember();
        if (!member) throw new Error("Unauthorized");

        let scope: UploadScope = "product";
        try {
          const parsed = JSON.parse(clientPayload ?? "{}") as { scope?: string };
          if (parsed.scope && (UPLOAD_SCOPES as readonly string[]).includes(parsed.scope)) {
            scope = parsed.scope as UploadScope;
          }
        } catch {
          // Bozuk payload varsayılan kapsamda kalır.
        }

        const permission = scope === "product" ? "products.manage" : "customers.manage";
        if (!hasPermission(member.role, permission)) throw new Error("Forbidden");

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          // Yolu sunucu belirler; istemcinin verdiği pathname yok sayılır.
          pathname: blobPath(member.tenantId, scope, "upload"),
          tokenPayload: JSON.stringify({ tenantId: member.tenantId, scope }),
        };
      },
      onUploadCompleted: async () => {
        // Kayıt, dosyayı kullanan form gönderiminde yazılıyor.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
