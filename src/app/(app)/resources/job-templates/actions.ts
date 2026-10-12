"use server";

import { Priority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const done = (templateId: string): Result => {
  revalidatePath(`/resources/job-templates/${templateId}`);
  revalidatePath("/resources/job-templates");
  return { ok: true };
};

export async function createTemplate(fd: FormData) {
  await requirePermission("resources.edit");
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 3) return;
  const existing = await db.projectTemplate.findUnique({ where: { name } });
  const t = existing ?? (await db.projectTemplate.create({ data: { name } }));
  redirect(`/resources/job-templates/${t.id}`);
}

export async function updateTemplate(id: string, input: { name: string; description: string }): Promise<Result> {
  await requirePermission("resources.edit");
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Name the template" };
  const clash = await db.projectTemplate.findUnique({ where: { name } });
  if (clash && clash.id !== id) return { ok: false, error: "Another template already has that name" };
  await db.projectTemplate.update({ where: { id }, data: { name, description: input.description.trim() || null } });
  return done(id);
}

export async function deleteTemplate(id: string): Promise<Result> {
  await requirePermission("resources.edit");
  await db.projectTemplate.delete({ where: { id } });
  revalidatePath("/resources/job-templates");
  redirect("/resources/job-templates");
}

export async function addTemplateTask(templateId: string, parentId: string | null): Promise<Result> {
  await requirePermission("resources.edit");
  const position = await db.templateTask.count({ where: { templateId, parentId } });
  const parent = parentId ? await db.templateTask.findUnique({ where: { id: parentId } }) : null;
  await db.templateTask.create({ data: { templateId, parentId, title: parentId ? "New subtask" : "New task", position, dueOffsetDays: parent?.dueOffsetDays ?? 0 } });
  return done(templateId);
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000).nullable(),
    dueOffsetDays: z.number().int().min(0).max(365).nullable(),
    estimateMinutes: z.number().int().min(0).max(100_000).nullable(),
    priority: z.nativeEnum(Priority),
    resourceId: z.string().min(1).nullable(),
  })
  .partial();

export async function updateTemplateTask(id: string, patch: z.input<typeof patchSchema>): Promise<Result> {
  await requirePermission("resources.edit");
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const t = await db.templateTask.update({ where: { id }, data: parsed.data });
  return done(t.templateId);
}

export async function moveTemplateTask(id: string, direction: -1 | 1): Promise<Result> {
  await requirePermission("resources.edit");
  const t = await db.templateTask.findUniqueOrThrow({ where: { id } });
  const siblings = await db.templateTask.findMany({ where: { templateId: t.templateId, parentId: t.parentId }, orderBy: { position: "asc" } });
  const i = siblings.findIndex((s) => s.id === id);
  const j = i + direction;
  if (j < 0 || j >= siblings.length) return { ok: true };
  [siblings[i], siblings[j]] = [siblings[j]!, siblings[i]!];
  await db.$transaction(siblings.map((s, n) => db.templateTask.update({ where: { id: s.id }, data: { position: n } })));
  return done(t.templateId);
}

export async function deleteTemplateTask(id: string): Promise<Result> {
  await requirePermission("resources.edit");
  const t = await db.templateTask.delete({ where: { id } });
  return done(t.templateId);
}
