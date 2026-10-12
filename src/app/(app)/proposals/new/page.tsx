import { notFound } from "next/navigation";
import { Button, Card, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { newProposal } from "../actions";

export const metadata = { title: "New proposal" };

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  await requirePermission("proposals.manage");
  const { deal: dealId } = await searchParams;
  const deal = dealId ? await db.deal.findUnique({ where: { id: dealId } }) : null;
  if (!deal) notFound();
  const packages = await db.servicePackage.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-xl">
      <PageHeader title={`New proposal for ${deal.name}`} subtitle="Start from a package or a blank proposal. You can add and adjust services next." />
      <Card>
        <form action={newProposal} className="space-y-4">
          <input type="hidden" name="dealId" value={deal.id} />
          <label className="block text-xs font-medium text-muted">
            Start from
            <select name="packageId" className={`${inputClass} mt-1`}>
              <option value="">Blank proposal</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {deal.servicesInterest && <p className="text-sm text-muted">They mentioned: {deal.servicesInterest}</p>}
          <Button>Create draft</Button>
        </form>
      </Card>
    </div>
  );
}
