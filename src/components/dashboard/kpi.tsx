import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui";

/** Stat tile: label, value, optional signed delta vs the previous period (green when it's good news). */
export function Kpi({ label, value, delta, good, hint, alert }: { label: string; value: React.ReactNode; delta?: string | null; good?: boolean | null; hint?: string; alert?: boolean }) {
  const Icon = good === null || good === undefined ? Minus : (delta ?? "").startsWith("-") ? ArrowDownRight : ArrowUpRight;
  return (
    <Card className="p-4">
      <div className="truncate text-xs font-medium text-muted" title={label}>{label}</div>
      <div className={clsx("mt-1 text-2xl font-semibold tabular-nums", alert && "text-danger")}>{value}</div>
      {delta && (
        <div className={clsx("mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium", good === true ? "text-success" : good === false ? "text-danger" : "text-muted")}>
          <Icon size={12} /> {delta}
        </div>
      )}
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 mt-8">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
    </div>
  );
}

export function PeriodFilter({ period, options, action }: { period: string; options: { key: string; label: string }[]; action: string }) {
  return (
    <form action={action} className="flex items-center gap-2">
      <select name="period" defaultValue={period} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" aria-label="Period">
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <button className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-background">Apply</button>
    </form>
  );
}
