import clsx from "clsx";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileText, Lock, RotateCcw } from "lucide-react";
import { PublicShell } from "@/components/public/shell";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { getFirmSettings } from "@/lib/firm";
import { progress } from "@/lib/onboarding";
import { ACCEPT_ATTR, formatBytes } from "@/lib/storage";
import { submitItem } from "../actions";
import { ItemForm } from "../item-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload your documents", robots: { index: false } };

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await db.onboarding.findUnique({
    where: { uploadToken: token },
    include: {
      client: { select: { name: true } },
      items: { where: { kind: "INFO" }, orderBy: { position: "asc" }, include: { files: { include: { file: { select: { name: true, size: true } } } } } },
    },
  });
  if (!o) notFound();
  const firm = await getFirmSettings();
  const pr = progress(o.items);
  const complete = o.stage === "COMPLETE";

  return (
    <PublicShell>
      <Card className="mb-4 p-6">
        <h1 className="text-xl font-semibold">Documents for {o.client.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {complete
            ? "Your onboarding is complete. Thank you! This page is now closed."
            : `Upload what we need to set up your account. You can do this in parts: the link stays active until we're done. ${pr.infoReceived} of ${pr.infoTotal} sent.`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full bg-success" style={{ width: `${pr.infoTotal ? (pr.infoReceived / pr.infoTotal) * 100 : 0}%` }} /></div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted"><Lock size={12} /> Files go straight to {firm.legalName}&apos;s secure system and are handled in line with POPIA. Please don&apos;t send passwords here.</p>
      </Card>

      <div className="space-y-3">
        {o.items.map((item) => {
          const accepted = item.status === "ACCEPTED" || item.status === "NOT_APPLICABLE";
          const received = item.status === "RECEIVED";
          const rejected = item.status === "REJECTED";
          return (
            <Card key={item.id} className={clsx("p-5", rejected && "border-amber-300")}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5">
                  {accepted ? <CheckCircle2 size={20} className="text-success" /> : received ? <Clock size={20} className="text-brand" /> : rejected ? <RotateCcw size={20} className="text-warning" /> : <span className="block h-5 w-5 rounded-full border-2 border-border" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.label}</span>
                    {!item.required && <span className="text-xs text-muted">(if applicable)</span>}
                  </div>
                  {item.description && <p className="text-sm text-muted">{item.description}</p>}
                  {accepted && <p className="mt-1 text-sm text-success">{item.status === "NOT_APPLICABLE" ? "Not needed, thanks." : "Received and checked. Thank you!"}</p>}
                  {received && <p className="mt-1 text-sm text-brand">Received. We&apos;ll check it shortly.</p>}
                  {rejected && item.staffNote && <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-warning">Please send again: {item.staffNote}</p>}
                  {item.files.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
                      {item.files.map((f) => <li key={f.id} className="flex items-center gap-1"><FileText size={12} /> {f.file.name} · {formatBytes(f.file.size)}</li>)}
                    </ul>
                  )}
                  {item.clientAnswer && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">Your answer: {item.clientAnswer}</p>}
                  {!complete && !accepted && <ItemForm action={submitItem.bind(null, token, item.id)} allowsText={item.allowsText} accept={ACCEPT_ATTR} again={received} />}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PublicShell>
  );
}
