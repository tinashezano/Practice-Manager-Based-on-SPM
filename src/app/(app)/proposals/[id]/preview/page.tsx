import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalDocument } from "@/components/public/proposal-view";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { getFirmSettings, proposalNumber } from "@/lib/firm";
import { proposalInclude } from "@/lib/proposals";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Preview proposal" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("proposals.manage");
  const { id } = await params;
  const p = await db.proposal.findUnique({ where: { id }, include: proposalInclude });
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/proposals/${id}`} className="text-xs text-muted hover:text-brand">← Back to editor</Link>
      <p className="mb-3 mt-1 text-sm text-muted">This is what the client will see.</p>
      <Card className="p-8"><ProposalDocument p={p} firm={await getFirmSettings()} number={proposalNumber(p.number)} /></Card>
    </div>
  );
}
