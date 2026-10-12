import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { DealForm } from "../../deal-form";

export const metadata = { title: "Edit lead" };

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("deals.manage");
  const { id } = await params;
  const [deal, staff] = await Promise.all([
    db.deal.findUnique({ where: { id } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!deal) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${deal.name}`} />
      <DealForm deal={deal} staff={staff} currentUserId={user.id} />
    </div>
  );
}
