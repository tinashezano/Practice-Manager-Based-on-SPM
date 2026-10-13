import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { Badge } from "@/components/ui";
import { formatDate, formatDateTime, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { getFirmSettings, proposalNumber } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { paystackMode } from "@/lib/paystack";
import { can } from "@/lib/permissions";
import { docContext, proposalDoc } from "@/lib/proposal-content";
import { STATUS_LABELS, displayStatus, proposalInclude, publicUrl } from "@/lib/proposals";
import { requirePermission } from "@/lib/session";
import { ProposalBuilder } from "./builder";
import { StatusActions } from "./editor";

export const metadata = { title: "Edit proposal" };

const MODE: Record<string, string> = { live: "Paystack live", test: "Paystack test mode", simulated: "simulated (no Paystack keys set)", off: "online payment off" };

export default async function ProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("proposals.manage");
  const { id } = await params;
  const p = await db.proposal.findUnique({
    where: { id },
    include: { ...proposalInclude, payments: { orderBy: { createdAt: "desc" } }, subscriptions: true, client: { select: { id: true, name: true } }, signedFile: { select: { id: true, name: true } } },
  });
  if (!p) notFound();
  const [services, packages, firm] = await Promise.all([
    db.service.findMany({ where: { active: true }, select: { id: true, name: true, priceCents: true, billingType: true }, orderBy: { position: "asc" } }),
    db.servicePackage.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getFirmSettings(),
  ]);
  const display = displayStatus(p);
  const locked = !["DRAFT", "SENT", "VIEWED"].includes(p.status);
  const doc = proposalDoc(p, firm);

  const statusPanel = (
    <div className="space-y-3">
      {p.client && <Link href={`/clients/${p.client.id}`} className="block rounded-xl bg-white p-4 text-sm text-brand">Client: {p.client.name} →</Link>}
      {locked && <p className="rounded-xl bg-white p-4 text-sm text-muted">Signed and closed proposals can&apos;t be edited.</p>}
      {!locked && p.status !== "DRAFT" && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Already sent. Changes show on the client&apos;s link straight away.</p>}
      <div className="rounded-xl bg-white p-4">
        <StatusActions id={p.id} status={p.status} publicUrl={publicUrl(p.publicToken)} canRecordPayment={can(user.role, "settings.manage")} paid={!!p.paidAt} />
      </div>
          <div className="rounded-xl bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold">Timeline</h2>
            <ul className="space-y-1.5 text-xs">
              <li className="text-muted">Created {formatDateTime(p.createdAt)}</li>
              {p.sentAt && <li>Sent {formatDateTime(p.sentAt)}</li>}
              {p.viewedAt && <li>Opened by client {formatDateTime(p.viewedAt)}</li>}
              {p.signedAt && (
                <li className="text-success">
                  <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Signed {formatDateTime(p.signedAt)}</span>
                  <div className="text-muted">
                    {p.signatureMethod === "CLICK_TO_ACCEPT" ? `Typed name “${p.signedName}” · IP ${p.signedIp}` : p.signedName}
                  </div>
                  {p.signedHash && <div className="break-all font-mono text-[10px] text-muted">SHA-256 {p.signedHash}</div>}
                  {p.signedFile && <a href={`/api/files/${p.signedFile.id}`} className="inline-flex items-center gap-1 text-brand"><FileText size={12} /> {p.signedFile.name}</a>}
                </li>
              )}
              {p.paidAt && <li className="text-success">Paid {formatDateTime(p.paidAt)}</li>}
              {p.acceptedAt && <li className="font-medium text-success">Client set up {formatDateTime(p.acceptedAt)}</li>}
              {p.declinedReason && <li className="text-danger">Declined: {p.declinedReason}</li>}
            </ul>
          </div>

          {(p.payments.length > 0 || p.subscriptions.length > 0) && (
            <div className="rounded-xl bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">Payments</h2>
              <ul className="space-y-2 text-xs">
                {p.payments.map((pay) => (
                  <li key={pay.id} className="flex items-center justify-between gap-2">
                    <span><span className="font-medium">{formatRand(pay.amountCents)}</span> · {pay.provider.toLowerCase()}{pay.channel && ` (${pay.channel})`}<div className="font-mono text-[10px] text-muted">{pay.reference}</div></span>
                    <Badge tone={pay.status === "SUCCESS" ? "success" : pay.status === "FAILED" ? "danger" : "neutral"}>{pay.status.toLowerCase()}</Badge>
                  </li>
                ))}
                {p.subscriptions.map((s) => (
                  <li key={s.id} className="border-t border-border pt-2">
                    <div className="flex items-center justify-between"><span>Retainer {formatRand(s.amountCents)}/mo</span><Badge tone={s.status === "ACTIVE" ? "success" : s.status === "PENDING" ? "neutral" : "danger"}>{s.status.toLowerCase()}</Badge></div>
                    {s.nextPaymentDate && <div className="text-muted">Next charge {formatDate(s.nextPaymentDate, { day: "numeric", month: "short", year: "numeric" })}</div>}
                    {s.lastError && <div className="text-danger">{s.lastError}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
    </div>
  );

  return (
    <ProposalBuilder
      id={p.id}
      number={proposalNumber(p.number)}
      status={p.status}
      statusLabel={STATUS_LABELS[display].label}
      locked={locked}
      expired={display === "EXPIRED"}
      backHref={`/deals/${p.deal.id}`}
      initial={{ title: p.title, validUntil: toISODate(p.validUntil), startDate: p.startDate ? toISODate(p.startDate) : null, doc }}
      ctx={await docContext(p, firm)}
      hasEmail={!!p.deal.email}
      services={services}
      packages={packages}
      canTemplate={can(user.role, "settings.manage")}
      updatedAt={p.updatedAt.toISOString()}
      paymentMode={MODE[paystackMode()] ?? paystackMode()}
      statusPanel={statusPanel}
    />
  );
}
