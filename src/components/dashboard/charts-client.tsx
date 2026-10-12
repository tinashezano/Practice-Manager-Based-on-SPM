"use client";

// Thin client wrappers so server pages can pass plain data and pick a formatter by name.
import { BarList, LineChart, ORDINAL, SplitBar } from "@/components/charts";
import { formatRand } from "@/lib/money";

const rand0 = (c: number) => formatRand(c).replace(/\.\d\d$/, "");
const compactRand = (c: number) => {
  const r = c / 100;
  return r >= 1_000_000 ? `R${(r / 1_000_000).toFixed(1).replace(/\.0$/, "")}m` : r >= 1000 ? `R${Math.round(r / 1000)}k` : `R${Math.round(r)}`;
};

export function RevenueTrend(props: { labels: string[]; tickLabels: string[]; revenue: number[]; work: number[] }) {
  return (
    <LineChart
      labels={props.labels}
      tickLabels={props.tickLabels}
      series={[{ name: "Revenue received", values: props.revenue }, { name: "Work value (billable time)", values: props.work }]}
      format={rand0}
      compact={compactRand}
    />
  );
}

export function RandBars({ rows, ordinal }: { rows: { label: string; value: number; note?: string }[]; ordinal?: boolean }) {
  return <BarList rows={rows} format={rand0} colors={ordinal ? ORDINAL : undefined} />;
}

export function RevenueSplit({ recurring, onceOff, recurringSub, onceOffSub }: { recurring: number; onceOff: number; recurringSub: string; onceOffSub: string }) {
  return <SplitBar parts={[{ label: "Recurring (retainers)", value: recurring, sub: recurringSub }, { label: "Once-off", value: onceOff, sub: onceOffSub }]} format={rand0} />;
}
