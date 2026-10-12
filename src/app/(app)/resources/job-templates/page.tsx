import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button, Card, PageHeader, inputBase } from "@/components/ui";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { createTemplate } from "./actions";

export const metadata = { title: "Job templates" };

export default async function TemplatesPage() {
  const user = await requirePermission("resources.view");
  const editor = can(user.role, "resources.edit");
  const templates = await db.projectTemplate.findMany({
    include: { tasks: { select: { parentId: true, resourceId: true, estimateMinutes: true } }, services: { select: { name: true } }, _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="Job templates" subtitle="The task lists used when a project starts, for example when a client signs up for Monthly Bookkeeping. Link each task to its SOP so the team sees how to do it." />
      {editor && (
        <form action={createTemplate} className="mb-4 flex gap-2">
          <input name="name" required minLength={3} placeholder="New template name, e.g. Provisional Tax (IRP6)" className={`${inputBase} w-96 max-w-full py-2`} />
          <Button>Create template</Button>
        </form>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => {
          const top = t.tasks.filter((x) => !x.parentId).length;
          const linked = t.tasks.filter((x) => x.resourceId).length;
          const hours = t.tasks.reduce((n, x) => n + (x.estimateMinutes ?? 0), 0) / 60;
          const card = (
            <Card className="h-full p-4 transition-colors hover:border-brand">
              <div className="font-semibold">{t.name}</div>
              {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>{top} tasks</span>
                {hours > 0 && <span>~{Math.round(hours * 10) / 10}h</span>}
                <span className="inline-flex items-center gap-1"><BookOpen size={12} /> {linked}/{t.tasks.length} linked to SOPs</span>
                <span>{t._count.projects} project{t._count.projects === 1 ? "" : "s"}</span>
              </div>
              {t.services.length > 0 && <div className="mt-1 text-xs text-muted">Service: {t.services.map((s) => s.name).join(", ")}</div>}
            </Card>
          );
          return editor ? <Link key={t.id} href={`/resources/job-templates/${t.id}`}>{card}</Link> : <div key={t.id}>{card}</div>;
        })}
      </div>
    </>
  );
}
