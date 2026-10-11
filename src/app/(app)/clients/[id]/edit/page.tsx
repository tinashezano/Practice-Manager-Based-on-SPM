import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { ClientForm } from "../../client-form";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.manage");
  const { id } = await params;
  const [client, staff] = await Promise.all([
    db.client.findUnique({ where: { id } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${client.name}`} />
      <ClientForm client={client} staff={staff} currentUserId={user.id} />
    </div>
  );
}
