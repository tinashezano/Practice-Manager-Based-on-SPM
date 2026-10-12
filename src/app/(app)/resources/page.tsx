import clsx from "clsx";
import Link from "next/link";
import { CheckCircle2, Plus, Search } from "lucide-react";
import type { ResourceType } from "@prisma/client";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { formatDate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { STATUS_META, TYPE_META } from "@/lib/resource-meta";
import { excerpt, searchResources } from "@/lib/resources";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "SOPs & Templates" };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; type?: string }> }) {
  const user = await requirePermission("resources.view");
  const { q, category, type } = await searchParams;
  const editor = can(user.role, "resources.edit");
  const validType = type && type in TYPE_META ? (type as ResourceType) : undefined;
  const [rows, cats, reads] = await Promise.all([
    searchResources({ q: q?.trim() || undefined, category, type: validType, includeDrafts: editor }),
    db.resource.groupBy({ by: ["category"], where: { status: editor ? { not: "ARCHIVED" } : "PUBLISHED" }, _count: true, orderBy: { category: "asc" } }),
    db.resourceRead.findMany({ where: { userId: user.id }, select: { resourceId: true, version: true } }),
  ]);
  const readSet = new Set(reads.map((r) => `${r.resourceId}:${r.version}`));
  const today = todayISO();
  const link = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(Object.entries({ q, category, type, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/resources${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="SOPs & Templates"
        subtitle="How we do things at Outset. Search by keyword, or browse by category."
        actions={editor && <Link href="/resources/new"><Button><Plus size={15} /> New resource</Button></Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search SOPs, e.g. VAT201, month-end, POPIA" className={`${inputBase} w-96 max-w-full py-2 pl-9`} />
        </div>
        <select name="type" defaultValue={type ?? ""} className={`${inputBase} py-2`}>
          <option value="">All types</option>
          {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <Button variant="secondary">Search</Button>
      </form>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={link({ category: undefined })} className={clsx("rounded-full border px-3 py-1 text-xs", !category ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-foreground")}>All</Link>
        {cats.map((c) => (
          <Link key={c.category} href={link({ category: c.category })} className={clsx("rounded-full border px-3 py-1 text-xs", category === c.category ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-foreground")}>
            {c.category} <span className="opacity-60">{c._count}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const read = readSet.has(`${r.id}:${r.version}`);
          const overdue = r.reviewDue && r.reviewDue.toISOString().slice(0, 10) <= today;
          return (
            <Link key={r.id} href={`/resources/${r.id}`}>
              <Card className="h-full p-4 transition-colors hover:border-brand">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TYPE_META[r.type].tone}>{TYPE_META[r.type].label}</Badge>
                  <span className="text-xs text-muted">{r.category}</span>
                  {r.status !== "PUBLISHED" && <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>}
                  {editor && overdue && <Badge tone="danger">Review due</Badge>}
                  {read && <span className="ml-auto inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 size={13} /> Read</span>}
                </div>
                <div className="mt-2 font-semibold">{r.title}</div>
                <p className="mt-1 text-sm text-muted">{r.summary ?? excerpt(r.body, q)}</p>
                <div className="mt-2 text-[11px] text-muted">v{r.version} · updated {formatDate(r.updatedAt.toISOString().slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}{r.owner && ` · ${r.owner.name}`}</div>
              </Card>
            </Link>
          );
        })}
        {!rows.length && <Card className="text-sm text-muted md:col-span-2">{q ? `Nothing matches “${q}”.` : "No resources yet."}</Card>}
      </div>
    </>
  );
}
