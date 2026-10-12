import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { ProgrammeEditor } from "../../controls";

export const metadata = { title: "Programme" };

export default async function ProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("team.manage");
  const { id } = await params;
  const [p, resources] = await Promise.all([
    db.programme.findUnique({ where: { id }, include: { steps: { orderBy: { position: "asc" } } } }),
    db.resource.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  if (!p) notFound();
  return (
    <div className="max-w-4xl">
      <Link href="/resources/staff-onboarding" className="text-xs text-muted hover:text-brand">← Staff Onboarding</Link>
      <Card className="mt-2">
        <ProgrammeEditor
          id={p.id}
          name={p.name}
          description={p.description ?? ""}
          active={p.active}
          resources={resources}
          steps={p.steps.map((s) => ({ id: s.id, title: s.title, description: s.description, resourceId: s.resourceId, dueOffsetDays: s.dueOffsetDays, estimateMinutes: s.estimateMinutes }))}
        />
      </Card>
    </div>
  );
}
