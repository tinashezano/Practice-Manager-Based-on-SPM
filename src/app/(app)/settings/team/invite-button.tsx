"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { inviteStaff, type ActionState } from "./actions";

/** Shows an invite link with a copy button (for WhatsApp or another email when Gmail isn't connected). */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mt-1 flex items-center gap-1.5">
      <input readOnly value={url} onFocus={(e) => e.target.select()} className="w-56 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]" aria-label="Invite link" />
      <button
        type="button"
        onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-background"
      >
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </span>
  );
}

export function InviteButton({ userId, label }: { userId: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteStaff, {});
  return (
    <form action={action} className="text-xs">
      <input type="hidden" name="userId" value={userId} />
      <Button variant="secondary" disabled={pending}>{pending ? "Sending…" : label}</Button>
      {state.error && <p className="mt-1 text-danger">{state.error}</p>}
      {state.ok && <p className="mt-1 text-success">{state.ok}</p>}
      {state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
