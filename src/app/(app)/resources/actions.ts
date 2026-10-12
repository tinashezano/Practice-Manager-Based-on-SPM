"use server";

import { ResourceStatus, ResourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { markRead, saveResource } from "@/lib/resources";
import { requirePermission } from "@/lib/session";
import { saveFile } from "@/lib/storage";

export type FormState = { error?: string };
type Result = { ok: true } | { ok: false; error: string };

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const schema = z.object({
  title: z.string().trim().min(3, "Give it a title").max(200),
  summary: z.preprocess(blank, z.string().trim().max(300).nullable()),
  body: z.string().trim().min(1, "Write the content").max(200_000),
  type: z.nativeEnum(ResourceType),
  category: z.string().trim().min(2, "Choose or type a category").max(60),
  tags: z.string().transform((s) => [...new Set(s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
  videoUrl: z.preprocess(blank, z.string().trim().url("Enter a full video link (https://…)").nullable()),
  status: z.nativeEnum(ResourceStatus),
  ownerId: z.preprocess(blank, z.string().nullable()),
  reviewDue: z.preprocess(blank, z.string().nullable()),
  changeNote: z.preprocess(blank, z.string().trim().max(300).nullable()),
});

export async function saveResourceAction(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission("resources.edit");
  const parsed = schema.safeParse({ ...Object.fromEntries(fd), tags: fd.get("tags") ?? "", changeNote: fd.get("changeNote") ?? "", summary: fd.get("summary") ?? "", videoUrl: fd.get("videoUrl") ?? "", reviewDue: fd.get("reviewDue") ?? "", ownerId: fd.get("ownerId") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const r = await saveResource(id, { ...parsed.data, reviewDue: parseISODate(parsed.data.reviewDue) }, actor.id);
  revalidatePath("/resources", "layout");
  redirect(`/resources/${r.id}`);
}

export async function acknowledge(id: string): Promise<Result> {
  const user = await requirePermission("resources.view");
  await markRead(id, user);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadResourceFiles(id: string, fd: FormData): Promise<Result> {
  const actor = await requirePermission("resources.edit");
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Choose a file" };
  try {
    for (const f of files) {
      const stored = await saveFile(f, { purpose: "RESOURCE_ATTACHMENT", uploadedById: actor.id });
      await db.storedFile.update({ where: { id: stored.id }, data: { resourceId: id } });
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
  revalidatePath(`/resources/${id}`);
  return { ok: true };
}

export async function removeResourceFile(fileId: string): Promise<Result> {
  const actor = await requirePermission("resources.edit");
  const f = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!f?.resourceId) return { ok: false, error: "File not found" };
  if (f.uploadedById !== actor.id && !can(actor.role, "settings.manage")) return { ok: false, error: "Only the uploader or a Director can remove this file" };
  await db.storedFile.delete({ where: { id: fileId } });
  revalidatePath(`/resources/${f.resourceId}`);
  return { ok: true };
}
