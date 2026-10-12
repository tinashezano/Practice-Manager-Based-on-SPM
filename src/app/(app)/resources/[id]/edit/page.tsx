import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/resource-meta";
import { requirePermission } from "@/lib/session";
import { ResourceForm } from "../../resource-form";

export const metadata = { title: "Edit resource" };

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("resources.edit");
  const { id } = await params;
  const [resource, staff, cats] = await Promise.all([
    db.resource.findUnique({ where: { id } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.resource.findMany({ distinct: ["category"], select: { category: true } }),
  ]);
  if (!resource) notFound();
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit: ${resource.title}`} subtitle={`Version ${resource.version}. Changing the title or content creates version ${resource.version + 1}, and the team will be asked to read it again.`} />
      <ResourceForm resource={resource} staff={staff} categories={[...new Set([...DEFAULT_CATEGORIES, ...cats.map((c) => c.category)])]} currentUserId={user.id} />
    </div>
  );
}
