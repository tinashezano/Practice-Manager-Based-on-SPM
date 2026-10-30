import { notFound } from "next/navigation";
import { DocumentView } from "@/components/proposal/document";
import { db } from "@/lib/db";
import { getFirmSettings } from "@/lib/firm";
import { docContext, proposalDoc } from "@/lib/proposal-content";
import type { Responses } from "@/lib/proposal-doc";
import { proposalInclude } from "@/lib/proposals";
import { requirePermission } from "@/lib/session";
import { PreviewBar } from "./preview-bar";

export const metadata = { title: "Proposal preview" };

// Staff preview of exactly what the client sees, and the print / PDF version.
export default async function ProposalPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  await requirePermission("proposals.manage");
  const { id } = await params;
  const { print } = await searchParams;
  const p = await db.proposal.findUnique({ where: { id }, include: proposalInclude });
  if (!p) notFound();
  const firm = await getFirmSettings();
  const doc = proposalDoc(p, firm);
  return (
    <div className="min-h-screen bg-[#eef0f7] py-6 print:bg-white print:py-0">
      <PreviewBar autoPrint={print === "1"} />
      <div className="px-4 print:px-0">
        <DocumentView doc={doc} ctx={await docContext(p, firm)} responses={p.clientResponses as Responses | null} />
      </div>
    </div>
  );
}
