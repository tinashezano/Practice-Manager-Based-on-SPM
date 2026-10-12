"use client";

import { Copy, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { BookingLink } from "@prisma/client";
import { Button } from "@/components/ui";
import { BookingLinkForm } from "./link-form";

export function NewLinkButton(props: { staff: { id: string; name: string }[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus size={15} /> New booking link</Button>;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16" onClick={() => setOpen(false)}>
      <div className="w-full max-w-2xl rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-base font-semibold">New booking link</h2>
        <BookingLinkForm {...props} onDone={() => setOpen(false)} />
      </div>
    </div>
  );
}

export function EditLink({ link, staff, currentUserId }: { link: BookingLink; staff: { id: string; name: string }[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-background"><Pencil size={12} /> {open ? "Close" : "Edit"}</button>
      {open && <div className="mt-4 basis-full border-t border-border pt-4"><BookingLinkForm link={link} staff={staff} currentUserId={currentUserId} onDone={() => setOpen(false)} /></div>}
    </>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-background"
    >
      <Copy size={12} /> {copied ? "Copied" : "Copy link"}
    </button>
  );
}
