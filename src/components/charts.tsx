"use client";

import { useEffect, useRef, useState } from "react";

// Hand-rolled SVG charts following the dataviz rules: one y-axis, thin marks,
// hairline solid grid, legend for 2+ series, hover tooltips, and a table view.
// Palette (validated): series 1 #2a78d6, series 2 #eb6834; ordinal ramp
// #86b6ef → #3987e5 → #256abf → #184f95.

export const SERIES = ["#2a78d6", "#eb6834"] as const;
export const ORDINAL = ["#86b6ef", "#3987e5", "#256abf", "#184f95"] as const;
const GRID = "#e6e8f2";
const MUTED = "#6b7090";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e!.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function LegendKey({ color, label, kind = "line" }: { color: string; label: string; kind?: "line" | "box" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      {kind === "line" ? <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} /> : <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
      {label}
    </span>
  );
}

export function LineChart({
  labels,
  tickLabels,
  series,
  format,
  compact,
  height = 200,
}: {
  labels: string[];
  tickLabels: string[];
  series: { name: string; values: number[] }[];
  format: (n: number) => string;
  compact: (n: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 52, r: 16, t: 10, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => pad.t + h - (v / max) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / rect.width) * (n - 1)))));
  }

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex gap-4">{series.map((s, i) => <LegendKey key={s.name} color={SERIES[i]!} label={s.name} />)}</div>
      )}
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.name).join(" and ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED}>{compact(t)}</text>
            </g>
          ))}
          {tickLabels.map((t, i) =>
            t ? <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill={MUTED}>{t}</text> : null,
          )}
          {series.map((s, si) => (
            <path
              key={s.name}
              d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("")}
              fill="none"
              stroke={SERIES[si]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {series.map((s, si) => (
            <circle key={s.name} cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={SERIES[si]} stroke="#fff" strokeWidth={2} />
          ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke={MUTED} strokeWidth={1} />
              {series.map((s, si) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={SERIES[si]} stroke="#fff" strokeWidth={2} />)}
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
            style={x(hover) > width - 240 ? { right: width - x(hover) + 10, top: 8 } : { left: x(hover) + 10, top: 8 }}
          >
            <div className="mb-1 text-muted">{labels[hover]}</div>
            {series.map((s, si) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES[si] }} />
                <span className="font-semibold text-foreground">{format(s.values[hover] ?? 0)}</span>
                <span className="text-muted">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full">
            <thead><tr className="text-left text-muted"><th className="py-1 font-medium">Date</th>{series.map((s) => <th key={s.name} className="py-1 text-right font-medium">{s.name}</th>)}</tr></thead>
            <tbody>{labels.map((l, i) => <tr key={l} className="border-t border-border"><td className="py-1">{l}</td>{series.map((s) => <td key={s.name} className="py-1 text-right tabular-nums">{format(s.values[i] ?? 0)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Horizontal bars, one series. Value at the bar tip; hover lifts the bar. */
export function BarList({ rows, format, colors }: { rows: { label: string; value: number; note?: string }[]; format: (n: number) => string; colors?: readonly string[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}{r.note && <span className="ml-1.5 text-xs text-muted">{r.note}</span>}</span>
            <span className="shrink-0 font-medium tabular-nums">{format(r.value)}</span>
          </div>
          <div className="h-3 rounded-r bg-background">
            <div
              className="h-3 rounded-r transition-opacity"
              style={{ width: `${r.value ? Math.max(1.5, (r.value / max) * 100) : 0}%`, background: colors?.[i] ?? SERIES[0], opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two-part 100% bar (e.g. recurring vs once-off) with a 2px surface gap. */
export function SplitBar({ parts, format }: { parts: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded bg-background">
        {total > 0 && parts.map((p, i) => p.value > 0 && <div key={p.label} title={`${p.label}: ${format(p.value)}`} style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i] }} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {parts.map((p, i) => (
          <div key={p.label}>
            <LegendKey color={SERIES[i]!} label={p.label} kind="box" />
            <div className="mt-0.5 text-lg font-semibold">{format(p.value)} <span className="text-xs font-normal text-muted">({total ? Math.round((p.value / total) * 100) : 0}%)</span></div>
            {p.sub && <div className="text-xs text-muted">{p.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
