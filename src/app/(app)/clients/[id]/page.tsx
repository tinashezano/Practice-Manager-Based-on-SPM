import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Pencil, Phone, Star, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { TaskWorkspace, type TaskSearchParams } from "@/components/tasks/task-workspace";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { CLIENT_STATUS_META, ENTITY_LABELS, PROJECT_STATUS_META } from "@/lib/task-meta";
import { removeContact, setProjectStatus } from "../actions";
import { AddContactForm, NewProjectForm } from "./client-side-forms";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<TaskSearchParams> }) {
  const user = await requirePermission("clients.view");
  const { id } = await params;
  const sp = await searchParams;
  const manage = can(user.role, "clients.manage");

  const client = await db.client.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      projects: { orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { owner: { select: { id: true, name: true } } } },
    },
  });
  if (!client) notFound();

  const [counts, templates, staff] = await Promise.all([
    db.task.groupBy({ by: ["projectId", "status"], where: { clientId: id, parentId: null }, _count: true }),
    manage ? db.projectTemplate.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tasks: { where: { parentId: null } } } } } }) : [],
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const progress = (projectId: string) => {
    const rows = counts.filter((c) => c.projectId === projectId);
    const total = rows.reduce((n, r) => n + r._count, 0);
    const done = rows.filter((r) => r.status === "DONE").reduce((n, r) => n + r._count, 0);
    return { total, done };
  };
  const selectedProject = typeof sp.project === "string" ? sp.project : undefined;
  const detail = (label: string, value: string | null) =>
    value ? (<div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-muted">{label}</span><span className="text-right">{value}</span></div>) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-xs text-muted hover:text-brand">← Clients</Link>
          <h1 className="mt-1 text-xl font-semibold">{client.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={CLIENT_STATUS_META[client.status].tone}>{CLIENT_STATUS_META[client.status].label}</Badge>
            {!client.isInternal && <span>{ENTITY_LABELS[client.entityType]}</span>}
            {client.owner && <span className="inline-flex items-center gap-1.5">· <Avatar user={client.owner} size="xs" /> {client.owner.name}</span>}
          </div>
        </div>
        {manage && <Link href={`/clients/${id}/edit`}><Button variant="secondary"><Pencil size={14} /> Edit client</Button></Link>}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold">Details</h2>
          <div className="divide-y divide-border">
            {detail("CIPC reg. no.", client.registrationNumber)}
            {detail("Income tax no.", client.taxNumber)}
            {detail("VAT no.", client.vatNumber)}
            {detail("Email", client.email)}
            {detail("Phone", client.phone)}
            {detail("Address", client.address)}
            {detail("Client since", formatDate(client.createdAt, { month: "short", year: "numeric" }))}
          </div>
          {client.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm text-muted">{client.notes}</p>}

          <h2 className="mb-2 mt-5 text-sm font-semibold">Contacts</h2>
          <div className="space-y-2">
            {client.contacts.map((c) => (
              <div key={c.id} className="group flex items-start gap-2 rounded-lg border border-border p-2.5">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center gap-1.5 font-medium">{c.name}{c.isPrimary && <Star size={12} className="fill-amber-400 text-amber-400" />}</div>
                  {c.position && <div className="text-xs text-muted">{c.position}</div>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                    {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-brand"><Mail size={11} />{c.email}</a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-brand"><Phone size={11} />{c.phone}</a>}
                  </div>
                </div>
                {manage && (
                  <form action={removeContact}>
                    <input type="hidden" name="contactId" value={c.id} />
                    <button className="text-muted opacity-0 hover:text-danger group-hover:opacity-100" aria-label={`Remove ${c.name}`}><X size={14} /></button>
                  </form>
                )}
              </div>
            ))}
            {client.contacts.length === 0 && <p className="text-xs text-muted">No contacts yet.</p>}
            {manage && <AddContactForm clientId={id} />}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Projects</h2>
            {selectedProject && <Link href={`/clients/${id}`} className="text-xs text-brand">Show all tasks</Link>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {client.projects.map((p) => {
              const { total, done } = progress(p.id);
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={p.id} className={clsx("rounded-lg border p-3", selectedProject === p.id ? "border-brand ring-2 ring-brand-soft" : "border-border")}>
                  <Link href={`/clients/${id}?project=${p.id}`} scroll={false} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium hover:text-brand">{p.name}</span>
                      <Badge tone={PROJECT_STATUS_META[p.status].tone}>{PROJECT_STATUS_META[p.status].label}</Badge>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                      <span>{done}/{total} tasks done</span>
                      <span className="inline-flex items-center gap-1">{p.dueDate && `Due ${formatDate(p.dueDate)}`} <Avatar user={p.owner} size="xs" /></span>
                    </div>
                  </Link>
                  {manage && (
                    <form action={setProjectStatus} className="mt-2 flex gap-1">
                      <input type="hidden" name="projectId" value={p.id} />
                      {(["ACTIVE", "ON_HOLD", "COMPLETED"] as const).filter((s) => s !== p.status).map((s) => (
                        <button key={s} name="status" value={s} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-brand hover:text-brand">
                          {s === "ACTIVE" ? "Reopen" : s === "ON_HOLD" ? "Put on hold" : "Complete"}
                        </button>
                      ))}
                    </form>
                  )}
                </div>
              );
            })}
            {client.projects.length === 0 && <p className="text-sm text-muted sm:col-span-3">No projects yet. Tasks without a project appear under “General”.</p>}
          </div>
          {manage && (
            <div className="mt-4">
              <NewProjectForm
                clientId={id}
                templates={templates.map((t) => ({ id: t.id, name: t.name, description: t.description, taskCount: t._count.tasks }))}
                staff={staff}
                currentUserId={user.id}
              />
            </div>
          )}
        </Card>
      </div>

      <TaskWorkspace
        user={user}
        searchParams={sp}
        clientId={id}
        header={(newTask) => (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Tasks</h2>
            {newTask}
          </div>
        )}
      />
    </>
  );
}
