import { CheckCircle2, Circle } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/session";

const PHASES = [
  { n: 0, name: "Foundation — login, roles, app shell", done: true },
  { n: 1, name: "Clients & Task Management", done: false },
  { n: 2, name: "Leads, Pipeline & Google Calendar booking", done: false },
  { n: 3, name: "Proposals, DocuSign & Paystack", done: false },
  { n: 4, name: "Client Onboarding", done: false },
  { n: 5, name: "Resource Hub", done: false },
  { n: 6, name: "Workload & Time", done: false },
  { n: 7, name: "Dashboards", done: false },
  { n: 8, name: "QuickBooks Online", done: false },
];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hour12: false, timeZone: "Africa/Johannesburg" }).format(new Date()),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function MyDashboard() {
  const user = await requireUser();
  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} subtitle="Your day at a glance." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Due today" value="—" hint="Available from Phase 1" />
        <StatCard label="Overdue" value="—" hint="Available from Phase 1" />
        <StatCard label="Awaiting my review" value="—" hint="Available from Phase 1" />
        <StatCard label="Logged this week" value="—" hint="Available from Phase 6" />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Build progress</h2>
        <ul className="space-y-2">
          {PHASES.map((p) => (
            <li key={p.n} className="flex items-center gap-2 text-sm">
              {p.done ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} className="text-border" />}
              <span className={p.done ? "text-foreground" : "text-muted"}>
                Phase {p.n}: {p.name}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
