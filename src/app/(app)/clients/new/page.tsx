import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { ClientForm } from "../client-form";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requirePermission("clients.manage");
  const staff = await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="New client" subtitle="Clients from signed proposals will be created automatically from Phase 3. Use this for existing clients." />
      <ClientForm staff={staff} currentUserId={user.id} />
    </div>
  );
}
