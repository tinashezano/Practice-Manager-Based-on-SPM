import { Badge, Button, Card, PageHeader, initials, inputBase } from "@/components/ui";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { AddStaffForm } from "./add-staff-form";
import { updateStaff } from "./actions";

export const metadata = { title: "Team & Roles" };

const ROLE_SUMMARY = [
  { role: "Director", text: "Everything, including firm financials, team management, rates, pricing and integrations." },
  { role: "Accountant", text: "Leads, proposals, clients, onboarding, all tasks, SOP editing and team workload. No firm financials or settings." },
  { role: "Bookkeeper", text: "Their own and assigned tasks, client details and SOPs (read-only). No deals, pricing or financials." },
];

export default async function TeamPage() {
  const actor = await requirePermission("team.manage");
  const staff = await db.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] });

  return (
    <>
      <PageHeader title="Team & Roles" subtitle="Who can sign in, what they can see, their weekly hours, hourly billing and cost rates (excl. VAT) and billable target. Rates feed WIP, margins and utilisation." />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Add a team member</h2>
        <AddStaffForm />
      </Card>

      <Card className="mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Hours / week · R/h bill · R/h cost · target</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Last sign-in</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => {
              const self = u.id === actor.id;
              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                        {initials(u.name)}
                      </div>
                      <div>
                        <div className="font-medium">{u.name}{self && <span className="text-muted"> (you)</span>}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3" colSpan={3}>
                    <form action={updateStaff} className="flex items-center gap-3">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="role" defaultValue={u.role} disabled={self} className={`${inputBase} w-36`}>
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {self && <input type="hidden" name="role" value={u.role} />}
                      <input
                        name="weeklyCapacityHours"
                        type="number"
                        min={0}
                        max={80}
                        defaultValue={u.weeklyCapacityHours}
                        className={`${inputBase} w-24`}
                      />
                      <input name="billRate" type="number" min={0} step={50} defaultValue={u.billRateCents / 100} className={`${inputBase} w-24`} title="Hourly billing rate (R, excl. VAT)" aria-label="Billing rate" />
                      <input name="costRate" type="number" min={0} step={10} defaultValue={u.costRateCents / 100} className={`${inputBase} w-24`} title="Hourly cost to the firm (R)" aria-label="Cost rate" />
                      <input name="billableTargetPercent" type="number" min={0} max={100} defaultValue={u.billableTargetPercent} className={`${inputBase} w-16`} title="Billable target %" aria-label="Billable target %" />
                      <select name="active" defaultValue={String(u.active)} disabled={self} className={`${inputBase} w-28`}>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                      {self && <input type="hidden" name="active" value="true" />}
                      <Button variant="secondary">Save</Button>
                    </form>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {u.lastLoginAt
                      ? u.lastLoginAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
                      : <Badge>Never</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!u.active && <Badge tone="danger">Inactive</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">What each role can do</h2>
        <dl className="space-y-2 text-sm">
          {ROLE_SUMMARY.map((r) => (
            <div key={r.role} className="flex gap-3">
              <dt className="w-24 shrink-0 font-medium">{r.role}</dt>
              <dd className="text-muted">{r.text}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
