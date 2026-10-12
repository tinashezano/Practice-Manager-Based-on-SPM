import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

// Downloads a stored file (e.g. a signed proposal). Staff only.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, "proposals.manage")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
