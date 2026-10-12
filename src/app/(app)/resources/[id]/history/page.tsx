import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Version history" };

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  await requirePermission("resources.edit");
  const { id } = await params;
  const { v } = await searchParams;
  const r = await db.resource.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!r) notFound();
  const editors = await db.user.findMany({ where: { id: { in: r.versions.map((x) => x.editedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = new Map(editors.map((e) => [e.id, e.name]));
  const selected = r.versions.find((x) => String(x.version) === v) ?? r.versions[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div>
        <Link href={`/resources/${id}`} className="text-xs text-muted hover:text-brand">← {r.title}</Link>
        <h1 className="mb-3 mt-1 text-lg font-semibold">Version history</h1>
        <Card className="divide-y divide-border p-0">
          {r.versions.map((x) => (
            <Link key={x.id} href={`/resources/${id}/history?v=${x.version}`} className={clsx("block px-4 py-2.5 text-sm hover:bg-background", selected?.id === x.id && "bg-brand-soft")}>
              <div className="font-medium">Version {x.version}{x.version === r.version && " (current)"}</div>
              <div className="text-xs text-muted">{formatDateTime(x.createdAt)}{x.editedById && ` · ${nameOf.get(x.editedById)}`}</div>
              {x.changeNote && <div className="mt-0.5 text-xs">{x.changeNote}</div>}
            </Link>
          ))}
        </Card>
      </div>
      {selected && (
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">{selected.title}</h2>
          <Markdown>{selected.body}</Markdown>
        </Card>
      )}
    </div>
  );
}
