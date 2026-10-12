import { Badge, Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { getFirmSettings } from "@/lib/firm";
import { computeTotals, dueNow, formatRand, monthlyTotal } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { PackageButton } from "./package-editor";

export const metadata = { title: "Service Packages" };

export default async function PackagesPage() {
  const user = await requirePermission("proposals.manage");
  const manage = can(user.role, "settings.manage");
  const [packages, services, firm] = await Promise.all([
    db.servicePackage.findMany({ include: { items: { include: { service: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.service.findMany({ where: { active: true }, select: { id: true, name: true, priceCents: true, billingType: true }, orderBy: { position: "asc" } }),
    getFirmSettings(),
  ]);
  const vat = firm.vatRegistered ? firm.vatRatePercent : 0;

  return (
    <>
      <PageHeader title="Service Packages" subtitle="Bundles you can drop into a proposal in one click." actions={manage && <PackageButton services={services} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((p) => {
          const t = computeTotals(p.items.map((i) => ({ billingType: i.service.billingType, quantity: i.quantity, unitPriceCents: i.priceCents ?? i.service.priceCents, taxable: i.service.taxable })), vat);
          return (
            <Card key={p.id} className={p.active ? "" : "opacity-60"}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name} {!p.active && <Badge>Inactive</Badge>}</div>
                  {p.description && <p className="mt-0.5 text-xs text-muted">{p.description}</p>}
                </div>
                {manage && <PackageButton pkg={{ id: p.id, name: p.name, description: p.description, active: p.active, items: p.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity, priceCents: i.priceCents })) }} services={services} />}
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {p.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span>{i.quantity > 1 && `${i.quantity} × `}{i.service.name}</span>
                    <span className="text-muted">{formatRand(i.priceCents ?? i.service.priceCents)}{i.service.billingType === "MONTHLY" && "/mo"}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-border pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">Due on acceptance</span><span className="font-semibold">{formatRand(dueNow(t))}</span></div>
                {monthlyTotal(t) > 0 && <div className="flex justify-between"><span className="text-muted">Then monthly</span><span>{formatRand(monthlyTotal(t))}</span></div>}
                {vat > 0 && <div className="text-xs text-muted">Incl. {vat}% VAT</div>}
              </div>
            </Card>
          );
        })}
        {!packages.length && <Card className="text-sm text-muted">No packages yet.</Card>}
      </div>
    </>
  );
}
