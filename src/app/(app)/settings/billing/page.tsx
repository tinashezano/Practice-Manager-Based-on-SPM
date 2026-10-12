import { PaystackStatus } from "@/components/paystack-status";
import { PageHeader } from "@/components/ui";
import { DEFAULT_TERMS, DEFAULT_WELCOME, getFirmSettings } from "@/lib/firm";
import { requirePermission } from "@/lib/session";
import { FirmForm } from "./form";

export const metadata = { title: "Proposals & billing" };

export default async function BillingSettingsPage() {
  await requirePermission("settings.manage");
  const s = await getFirmSettings();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Proposals & billing" subtitle="Firm details, VAT, default terms and the welcome pack used on proposals." />
      <div className="mb-6"><PaystackStatus /></div>
      <FirmForm s={s} defaults={{ terms: DEFAULT_TERMS, welcome: DEFAULT_WELCOME }} />
    </div>
  );
}
