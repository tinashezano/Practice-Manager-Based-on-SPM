import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { DealForm } from "../deal-form";

export const metadata = { title: "New lead" };

export default async function NewDealPage() {
  const user = await requirePermission("deals.manage");
  const staff = await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="New lead" subtitle="Leads from your website form and booking pages are added automatically." />
      <DealForm staff={staff} currentUserId={user.id} />
    </div>
  );
}
