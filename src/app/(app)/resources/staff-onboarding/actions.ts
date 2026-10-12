"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { enroll } from "@/lib/staff-onboarding";

type Result = { ok: true } | { ok: false; error: string };
export type FormState = { error?: string };

const refresh = (programmeId?: string): Result => {
  revalidatePath("/resources/staff-onboarding", "layout");
  if (programmeId) revalidatePath(`/resources/staff-onboarding/programmes/${programmeId}`);
  return { ok: true };
};

export async function createProgramme(fd: FormData) {
  await requirePermission("team.manage");
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 3) return;
  const p = (await db.programme.findUnique({ where: { name } })) ?? (await db.programme.create({ data: { name } }));
  redirect(`/resources/staff-onboarding/programmes/${p.id}`);
}

export async function updateProgramme(id: string, input: { name: string; description: string; active: boolean }): Promise<Result> {
  await requirePermission("team.manage");
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Name the programme" };
  const clash = await db.programme.findUnique({ where: { name } });
  if (clash && clash.id !== id) return { ok: false, error: "Another programme has that name" };
  await db.programme.update({ where: { id }, data: { name, description: input.description.trim() || null, active: input.active } });
  return refresh(id);
}

export async function addStep(programmeId: string): Promise<Result> {
  await requirePermission("team.manage");
  const last = await db.programmeStep.findFirst({ where: { programmeId }, orderBy: { position: "desc" } });
  await db.programmeStep.create({ data: { programmeId, title: "New step", position: (last?.position ?? -1) + 1, dueOffsetDays: last?.dueOffsetDays ?? 0 } });
  return refresh(programmeId);
}

const stepSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().max(3000).nullable(),
    resourceId: z.string().min(1).nullable(),
    dueOffsetDays: z.number().int().min(0).max(365),
    estimateMinutes: z.number().int().min(0).max(10_000).nullable(),
  })
  .partial();

export async function updateStep(id: string, patch: z.input<typeof stepSchema>): Promise<Result> {
  await requirePermission("team.manage");
  const parsed = stepSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const s = await db.programmeStep.update({ where: { id }, data: parsed.data });
  return refresh(s.programmeId);
}

export async function moveStep(id: string, direction: -1 | 1): Promise<Result> {
  await requirePermission("team.manage");
  const s = await db.programmeStep.findUniqueOrThrow({ where: { id } });
  const steps = await db.programmeStep.findMany({ where: { programmeId: s.programmeId }, orderBy: { position: "asc" } });
  const i = steps.findIndex((x) => x.id === id);
  const j = i + direction;
  if (j < 0 || j >= steps.length) return { ok: true };
  [steps[i], steps[j]] = [steps[j]!, steps[i]!];
  await db.$transaction(steps.map((x, n) => db.programmeStep.update({ where: { id: x.id }, data: { position: n } })));
  return refresh(s.programmeId);
}

export async function deleteStep(id: string): Promise<Result> {
  await requirePermission("team.manage");
  const s = await db.programmeStep.delete({ where: { id } });
  return refresh(s.programmeId);
}

export async function enrollAction(_: FormState, fd: FormData): Promise<FormState> {
  const actor = await requirePermission("team.manage");
  const parsed = z
    .object({ programmeId: z.string().min(1, "Choose a programme"), userId: z.string().min(1, "Choose who's joining"), mentorId: z.string().optional(), startDate: z.string().min(1, "Choose a start date") })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  let id: string;
  try {
    const e = await enroll({ ...parsed.data, mentorId: parsed.data.mentorId || null, actorId: actor.id });
    id = e.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't enrol" };
  }
  refresh();
  redirect(`/resources/staff-onboarding/${id}`);
}

export async function cancelEnrollment(id: string): Promise<Result> {
  await requirePermission("team.manage");
  const e = await db.enrollment.update({ where: { id }, data: { status: "CANCELLED" }, include: { steps: true } });
  const taskIds = e.steps.map((s) => s.taskId).filter((x): x is string => !!x);
  await db.task.deleteMany({ where: { id: { in: taskIds }, status: { not: "DONE" } } });
  return refresh();
}
