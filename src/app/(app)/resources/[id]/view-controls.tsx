"use client";

import { CheckCircle2, Paperclip, X } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/tasks/use-action";
import { Button } from "@/components/ui";
import { ACCEPT_ATTR, formatBytes } from "@/lib/file-meta";
import { acknowledge, removeResourceFile, uploadResourceFiles } from "../actions";

export function AcknowledgeButton({ id, version, readAt }: { id: string; version: number; readAt: string | null }) {
  const { run, pending, toast } = useAction();
  const [done, setDone] = useState(!!readAt);
  if (done) return <span className="inline-flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={16} /> You&apos;ve read version {version}{readAt && ` (${readAt})`}</span>;
  return (
    <>
      {toast}
      <Button disabled={pending} onClick={() => run(() => acknowledge(id), () => setDone(true))}><CheckCircle2 size={15} /> I&apos;ve read this</Button>
    </>
  );
}

export function Attachments({ id, files, canEdit }: { id: string; files: { id: string; name: string; size: number }[]; canEdit: boolean }) {
  const { run, pending, toast } = useAction();
  return (
    <div>
      {toast}
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id} className="group flex items-center gap-2 text-sm">
            <Paperclip size={13} className="text-muted" />
            <a href={`/api/files/${f.id}?view=1`} target="_blank" className="truncate text-brand hover:underline">{f.name}</a>
            <span className="text-xs text-muted">{formatBytes(f.size)}</span>
            {canEdit && <button onClick={() => confirm(`Remove ${f.name}?`) && run(() => removeResourceFile(f.id))} className="ml-auto text-muted opacity-0 hover:text-danger group-hover:opacity-100" aria-label={`Remove ${f.name}`}><X size={13} /></button>}
          </li>
        ))}
        {!files.length && <li className="text-xs text-muted">No attachments.</li>}
      </ul>
      {canEdit && (
        <form action={(fd) => run(() => uploadResourceFiles(id, fd))} className="mt-2 flex items-center gap-2">
          <input type="file" name="files" multiple accept={ACCEPT_ATTR} className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-soft file:px-2.5 file:py-1 file:text-brand" />
          <Button variant="secondary" disabled={pending}>Upload</Button>
        </form>
      )}
    </div>
  );
}
