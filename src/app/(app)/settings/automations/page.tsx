import clsx from "clsx";
import { Workflow } from "lucide-react";
import { Badge, Button, Card, PageHeader, inputBase } from "@/components/ui";
import { AUTOMATIONS, getAutomation, type AutomationKey } from "@/lib/automations/settings";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { saveAutomation } from "./actions";

export const metadata = { title: "Automations" };

const CONFIG_LABELS: Record<string, string> = { days: "Days to wait", dueDays: "Due in (business days)" };

export default async function AutomationsPage() {
  await requirePermission("settings.manage");
  const keys = Object.keys(AUTOMATIONS) as AutomationKey[];
  const settings = await Promise.all(keys.map(getAutomation));
  const [events, emails, failedJobs] = await Promise.all([
    db.eventLog.findMany({ where: { type: { notIn: ["user.invited", "user.updated"] } }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.emailMessage.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.job.count({ where: { doneAt: null, attempts: { gte: 5 } } }),
  ]);

  return (
    <>
      <PageHeader title="Automations" subtitle="The rules that move leads through the workflow. They run in the background as things happen." />
      <div className="mb-6 space-y-3">
        {keys.map((key, i) => {
          const def = AUTOMATIONS[key];
          const s = settings[i]!;
          return (
            <Card key={key} className="p-4">
              <form action={saveAutomation} className="flex flex-wrap items-center gap-4">
                <input type="hidden" name="key" value={key} />
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand"><Workflow size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">{def.title} {s.enabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</div>
                  <p className="text-xs text-muted">{def.detail}</p>
                </div>
                {Object.keys(def.config).map((name) => (
                  <label key={name} className="text-xs text-muted">
                    {CONFIG_LABELS[name] ?? name}
                    <input name={name} type="number" min={0} max={365} defaultValue={s.config[name]} className={`${inputBase} ml-2 w-20 py-1`} />
                  </label>
                ))}
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Enabled</label>
                <Button variant="secondary">Save</Button>
              </form>
            </Card>
          );
        })}
      </div>

      {failedJobs > 0 && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-danger">{failedJobs} background job{failedJobs === 1 ? " has" : "s have"} failed 5 times and stopped retrying. Check the server logs.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Recent automation events</div>
          <div className="divide-y divide-border">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={clsx("h-2 w-2 shrink-0 rounded-full", e.error ? "bg-danger" : e.processedAt ? "bg-success" : "bg-warning")} />
                <span className="flex-1 font-mono text-xs">{e.type}</span>
                {e.error && <span className="max-w-48 truncate text-xs text-danger" title={e.error}>{e.error}</span>}
                <span className="text-xs text-muted">{formatDateTime(e.createdAt)}</span>
              </div>
            ))}
            {!events.length && <p className="px-4 py-8 text-center text-sm text-muted">Nothing yet.</p>}
          </div>
        </Card>
        <Card className="p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Email outbox</div>
          <div className="divide-y divide-border">
            {emails.map((m) => (
              <div key={m.id} className="px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone={m.status === "SENT" ? "success" : m.status === "QUEUED" ? "brand" : m.status === "SKIPPED" ? "warning" : "danger"}>{m.status.toLowerCase()}</Badge>
                  <span className="truncate">{m.subject}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">to {m.to} · {formatDateTime(m.createdAt)}{m.error && ` · ${m.error}`}</div>
              </div>
            ))}
            {!emails.length && <p className="px-4 py-8 text-center text-sm text-muted">No emails yet.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
