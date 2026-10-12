import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Pencil } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Markdown } from "@/components/markdown";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { STATUS_META, TYPE_META, embedUrl } from "@/lib/resource-meta";
import { requirePermission } from "@/lib/session";
import { AcknowledgeButton, Attachments } from "./view-controls";

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("resources.view");
  const { id } = await params;
  const editor = can(user.role, "resources.edit");
  const r = await db.resource.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      files: { select: { id: true, name: true, size: true }, orderBy: { createdAt: "asc" } },
      templateTasks: { select: { title: true, template: { select: { id: true, name: true } } } },
      reads: { orderBy: { readAt: "desc" } },
    },
  });
  if (!r || (r.status !== "PUBLISHED" && !editor)) notFound();
  const myRead = r.reads.find((x) => x.userId === user.id && x.version === r.version);
  const embed = embedUrl(r.videoUrl);
  const staff = editor ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const readers = new Set(r.reads.filter((x) => x.version === r.version).map((x) => x.userId));
  const reviewOverdue = r.reviewDue && r.reviewDue.toISOString().slice(0, 10) <= todayISO();

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <Link href="/resources" className="text-xs text-muted hover:text-brand">← SOPs & Templates</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_META[r.type].tone}>{TYPE_META[r.type].label}</Badge>
          <span className="text-xs text-muted">{r.category}</span>
          {r.status !== "PUBLISHED" && <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>}
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{r.title}</h1>
        {r.summary && <p className="mt-1 text-muted">{r.summary}</p>}
        <Card className="mt-4 p-6">
          {embed && <div className="mb-5 aspect-video overflow-hidden rounded-lg bg-background"><iframe src={embed} className="h-full w-full" allowFullScreen title="Video walkthrough" /></div>}
          {!embed && r.videoUrl && <p className="mb-4 text-sm">Video: <a href={r.videoUrl} target="_blank" rel="noreferrer" className="text-brand underline">{r.videoUrl}</a></p>}
          <Markdown>{r.body}</Markdown>
        </Card>
        {r.status === "PUBLISHED" && <div className="mt-4"><AcknowledgeButton id={r.id} version={r.version} readAt={myRead ? formatDateTime(myRead.readAt) : null} /></div>}
      </div>

      <div className="space-y-4">
        {editor && (
          <div className="flex gap-2">
            <Link href={`/resources/${r.id}/edit`} className="flex-1"><Button className="w-full"><Pencil size={14} /> Edit</Button></Link>
            <Link href={`/resources/${r.id}/history`}><Button variant="secondary"><History size={14} /> History</Button></Link>
          </div>
        )}
        <Card className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">Version</span><span>{r.version}</span></div>
          <div className="flex justify-between"><span className="text-muted">Updated</span><span>{formatDateTime(r.updatedAt)}</span></div>
          {r.owner && <div className="flex items-center justify-between"><span className="text-muted">Owner</span><span className="inline-flex items-center gap-1.5"><Avatar user={r.owner} size="xs" /> {r.owner.name}</span></div>}
          {r.reviewDue && <div className="flex justify-between"><span className="text-muted">Next review</span><span className={reviewOverdue ? "font-medium text-danger" : ""}>{formatDate(r.reviewDue, { day: "numeric", month: "short", year: "numeric" })}</span></div>}
          {r.tags.length > 0 && <div className="flex flex-wrap gap-1 pt-1">{r.tags.map((t) => <Link key={t} href={`/resources?q=${encodeURIComponent(t)}`}><Badge>{t}</Badge></Link>)}</div>}
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Attachments</h2>
          <Attachments id={r.id} files={r.files} canEdit={editor} />
        </Card>
        {r.templateTasks.length > 0 && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Used in job templates</h2>
            <ul className="space-y-1 text-sm">
              {r.templateTasks.map((t, i) => <li key={i}><Link href={`/resources/job-templates/${t.template.id}`} className="text-brand hover:underline">{t.template.name}</Link> <span className="text-muted">· {t.title}</span></li>)}
            </ul>
          </Card>
        )}
        {editor && r.status === "PUBLISHED" && (
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Read version {r.version} ({readers.size}/{staff.length})</h2>
            <ul className="space-y-1.5">
              {staff.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  <Avatar user={u} size="xs" />
                  <span className="flex-1">{u.name}</span>
                  {readers.has(u.id) ? <Badge tone="success">Read</Badge> : <Badge>Not yet</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
