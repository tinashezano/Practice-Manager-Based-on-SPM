import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Mail, Pencil, Phone, Video } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskWorkspace, type TaskSearchParams } from "@/components/tasks/task-workspace";
import { Badge, Button, Card } from "@/components/ui";
import { formatWhen } from "@/lib/booking";
import { SOURCE_LABELS, STAGE_META, formatZAR, probabilityOf } from "@/lib/deal-meta";
import { formatDate, formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { ENTITY_LABELS } from "@/lib/task-meta";
import { proposalNumber } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { STATUS_LABELS, displayStatus, totalsOf } from "@/lib/proposals";
import { FileSignature, Plus } from "lucide-react";
import { ConvertButton, NoteForm, SendLinkForm, StageControl } from "./deal-controls";

const ACTIVITY_DOT: Record<string, string> = {
  NOTE: "bg-brand",
  STAGE_CHANGE: "bg-violet-500",
  EMAIL: "bg-sky-500",
  BOOKING: "bg-green-500",
  TASK: "bg-amber-500",
  SYSTEM: "bg-slate-400",
};

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<TaskSearchParams> }) {
  const user = await requirePermission("deals.manage");
  const { id } = await params;
  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      bookings: { orderBy: { startsAt: "desc" }, include: { host: { select: { name: true } }, bookingLink: { select: { title: true } } } },
      proposals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal) notFound();
  const [links, actors] = await Promise.all([
    db.bookingLink.findMany({ where: { active: true }, include: { host: { select: { name: true } } }, orderBy: [{ isDefault: "desc" }, { title: "asc" }] }),
    db.user.findMany({ where: { id: { in: deal.activities.map((a) => a.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const row = (label: string, value: React.ReactNode) =>
    value ? (<div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-muted">{label}</span><span className="text-right">{value}</span></div>) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/deals/pipeline" className="text-xs text-muted hover:text-brand">← Pipeline</Link>
          <h1 className="mt-1 text-xl font-semibold">{deal.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={STAGE_META[deal.stage].tone}>{STAGE_META[deal.stage].label}</Badge>
            <span>{deal.valueCents ? formatZAR(deal.valueCents) : "No value yet"} · {probabilityOf(deal)}%</span>
            {deal.owner && <span className="inline-flex items-center gap-1.5">· <Avatar user={deal.owner} size="xs" /> {deal.owner.name}</span>}
          </div>
          {deal.stage === "LOST" && deal.lostReason && <p className="mt-2 text-sm text-danger">Lost: {deal.lostReason}</p>}
          {deal.client && <p className="mt-2 text-sm">Converted to client <Link href={`/clients/${deal.client.id}`} className="font-medium text-brand">{deal.client.name}</Link></p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageControl dealId={deal.id} stage={deal.stage} />
          <Link href={`/deals/${deal.id}/edit`}><Button variant="secondary"><Pencil size={14} /> Edit</Button></Link>
          {!deal.client && deal.stage !== "LOST" && can(user.role, "clients.manage") && <ConvertButton dealId={deal.id} name={deal.name} />}
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Contact</h2>
            <div className="text-sm font-medium">{deal.contactName}</div>
            <div className="mt-1 space-y-1 text-sm text-muted">
              {deal.email && <a href={`mailto:${deal.email}`} className="flex items-center gap-1.5 hover:text-brand"><Mail size={13} /> {deal.email}</a>}
              {deal.phone && <a href={`tel:${deal.phone}`} className="flex items-center gap-1.5 hover:text-brand"><Phone size={13} /> {deal.phone}</a>}
            </div>
            <div className="mt-3 divide-y divide-border">
              {row("Entity", deal.entityType && ENTITY_LABELS[deal.entityType])}
              {row("Services", deal.servicesInterest)}
              {row("Source", SOURCE_LABELS[deal.source])}
              {row("Expected close", deal.expectedCloseDate && formatDate(deal.expectedCloseDate, { day: "numeric", month: "short", year: "numeric" }))}
              {row("Created", formatDateTime(deal.createdAt))}
              {row("POPIA consent", deal.popiaConsentAt && formatDateTime(deal.popiaConsentAt))}
            </div>
            {deal.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm text-muted">{deal.notes}</p>}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><CalendarClock size={15} /> Discovery calls</h2>
            <div className="space-y-2">
              {deal.bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={clsx(b.status === "CANCELLED" && "text-muted line-through")}>{formatWhen(b.startsAt)}</span>
                    <Badge tone={b.status === "CONFIRMED" ? "brand" : b.status === "COMPLETED" ? "success" : "neutral"}>{b.status.toLowerCase()}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{b.bookingLink.title} with {b.host.name}</div>
                  {b.meetUrl && b.status === "CONFIRMED" && <a href={b.meetUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs text-brand"><Video size={12} /> Google Meet</a>}
                </div>
              ))}
              {!deal.bookings.length && <p className="text-xs text-muted">No calls booked yet.</p>}
            </div>
            {deal.stage !== "WON" && deal.stage !== "LOST" && (
              <div className="mt-3 border-t border-border pt-3">
                <SendLinkForm dealId={deal.id} hasEmail={!!deal.email} links={links.map((l) => ({ id: l.id, title: l.title, host: l.host.name }))} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><FileSignature size={15} /> Proposals</h2>
            {can(user.role, "proposals.manage") && deal.stage !== "LOST" && !deal.client && (
              <Link href={`/proposals/new?deal=${deal.id}`}><Button variant="secondary"><Plus size={14} /> Create proposal</Button></Link>
            )}
          </div>
          <div className="divide-y divide-border">
            {deal.proposals.map((p) => {
              const s = displayStatus(p);
              const t = totalsOf(p);
              return (
                <Link key={p.id} href={`/proposals/${p.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-brand">
                  <span className="font-mono text-xs text-muted">{proposalNumber(p.number)}</span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-muted">{formatRand(t.dueNow)}{t.monthly ? ` + ${formatRand(t.monthly)}/mo` : ""}</span>
                  <Badge tone={STATUS_LABELS[s].tone}>{STATUS_LABELS[s].label}</Badge>
                </Link>
              );
            })}
            {!deal.proposals.length && <p className="py-2 text-xs text-muted">No proposals yet.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Activity</h2>
          <NoteForm dealId={deal.id} />
          <ol className="mt-5 space-y-3">
            {deal.activities.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", ACTIVITY_DOT[a.type])} />
                <div className="min-w-0 flex-1">
                  <p className={clsx("whitespace-pre-wrap text-sm", a.type === "NOTE" ? "text-foreground" : "text-muted")}>{a.body}</p>
                  <p className="text-[11px] text-muted">{a.actorId ? actorName.get(a.actorId) ?? "Someone" : "Automation"} · {formatDateTime(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        </div>
      </div>

      <TaskWorkspace
        user={user}
        searchParams={await searchParams}
        dealId={deal.id}
        header={() => (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Lead tasks</h2>
            <div className="w-64"><QuickAdd dealId={deal.id} label="Add a task for this lead" /></div>
          </div>
        )}
      />
    </>
  );
}
