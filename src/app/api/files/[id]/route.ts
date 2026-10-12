import type { FilePurpose } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";

// Who may download each kind of file. Signed proposals show pricing, so they
// follow proposal access; client documents and task attachments are for anyone
// working on clients.
const ACCESS: Record<FilePurpose, Permission> = {
  SIGNED_PROPOSAL: "proposals.manage",
  CLIENT_DOCUMENT: "clients.view",
  TASK_ATTACHMENT: "tasks.work",
  RESOURCE_ATTACHMENT: "resources.view",
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const file = session?.user ? await db.storedFile.findUnique({ where: { id } }) : null;
  if (!file || !can(session!.user.role, ACCESS[file.purpose])) return new Response("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.has("view") && (file.contentType === "application/pdf" || file.contentType.startsWith("image/"));
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.name.replace(/[^\w.\- ()]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
