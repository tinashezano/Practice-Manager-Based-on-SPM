import { PaystackStatus } from "@/components/paystack-status";
import { Button, Card, PageHeader } from "@/components/ui";
import { DEFAULT_TERMS, DEFAULT_WELCOME, getFirmSettings } from "@/lib/firm";
import { requirePermission } from "@/lib/session";
import { resetProposalTemplate } from "./actions";
import { FirmForm } from "./form";

export const metadata = { title: "Proposals & billing" };

export default async function BillingSettingsPage() {
  await requirePermission("settings.manage");
  const s = await getFirmSettings();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Proposals & billing" subtitle="Firm details, VAT, default terms and the welcome pack used on proposals." />
      <div className="mb-6"><PaystackStatus /></div>
      <Card className="mb-6">
        <h2 className="text-sm font-semibold">Proposal template</h2>
        {s.proposalTemplate ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">New proposals start from the layout you saved in the proposal builder, including its terms. The default terms below are not used while it is saved.</p>
            <form action={resetProposalTemplate}><Button variant="secondary">Reset to the built-in layout</Button></form>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">New proposals use the built-in layout with the default terms below. To customise it, edit any proposal and click &quot;Save this layout as the template for new proposals&quot;.</p>
        )}
      </Card>
      <FirmForm s={s} defaults={{ terms: DEFAULT_TERMS, welcome: DEFAULT_WELCOME }} />
    </div>
  );
}
