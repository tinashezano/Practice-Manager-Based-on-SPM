import { db } from "@/lib/db";

// Logos, pictures and brochures on client-facing proposals. Public (no
// sign-in), but only for files uploaded as proposal assets; IDs are unguessable.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.storedFile.findFirst({ where: { id, purpose: "PUBLIC_ASSET" } });
  if (!file) return new Response("Not found", { status: 404 });
  const inline = file.contentType.startsWith("image/") || file.contentType === "application/pdf";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.name.replace(/[^\w.\- ()]/g, "_")}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
