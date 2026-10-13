import { notFound } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { ProposalPages } from "@/components/proposal/document";
import { auth } from "@/auth";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { getFirmSettings } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { paystackMode } from "@/lib/paystack";
import { docContext, proposalDoc } from "@/lib/proposal-content";
import { displayStatus, markViewed, proposalInclude, totalsOf } from "@/lib/proposals";
import { accept, pay } from "../actions";
import { AcceptForm, PayForm } from "../forms";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your proposal", robots: { index: false } };

export default async function PublicProposalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ signed?: string; paid?: string; failed?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const p = await db.proposal.findUnique({ where: { publicToken: token }, include: proposalInclude });
  if (!p || p.status === "DRAFT" || p.status === "WITHDRAWN") notFound();

  // Staff opening the client link don't count as the client viewing it.
  if (!(await auth())?.user) await markViewed(p);

  const firm = await getFirmSettings();
  const status = displayStatus(p);
  const t = totalsOf(p);
  const mode = paystackMode();

  const doc = proposalDoc(p, firm);
  const signed = status === "SIGNED" || status === "ACCEPTED";

  // Accepting, paying and the outcome sit at the end of the terms page.
  const panel = (
    <div className="mt-8 rounded-2xl border border-[#e4e2dc] bg-white p-6 print:hidden">
      {status === "EXPIRED" && <p className="text-sm">This proposal expired. Please contact us and we&apos;ll send you an updated one.</p>}
      {status === "DECLINED" && <p className="text-sm">This proposal was declined.</p>}

      {(status === "SENT" || status === "VIEWED") && (
        <>
          <h2 className="mb-3 text-base font-semibold">Accept this proposal</h2>
          <AcceptForm action={accept.bind(null, token)} contactName={p.deal.contactName} />
        </>
      )}

      {status === "SIGNED" && !p.paidAt && (
        <>
          <div className="mb-4 flex items-center gap-2 text-sm text-success"><CheckCircle2 size={18} /> Signed by {p.signedName}{p.signedAt && ` on ${formatDateTime(p.signedAt)}`}. Thank you!</div>
          {sp.failed && <p className="mb-3 text-sm text-danger">The payment didn&apos;t go through. Please try again.</p>}
          <h2 className="text-base font-semibold">Pay {formatRand(t.dueNow)} to get started</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {t.monthly > 0
              ? `Pay by card. Your card will also be used for the monthly retainer of ${formatRand(t.monthly)}. You can cancel with one month's notice.`
              : "Pay securely by card, instant EFT or other methods offered at checkout."}
          </p>
          <PayForm action={pay.bind(null, token)} label={`Pay ${formatRand(t.dueNow)}`} />
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
            <Lock size={12} /> {mode === "simulated" ? "Development mode: payments are simulated." : `Secure checkout by Paystack${mode === "test" ? " (test mode, use a Paystack test card)" : ""}.`}
          </p>
        </>
      )}

      {(status === "ACCEPTED" || (status === "SIGNED" && p.paidAt)) && (
        <div className="flex items-start gap-3">
          <CheckCircle2 size={28} className="shrink-0 text-success" />
          <div>
            <h2 className="text-base font-semibold">You&apos;re all set. Welcome to {firm.legalName}!</h2>
            <p className="mt-1 text-sm text-muted">
              We&apos;ve received your {t.dueNow ? "payment and " : ""}signed proposal. A welcome email is on its way with the next steps.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen px-4 py-8 print:bg-white print:p-0" style={{ background: doc.theme.background }}>
      <div className="mx-auto mb-4 flex max-w-[760px] justify-end print:hidden"><PrintButton /></div>
      <ProposalPages doc={doc} ctx={await docContext(p, firm)} after={{ terms: panel }} hideThankYou={!signed} />
    </div>
  );
}
