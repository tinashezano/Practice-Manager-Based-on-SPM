"use client";

import clsx from "clsx";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { Resource } from "@prisma/client";
import { Markdown } from "@/components/markdown";
import { Button, Card, inputClass } from "@/components/ui";
import { toISODate } from "@/lib/dates";
import { STATUS_META, TYPE_META } from "@/lib/resource-meta";
import { saveResourceAction, type FormState } from "./actions";

const STARTER = `## Purpose
What this procedure is for and when to use it.

## Before you start
- What you need (access, documents)

## Steps
1. First step
2. Second step

## Checks
- [ ] Reviewed by a second person

> Tip: keep each step short and specific.`;

function L({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={clsx("block text-xs font-medium text-muted", className)}>{label}<div className="mt-1">{children}</div></label>;
}

export function ResourceForm({ resource, staff, categories, currentUserId }: { resource?: Resource; staff: { id: string; name: string }[]; categories: string[]; currentUserId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResourceAction.bind(null, resource?.id ?? null), {});
  const [body, setBody] = useState(resource?.body ?? STARTER);
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <form action={action} className="space-y-4">
      <Card className="grid gap-4 sm:grid-cols-4">
        <L label="Title" className="sm:col-span-4"><input name="title" required defaultValue={resource?.title} placeholder="e.g. Submitting a VAT201 return" className={`${inputClass} text-base font-semibold`} /></L>
        <L label="One-line summary (shown on tasks and in search)" className="sm:col-span-4"><input name="summary" defaultValue={resource?.summary ?? ""} className={inputClass} /></L>
        <L label="Type">
          <select name="type" defaultValue={resource?.type ?? "SOP"} className={inputClass}>
            {Object.entries(TYPE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </L>
        <L label="Category">
          <input name="category" required list="categories" defaultValue={resource?.category ?? ""} className={inputClass} />
          <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </L>
        <L label="Status">
          <select name="status" defaultValue={resource?.status ?? "DRAFT"} className={inputClass}>
            {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </L>
        <L label="Owner">
          <select name="ownerId" defaultValue={resource?.ownerId ?? currentUserId} className={inputClass}>
            <option value="">Nobody</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </L>
        <L label="Next review" className="sm:col-span-1"><input type="date" name="reviewDue" defaultValue={toISODate(resource?.reviewDue)} className={inputClass} /></L>
        <L label="Tags (comma separated)" className="sm:col-span-2"><input name="tags" defaultValue={resource?.tags.join(", ")} placeholder="vat, efiling, sars" className={inputClass} /></L>
        <L label="Video walkthrough (YouTube, Loom, Vimeo link)"><input name="videoUrl" defaultValue={resource?.videoUrl ?? ""} className={inputClass} /></L>
      </Card>

      <Card className="p-0">
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          {(["write", "preview"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setTab(t)} className={clsx("rounded-md px-3 py-1 text-sm capitalize", tab === t ? "bg-brand-soft font-medium text-brand" : "text-muted hover:text-foreground")}>{t}</button>
          ))}
          <span className="ml-auto text-[11px] text-muted"># heading · **bold** · - list · 1. steps · [link](https://…) · - [ ] checklist · | table |</span>
        </div>
        <input type="hidden" name="body" value={body} />
        {tab === "write" ? (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={24} className="w-full resize-y rounded-b-xl border-0 p-4 font-mono text-[13px] outline-none" aria-label="Content" />
        ) : (
          <div className="min-h-96 p-5"><Markdown>{body}</Markdown></div>
        )}
      </Card>

      <Card className="flex flex-wrap items-end gap-3">
        {resource && <L label="What changed? (saved with the version)" className="min-w-64 flex-1"><input name="changeNote" className={inputClass} /></L>}
        {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
        <div className="ml-auto flex gap-2">
          <Link href={resource ? `/resources/${resource.id}` : "/resources"}><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </Card>
    </form>
  );
}
