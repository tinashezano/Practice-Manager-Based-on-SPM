import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getFirmSettings } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { EditService, NewService } from "./service-form";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const user = await requirePermission("proposals.manage");
  const manage = can(user.role, "settings.manage");
  const [services, templates, firm] = await Promise.all([
    db.service.findMany({ include: { template: { select: { name: true } } }, orderBy: [{ active: "desc" }, { billingType: "desc" }, { position: "asc" }] }),
    db.projectTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getFirmSettings(),
  ]);
  const vat = firm.vatRegistered ? firm.vatRatePercent : 0;

  return (
    <>
      <PageHeader
        title="Services"
        subtitle={`Your service catalogue. Prices exclude VAT${vat ? `; ${vat}% VAT is added on proposals` : ""}.${manage ? "" : " Only Directors can change prices."}`}
        actions={manage && <NewService templates={templates} />}
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Service</th>
              <th className="px-3 py-3 font-medium">Billing</th>
              <th className="px-3 py-3 text-right font-medium">Price excl. VAT</th>
              <th className="px-3 py-3 text-right font-medium">Incl. VAT</th>
              <th className="px-3 py-3 font-medium">Sets up</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className={`border-b border-border last:border-0 ${s.active ? "" : "opacity-50"}`}>
                <td className="px-5 py-3">
                  <div className="font-medium">{s.name} {!s.active && <Badge>Inactive</Badge>}</div>
                  {s.description && <div className="max-w-xl truncate text-xs text-muted">{s.description}</div>}
                </td>
                <td className="px-3 py-3"><Badge tone={s.billingType === "MONTHLY" ? "brand" : "neutral"}>{s.billingType === "MONTHLY" ? "Monthly" : "Once-off"}</Badge></td>
                <td className="px-3 py-3 text-right">{formatRand(s.priceCents)}</td>
                <td className="px-3 py-3 text-right text-muted">{formatRand(s.priceCents + (s.taxable ? Math.round((s.priceCents * vat) / 100) : 0))}</td>
                <td className="px-3 py-3 text-xs text-muted">{s.template?.name ?? "Blank project"}</td>
                <td className="px-5 py-3 text-right">{manage && <EditService service={s} templates={templates} />}</td>
              </tr>
            ))}
            {!services.length && <tr><td colSpan={6} className="py-12 text-center text-muted">No services yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
