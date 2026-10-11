export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
        O
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-brand-ink">Outset</div>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-brand">PRACTICE MANAGER</div>
        </div>
      )}
    </div>
  );
}
