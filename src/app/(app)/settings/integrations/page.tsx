import { CreditCard, FileSignature, Landmark } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GoogleConnectCard } from "@/components/google-connect";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/google";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Integrations" };

const LATER = [
  { icon: FileSignature, name: "DocuSign", text: "Proposals and engagement letters signed inside the app.", phase: 3 },
  { icon: CreditCard, name: "Paystack", text: "Once-off payments and monthly retainers after signing.", phase: 3 },
  { icon: Landmark, name: "QuickBooks Online", text: "Clients, invoices and payments synced to your books.", phase: 8 },
];

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await requirePermission("settings.manage");
  const { google } = await searchParams;
  const staff = await db.user.findMany({ where: { active: true }, include: { google: true }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connections to Google Workspace and, in later phases, DocuSign, Paystack and QuickBooks." />
      <div className="mb-6"><GoogleConnectCard userId={user.id} back="/settings/integrations" status={google} /></div>

      <Card className="mb-6 p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Team Google connections</h2>
          {googleConfigured() ? <Badge tone="success">Google OAuth configured</Badge> : <Badge tone="danger">AUTH_GOOGLE_ID / SECRET missing</Badge>}
        </div>
        <div className="divide-y divide-border">
          {staff.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <Avatar user={u} />
              <span className="flex-1">{u.name}</span>
              {u.google ? (
                <span className="text-xs text-muted">{u.google.googleEmail} · since {formatDateTime(u.google.createdAt)}</span>
              ) : (
                <Badge tone="warning">Not connected</Badge>
              )}
            </div>
          ))}
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">Each person connects their own account from Booking Links or Calendar. Booking hosts and lead owners need it for calendar availability and emails.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {LATER.map((i) => (
          <Card key={i.name}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><i.icon size={16} className="text-brand" /> {i.name}</div>
            <p className="text-sm text-muted">{i.text}</p>
            <div className="mt-3"><Badge>Phase {i.phase}</Badge></div>
          </Card>
        ))}
      </div>
    </>
  );
}
