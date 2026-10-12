import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/resource-meta";
import { requirePermission } from "@/lib/session";
import { ResourceForm } from "../resource-form";

export const metadata = { title: "New resource" };

export default async function NewResourcePage() {
  const user = await requirePermission("resources.edit");
  const [staff, cats] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.resource.findMany({ distinct: ["category"], select: { category: true } }),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New resource" subtitle="Write an SOP, template, guide or policy. Save as Draft until it's ready for the team." />
      <ResourceForm staff={staff} categories={[...new Set([...DEFAULT_CATEGORIES, ...cats.map((c) => c.category)])]} currentUserId={user.id} />
    </div>
  );
}
