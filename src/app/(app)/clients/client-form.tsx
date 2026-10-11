"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Client } from "@prisma/client";
import { Button, Card, inputClass } from "@/components/ui";
import { CLIENT_STATUS_META, ENTITY_LABELS } from "@/lib/task-meta";
import { saveClient, type FormState } from "./actions";

function L({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-xs font-medium text-muted ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function ClientForm({ client, staff, currentUserId }: { client?: Client; staff: { id: string; name: string }[]; currentUserId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveClient.bind(null, client?.id ?? null), {});
  return (
    <form action={action}>
      <Card className="grid gap-4 sm:grid-cols-2">
        <L label="Client name *" wide>
          <input name="name" required defaultValue={client?.name} placeholder="e.g. Mokoena Trading (Pty) Ltd" className={inputClass} />
        </L>
        <L label="Entity type">
          <select name="entityType" defaultValue={client?.entityType ?? "PRIVATE_COMPANY"} className={inputClass}>
            {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </L>
        <L label="Client owner">
          <select name="ownerId" defaultValue={client?.ownerId ?? currentUserId} className={inputClass}>
            <option value="">No owner</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </L>
        {client && (
          <L label="Status">
            <select name="status" defaultValue={client.status} className={inputClass}>
              {Object.entries(CLIENT_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </L>
        )}
        <L label="CIPC registration number"><input name="registrationNumber" defaultValue={client?.registrationNumber ?? ""} placeholder="2024/123456/07" className={inputClass} /></L>
        <L label="SARS income tax number"><input name="taxNumber" defaultValue={client?.taxNumber ?? ""} className={inputClass} /></L>
        <L label="VAT number"><input name="vatNumber" defaultValue={client?.vatNumber ?? ""} className={inputClass} /></L>
        <L label="Email"><input name="email" type="email" defaultValue={client?.email ?? ""} className={inputClass} /></L>
        <L label="Phone"><input name="phone" defaultValue={client?.phone ?? ""} className={inputClass} /></L>
        <L label="Address" wide><input name="address" defaultValue={client?.address ?? ""} className={inputClass} /></L>
        <L label="Notes" wide><textarea name="notes" rows={3} defaultValue={client?.notes ?? ""} className={inputClass} /></L>
        {state.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Link href={client ? `/clients/${client.id}` : "/clients"}><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button disabled={pending}>{pending ? "Saving…" : client ? "Save changes" : "Create client"}</Button>
        </div>
      </Card>
    </form>
  );
}
