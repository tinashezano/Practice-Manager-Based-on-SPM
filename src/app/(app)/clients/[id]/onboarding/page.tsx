import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock, FileText, RotateCcw } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { onboardingInclude, progress, uploadUrl } from "@/lib/onboarding";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { formatBytes } from "@/lib/storage";
import { AddItem, InfoItemControls, LinkTools, PersonSelect, ReviewPanel, SetupCheck, StageBar, StartOnboardingButton } from "./controls";

export const metadata = { title: "Onboarding" };

const STATUS_ICON = {
  PENDING: <Circle size={18} className="text-border" />,
  RECEIVED: <Clock size={18} className="text-brand" />,
  ACCEPTED: <CheckCircle2 size={18} className="text-success" />,
  REJECTED: <RotateCcw size={18} className="text-warning" />,
  NOT_APPLICABLE: <CheckCircle2 size={18} className="text-muted" />,
  DONE: <CheckCircle2 size={18} className="text-success" />,
};
const STATUS_TEXT = { PENDING: "Waiting for client", RECEIVED: "Received, check it", ACCEPTED: "Accepted", REJECTED: "Sent back to client", NOT_APPLICABLE: "Not applicable", DONE: "Done" };

export default async function ClientOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.view");
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!client) notFound();
  const o = await db.onboarding.findFirst({ where: { clientId: id }, orderBy: { createdAt: "desc" }, include: { ...onboardingInclude, activities: { orderBy: { createdAt: "desc" }, take: 50 } } });
  const manage = can(user.role, "clients.manage");

  const header = (
    <div className="mb-6">
      <Link href={`/clients/${id}`} className="text-xs text-muted hover:text-brand">← {client.name}</Link>
      <h1 className="mt-1 text-xl font-semibold">Onboarding</h1>
    </div>
  );

  if (!o) {
    return (
      <>
        {header}
        <Card className="py-10 text-center">
          <p className="text-sm text-muted">Onboarding hasn&apos;t started for this client. It starts automatically when a proposal is signed and paid.</p>
          {manage && <div className="mt-4"><StartOnboardingButton clientId={id} /></div>}
        </Card>
      </>
    );
  }

  const [staff, people] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { id: { in: [...o.items.map((i) => i.completedById), ...o.activities.map((a) => a.actorId)].filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const pr = progress(o.items);
  const info = o.items.filter((i) => i.kind === "INFO");
  const setup = o.items.filter((i) => i.kind === "SETUP");
  const canApprove = o.reviewerId === user.id || can(user.role, "settings.manage");

  return (
    <>
      {header}
      <Card className="mb-4 space-y-4">
        <StageBar onboardingId={o.id} stage={o.stage} canMove={manage} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-muted">Owner <PersonSelect onboardingId={o.id} field="ownerId" value={o.ownerId} staff={staff} disabled={!manage} /></span>
          <span className="text-muted">Reviewer <PersonSelect onboardingId={o.id} field="reviewerId" value={o.reviewerId} staff={staff} disabled={!manage} /></span>
          <span className="text-muted">Started {formatDateTime(o.createdAt)}</span>
          {o.remindersSent > 0 && <span className="text-muted">{o.remindersSent} reminder{o.remindersSent === 1 ? "" : "s"} sent</span>}
          {o.completedAt && <Badge tone="success">Completed {formatDateTime(o.completedAt)}</Badge>}
        </div>
        {o.stage !== "COMPLETE" && (
          <div className="rounded-lg bg-background p-3">
            <div className="mb-2 text-xs text-muted">The client&apos;s secure upload page (no login needed):</div>
            <div className="mb-2 truncate font-mono text-xs">{uploadUrl(o.uploadToken)}</div>
            <LinkTools onboardingId={o.id} url={uploadUrl(o.uploadToken)} canRemind={o.stage === "INFO_REQUESTED" && pr.outstanding.length > 0} />
          </div>
        )}
        {o.stage === "REVIEW" && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
            <p className="mb-2 text-sm">Everything is received and set up. {canApprove ? "Approve to make the client Active." : "Waiting for the reviewer to approve."}</p>
            {canApprove && <ReviewPanel onboardingId={o.id} />}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">From the client</h2>
            <span className="text-xs text-muted">{pr.infoReceived}/{pr.infoTotal} received · {pr.infoAccepted} accepted</span>
          </div>
          <div className="divide-y divide-border">
            {info.map((item) => (
              <div key={item.id} className="py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">{STATUS_ICON[item.status]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{item.label}</span>
                      {!item.required && <Badge>Optional</Badge>}
                      <span className={clsx("text-xs", item.status === "RECEIVED" ? "font-medium text-brand" : item.status === "REJECTED" ? "text-warning" : "text-muted")}>{STATUS_TEXT[item.status]}</span>
                    </div>
                    {item.description && <p className="text-xs text-muted">{item.description}</p>}
                    {item.staffNote && <p className="mt-1 text-xs text-warning">Note to client: {item.staffNote}</p>}
                    {item.clientAnswer && <p className="mt-1 whitespace-pre-wrap rounded bg-background px-2 py-1 text-xs">{item.clientAnswer}</p>}
                    {item.files.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {item.files.map((f) => (
                          <li key={f.id}><a href={`/api/files/${f.file.id}`} className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><FileText size={12} /> {f.file.name}</a> <span className="text-[11px] text-muted">{formatBytes(f.file.size)} · {formatDateTime(f.file.createdAt)}</span></li>
                        ))}
                      </ul>
                    )}
                    {item.completedById && <p className="mt-1 text-[11px] text-muted">by {nameOf.get(item.completedById)}</p>}
                  </div>
                  {o.stage !== "COMPLETE" && <InfoItemControls itemId={item.id} status={item.status} canRemove={manage && item.files.length === 0} />}
                </div>
              </div>
            ))}
          </div>
          {manage && o.stage !== "COMPLETE" && <div className="mt-3"><AddItem onboardingId={o.id} kind="INFO" /></div>}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Setup checklist</h2>
              <span className="text-xs text-muted">{pr.setupDone}/{pr.setupTotal}</span>
            </div>
            {setup.map((s) => <SetupCheck key={s.id} itemId={s.id} done={s.status === "DONE" || s.status === "NOT_APPLICABLE"} label={s.label} by={s.completedById ? nameOf.get(s.completedById) : undefined} />)}
            {manage && o.stage !== "COMPLETE" && <div className="mt-2"><AddItem onboardingId={o.id} kind="SETUP" /></div>}
            {o.stage === "INFO_REQUESTED" || o.stage === "INFO_RECEIVED" ? <p className="mt-2 text-[11px] text-muted">You can tick setup steps any time; the stage moves to Review once client items are accepted and setup is done.</p> : null}
          </Card>
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Activity</h2>
            <ol className="space-y-2">
              {o.activities.map((a) => (
                <li key={a.id} className="text-xs">
                  <div>{a.body}</div>
                  <div className="text-[11px] text-muted">{a.byClient ? "Client" : a.actorId ? nameOf.get(a.actorId) ?? "Staff" : "Automation"} · {formatDateTime(a.createdAt)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
