"use client";

import { Upload } from "lucide-react";
import { useActionState, useRef } from "react";
import { Button, inputClass } from "@/components/ui";
import type { UploadState } from "./actions";

export function ItemForm({ action, allowsText, accept, again }: { action: (s: UploadState, fd: FormData) => Promise<UploadState>; allowsText: boolean; accept: string; again: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={formAction} className="mt-3 space-y-2">
      {allowsText && <textarea name="answer" rows={2} placeholder="Type your answer here, or upload a file" className={inputClass} />}
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" name="files" multiple accept={accept} className="max-w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-brand" />
        <Button disabled={pending} variant={again ? "secondary" : "primary"}><Upload size={14} /> {pending ? "Uploading…" : again ? "Send again" : "Send"}</Button>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
