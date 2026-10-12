import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { formatDate, formatDateTime, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { proposalNumber } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { paystackMode } from "@/lib/paystack";
import { can } from "@/lib/permissions";
import { STATUS_LABELS, displayStatus, proposalInclude, publicUrl, totalsOf } from "@/lib/proposals";
import { requirePermission } from "@/lib/session";
import { DetailsForm, LinesEditor, ProposalActions } from "./editor";

export default async function ProposalEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("proposals.manage");
  const { id } = await params;
  const p = await db.proposal.findUnique({
    where: { id },
    include: { ...proposalInclude, payments: { orderBy: { createdAt: "desc" } }, subscriptions: true, client: { select: { id: true, name: true } }, signedFile: { select: { id: true, name: true } } },
  });
  if (!p) notFound();
  const [services, packages] = await Promise.all([
    db.service.findMany({ where: { active: true }, select: { id: true, name: true, priceCents: true, billingType: true }, orderBy: { position: "asc" } }),
    db.servicePackage.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const display = displayStatus(p);
  const locked = !["DRAFT", "SENT", "VIEWED"].includes(p.status);
  const t = totalsOf(p);
  const mode = paystackMode();

  return (
    <>
      <div className="mb-6">
        <Link href={`/deals/${p.deal.id}`} className="text-xs text-muted hover:text-brand">← {p.deal.name}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{proposalNumber(p.number)}</h1>
          <Badge tone={STATUS_LABELS[display].tone}>{STATUS_LABELS[display].label}</Badge>
          {p.client && <Link href={`/clients/${p.client.id}`} className="text-sm text-brand">Client: {p.client.name} →</Link>}
        </div>
        {locked && <p className="mt-1 text-sm text-muted">Signed and closed proposals can&apos;t be edited.</p>}
        {!locked && p.status !== "DRAFT" && <p className="mt-1 text-sm text-warning">Already sent. Changes show on the client&apos;s link straight away.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <DetailsForm
              id={p.id}
              locked={locked}
              initial={{ title: p.title, introduction: p.introduction ?? "", terms: p.terms ?? "", validUntil: toISODate(p.validUntil), startDate: toISODate(p.startDate) }}
            />
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Services</h2>
            <LinesEditor id={p.id} lines={p.lineItems} locked={locked} vat={p.vatRatePercent} services={services} packages={packages} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="space-y-1.5 text-sm">
              {t.onceOff > 0 && <div className="flex justify-between"><span className="text-muted">Once-off</span><span>{formatRand(t.onceOff)}</span></div>}
              {t.monthly > 0 && <div className="flex justify-between"><span className="text-muted">Monthly</span><span>{formatRand(t.monthly)}</span></div>}
              {p.vatRatePercent > 0 && <div className="flex justify-between text-xs text-muted"><span>Incl. VAT {p.vatRatePercent}%</span><span>{formatRand(p.onceOffVat + p.monthlyVat)}</span></div>}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Due on acceptance</span><span>{formatRand(t.dueNow)}</span></div>
              {t.monthly > 0 && <p className="text-xs text-muted">Includes the first month; then {formatRand(t.monthly)} monthly.</p>}
            </div>
          </Card>
          <Card>
            <ProposalActions
              id={p.id}
              status={p.status}
              display={display}
              publicUrl={publicUrl(p.publicToken)}
              canRecordPayment={can(user.role, "settings.manage")}
              hasEmail={!!p.deal.email}
              paid={!!p.paidAt}
            />
            <p className="mt-3 text-[11px] text-muted">
              Payments: {mode === "live" ? "Paystack live" : mode === "test" ? "Paystack test mode" : mode === "simulated" ? "simulated (no Paystack keys set)" : "online payment off"}
            </p>
          </Card>

          <Card>
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
          </Card>

          {(p.payments.length > 0 || p.subscriptions.length > 0) && (
            <Card>
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
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
