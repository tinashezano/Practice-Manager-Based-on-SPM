import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { TemplateEditor } from "./editor";

export const metadata = { title: "Job template" };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("resources.edit");
  const { id } = await params;
  const [t, resources] = await Promise.all([
    db.projectTemplate.findUnique({ where: { id }, include: { tasks: { orderBy: { position: "asc" } }, services: { select: { name: true } } } }),
    db.resource.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!t) notFound();
  const map = (x: (typeof t.tasks)[number]) => ({ id: x.id, title: x.title, dueOffsetDays: x.dueOffsetDays, estimateMinutes: x.estimateMinutes, priority: x.priority, resourceId: x.resourceId });
  const tree = t.tasks.filter((x) => !x.parentId).map((x) => ({ ...map(x), subtasks: t.tasks.filter((s) => s.parentId === x.id).map((s) => ({ ...map(s), subtasks: [] })) }));
  return (
    <div className="max-w-5xl">
      <Link href="/resources/job-templates" className="text-xs text-muted hover:text-brand">← Job templates</Link>
      <Card className="mt-2">
        <TemplateEditor id={t.id} name={t.name} description={t.description ?? ""} tasks={tree} resources={resources} />
        {t.services.length > 0 && <p className="mt-4 text-xs text-muted">Used when a client signs up for: {t.services.map((s) => s.name).join(", ")}.</p>}
      </Card>
    </div>
  );
}
