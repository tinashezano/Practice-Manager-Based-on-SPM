// Shown instantly while a page loads, so navigation feels immediate.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-2 h-6 w-48 rounded-md bg-border" />
      <div className="mb-6 h-4 w-80 max-w-full rounded-md bg-border/70" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-xl bg-surface shadow-sm" />)}
      </div>
      <div className="space-y-2 rounded-xl bg-surface p-4 shadow-sm">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-9 rounded-md bg-background" />)}
      </div>
    </div>
  );
}
