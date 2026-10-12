"use client";

import { useActionState, useState } from "react";
import type { BookingLink } from "@prisma/client";
import { Button, inputClass } from "@/components/ui";
import { saveBookingLink, type FormState } from "./actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted">{label}<div className="mt-1">{children}</div></label>;
}

export function BookingLinkForm({ link, staff, currentUserId, onDone }: { link?: BookingLink; staff: { id: string; name: string }[]; currentUserId: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (s, fd) => {
    const r = await saveBookingLink(s, fd);
    if (r.ok) onDone?.();
    return r;
  }, {});
  const [slug, setSlug] = useState(link?.slug ?? "");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      {link && <input type="hidden" name="id" value={link.id} />}
      <div className="sm:col-span-2"><L label="Title"><input name="title" required defaultValue={link?.title ?? "Discovery Call"} className={inputClass} onChange={(e) => !link && setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))} /></L></div>
      <div className="sm:col-span-2"><L label="Link address (/book/…)"><input name="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="discovery-call" className={inputClass} /></L></div>
      <div className="sm:col-span-4"><L label="Description shown to the lead"><input name="description" defaultValue={link?.description ?? "A free 30-minute call to understand your business and how Outset can help."} className={inputClass} /></L></div>
      <L label="Host">
        <select name="hostId" defaultValue={link?.hostId ?? currentUserId} className={inputClass}>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </L>
      <L label="Length (minutes)"><input name="durationMinutes" type="number" min={10} max={240} defaultValue={link?.durationMinutes ?? 30} className={inputClass} /></L>
      <L label="Buffer between calls (min)"><input name="bufferMinutes" type="number" min={0} max={120} defaultValue={link?.bufferMinutes ?? 15} className={inputClass} /></L>
      <L label="Minimum notice (hours)"><input name="minNoticeHours" type="number" min={0} defaultValue={link?.minNoticeHours ?? 12} className={inputClass} /></L>
      <L label="From (SAST)"><input name="startTime" type="time" defaultValue={link?.startTime ?? "09:00"} className={inputClass} /></L>
      <L label="Until (SAST)"><input name="endTime" type="time" defaultValue={link?.endTime ?? "16:30"} className={inputClass} /></L>
      <L label="Bookable days ahead"><input name="maxDaysAhead" type="number" min={1} max={90} defaultValue={link?.maxDaysAhead ?? 21} className={inputClass} /></L>
      <div className="sm:col-span-4">
        <span className="text-xs font-medium text-muted">Days</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <input type="checkbox" name="days" value={i + 1} defaultChecked={(link?.days ?? [1, 2, 3, 4, 5]).includes(i + 1)} /> {d}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isDefault" defaultChecked={link?.isDefault ?? true} /> Default link (emailed to new leads automatically)</label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={link?.active ?? true} /> Active</label>
      {(state.error || state.ok) && <p className={`text-sm sm:col-span-4 ${state.error ? "text-danger" : "text-success"}`}>{state.error ?? state.ok}</p>}
      <div className="flex justify-end gap-2 sm:col-span-4">
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
        <Button disabled={pending}>{pending ? "Saving…" : link ? "Save link" : "Create link"}</Button>
      </div>
    </form>
  );
}
