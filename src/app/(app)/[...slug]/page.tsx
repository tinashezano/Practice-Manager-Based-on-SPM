import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { findNavItem } from "@/lib/nav";
import { requirePermission, requireUser } from "@/lib/session";

// Screens that aren't built yet render this, so navigation works end-to-end
// from day one. Each real page replaces its entry by adding a concrete route.
export default async function ComingSoon({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const item = findNavItem(`/${slug.join("/")}`);
  if (!item) notFound();
  if (item.permission) await requirePermission(item.permission);
  else await requireUser();

  const Icon = item.icon;
  return (
    <>
      <PageHeader title={item.label} subtitle={item.description} />
      <Card className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon size={22} />
        </div>
        <h2 className="text-base font-semibold">Coming in Phase {item.phase}</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{item.description}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
          <Hammer size={12} /> See docs/PLAN.md for the build schedule.
        </p>
      </Card>
    </>
  );
}
