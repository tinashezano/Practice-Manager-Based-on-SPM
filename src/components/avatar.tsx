import clsx from "clsx";
import { initials } from "@/components/ui";

const COLORS = ["bg-indigo-100 text-indigo-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700"];

function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({ user, size = "sm" }: { user: { id: string; name: string } | null | undefined; size?: "xs" | "sm" | "md" }) {
  const dims = size === "xs" ? "h-5 w-5 text-[9px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (!user) {
    return <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted", dims)} title="Unassigned">?</span>;
  }
  return (
    <span title={user.name} className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", dims, colorFor(user.id))}>
      {initials(user.name)}
    </span>
  );
}
