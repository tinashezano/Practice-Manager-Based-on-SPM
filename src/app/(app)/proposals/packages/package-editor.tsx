"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/tasks/use-action";
import { Button, inputClass } from "@/components/ui";
import { parseRand } from "@/lib/money";
import { savePackage } from "../actions";

type Svc = { id: string; name: string; priceCents: number; billingType: "ONCE_OFF" | "MONTHLY" };
type Pkg = { id: string; name: string; description: string | null; active: boolean; items: { serviceId: string; quantity: number; priceCents: number | null }[] };

function Editor({ pkg, services, onDone }: { pkg?: Pkg; services: Svc[]; onDone: () => void }) {
  const { run, pending, toast } = useAction();
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [active, setActive] = useState(pkg?.active ?? true);
  const [items, setItems] = useState(pkg?.items.map((i) => ({ ...i, price: i.priceCents === null ? "" : (i.priceCents / 100).toFixed(2) })) ?? []);

  return (
    <div className="space-y-3">
      {toast}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Package name, e.g. Small Business Starter" className={inputClass} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short description" className={inputClass} />
      <div className="space-y-2">
        {items.map((it, i) => {
          const svc = services.find((s) => s.id === it.serviceId);
          return (
            <div key={i} className="grid grid-cols-[1fr_70px_130px_32px] items-center gap-2">
              <select value={it.serviceId} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, serviceId: e.target.value } : x)))} className={inputClass}>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.billingType === "MONTHLY" ? "monthly" : "once-off"})</option>)}
              </select>
              <input type="number" min={1} value={it.quantity} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 1 } : x)))} className={inputClass} aria-label="Quantity" />
              <input value={it.price} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder={svc ? `${(svc.priceCents / 100).toFixed(2)}` : "Price"} className={inputClass} aria-label="Package price excl. VAT" title="Leave blank to use the service price" />
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-muted hover:text-danger" aria-label="Remove"><Trash2 size={15} /></button>
            </div>
          );
        })}
        {services.length > 0 && (
          <button onClick={() => setItems([...items, { serviceId: services[0]!.id, quantity: 1, priceCents: null, price: "" }])} className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand">
            <Plus size={13} /> Add service
          </button>
        )}
        <p className="text-xs text-muted">Leave the price blank to use the catalogue price, or enter a package price (excl. VAT).</p>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button
          disabled={pending}
          onClick={() => {
            const parsed = items.map((it) => ({ serviceId: it.serviceId, quantity: it.quantity, priceCents: it.price.trim() ? parseRand(it.price) : null }));
            if (parsed.some((p, i) => items[i]!.price.trim() && p.priceCents === null)) return alert("Check the package prices: use numbers like 2500 or 2500.50");
            run(() => savePackage({ id: pkg?.id ?? null, name, description: description || null, active, items: parsed }), onDone);
          }}
        >
          {pending ? "Saving…" : "Save package"}
        </Button>
      </div>
    </div>
  );
}

export function PackageButton({ pkg, services }: { pkg?: Pkg; services: Svc[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {pkg ? (
        <button onClick={() => setOpen(true)} className="rounded p-1 text-muted hover:bg-background hover:text-foreground" aria-label={`Edit ${pkg.name}`}><Pencil size={14} /></button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus size={15} /> New package</Button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-surface p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-base font-semibold">{pkg ? `Edit ${pkg.name}` : "New package"}</h2>
            <Editor pkg={pkg} services={services} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

