"use server";

import { Priority, Recurrence, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { taskHome } from "@/lib/task-meta";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { onStepTaskReopened } from "@/lib/staff-onboarding";
import { saveFile } from "@/lib/storage";
import { canEditTask } from "@/lib/task-access";

type Result = { ok: true; id?: string } | { ok: false; error: string };

const dateField = z
  .string()
  .nullable()
  .transform((s, ctx) => {
    if (!s) return null;
    const d = parseISODate(s);
    if (!d) ctx.addIssue({ code: "custom", message: "Invalid date" });
    return d;
  });

const optionalId = z.string().min(1).nullable();

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(300),
  clientId: z.string().min(1).optional(),
  dealId: z.string().min(1).optional(),
  projectId: optionalId.optional(),
  parentId: optionalId.optional(),
  assigneeId: optionalId.optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: dateField.optional(),
});

export async function createTask(input: z.input<typeof createSchema>): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const data = parsed.data;

  let clientId: string | null = data.clientId ?? null;
  let dealId: string | null = data.dealId ?? null;
  let projectId = data.projectId ?? null;
  if (data.parentId) {
    // Subtasks always live under the same client/project as their parent.
    const parent = await db.task.findUnique({ where: { id: data.parentId } });
    if (!parent) return { ok: false, error: "Parent task not found" };
    if (parent.parentId) return { ok: false, error: "Subtasks can't have their own subtasks" };
    if (!(await canEditTask(actor, parent.id))) return { ok: false, error: "You can't add subtasks to this task" };
    clientId = parent.clientId;
    dealId = parent.dealId;
    projectId = parent.projectId;
  }
  if (!clientId && !dealId) return { ok: false, error: "Choose a client" };
  if (dealId && !(await db.deal.findUnique({ where: { id: dealId } }))) return { ok: false, error: "Lead not found" };
  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (project?.clientId !== clientId) return { ok: false, error: "That project belongs to a different client" };
  }

  const last = await db.task.findFirst({
    where: { clientId, dealId, projectId, parentId: data.parentId ?? null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const task = await db.task.create({
    data: {
      title: data.title,
      clientId,
      dealId,
      projectId,
      parentId: data.parentId ?? null,
      assigneeId: data.assigneeId === undefined ? actor.id : data.assigneeId,
      priority: data.priority ?? "MEDIUM",
      status: data.status ?? "TODO",
      completedAt: data.status === "DONE" ? new Date() : null,
      dueDate: data.dueDate ?? null,
      createdById: actor.id,
      position: (last?.position ?? 0) + 1,
    },
    include: { client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } },
  });

  await notify([task.assigneeId], actor.id, {
    title: `${actor.name} assigned you "${task.title}"`,
    body: taskHome(task).name,
    link: `/tasks?task=${task.id}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, id: task.id };
}

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(20_000).nullable(),
    status: z.nativeEnum(TaskStatus),
    priority: z.nativeEnum(Priority),
    assigneeId: optionalId,
    reviewerId: optionalId,
    projectId: optionalId,
    startDate: dateField,
    dueDate: dateField,
    estimateMinutes: z.number().int().min(0).max(100_000).nullable(),
    recurrence: z.nativeEnum(Recurrence),
    resourceId: optionalId,
  })
  .partial();

export async function updateTask(id: string, patch: z.input<typeof updateSchema>): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const parsed = updateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const data = parsed.data;

  const before = await db.task.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Task not found" };
  if (!(await canEditTask(actor, id))) return { ok: false, error: "You can only edit tasks you're assigned to, reviewing or created" };

  // Reassigning someone else's work is a manager action.
  const reassigning =
    (data.assigneeId !== undefined && data.assigneeId !== before.assigneeId && data.assigneeId !== actor.id) ||
    (data.reviewerId !== undefined && data.reviewerId !== before.reviewerId);
  if (reassigning && !can(actor.role, "tasks.manageAll") && before.createdById !== actor.id) {
    return { ok: false, error: "Only Directors and Accountants can reassign tasks" };
  }
  if (data.projectId) {
    const project = await db.project.findUnique({ where: { id: data.projectId } });
    if (project?.clientId !== before.clientId) return { ok: false, error: "That project belongs to a different client" };
  }

  const completedAt =
    data.status === undefined ? undefined : data.status === "DONE" ? (before.completedAt ?? new Date()) : null;

  const task = await db.task.update({
    where: { id },
    data: { ...data, completedAt },
    include: { client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } },
  });
  const where = taskHome(task).name;

  // Moving a parent to another project carries its subtasks along.
  if (data.projectId !== undefined && !task.parentId) {
    await db.task.updateMany({ where: { parentId: id }, data: { projectId: data.projectId } });
  }

  const link = `/tasks?task=${task.id}`;
  if (data.assigneeId && data.assigneeId !== before.assigneeId) {
    await notify([data.assigneeId], actor.id, { title: `${actor.name} assigned you "${task.title}"`, body: where, link });
  }
  if (data.reviewerId && data.reviewerId !== before.reviewerId) {
    await notify([data.reviewerId], actor.id, { title: `${actor.name} made you reviewer of "${task.title}"`, body: where, link });
  }
  if (data.status === "IN_REVIEW" && before.status !== "IN_REVIEW") {
    await notify([task.reviewerId], actor.id, { title: `"${task.title}" is ready for your review`, body: where, link });
  }
  if (data.status === "DONE" && before.status !== "DONE") {
    await notify([task.createdById, task.reviewerId], actor.id, { title: `${actor.name} completed "${task.title}"`, body: where, link });
  }

  if (data.status === "DONE" && before.status !== "DONE") {
    // Runs automations: next step for lead tasks, next occurrence for repeating tasks.
    await emitEvent("task.completed", { taskId: id }, { actorId: actor.id });
  }
  if (data.status && data.status !== "DONE" && before.status === "DONE") await onStepTaskReopened(id);

  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteTask(id: string): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const task = await db.task.findUnique({ where: { id }, include: { parent: { select: { createdById: true, assigneeId: true } } } });
  if (!task) return { ok: false, error: "Task not found" };
  const mayDelete =
    can(actor.role, "tasks.manageAll") ||
    task.createdById === actor.id ||
    // Subtasks can be removed by whoever owns the parent task.
    (!!task.parent && (task.parent.assigneeId === actor.id || task.parent.createdById === actor.id));
  if (!mayDelete) return { ok: false, error: "Only Directors, Accountants or the task's creator can delete it" };
  await db.task.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addComment(taskId: string, body: string): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const text = body.trim();
  if (!text) return { ok: false, error: "Write a comment first" };
  if (text.length > 5000) return { ok: false, error: "Comment is too long" };
  const task = await db.task.findUnique({ where: { id: taskId }, include: { client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } } });
  if (!task) return { ok: false, error: "Task not found" };

  await db.taskComment.create({ data: { taskId, authorId: actor.id, body: text } });

  // Everyone involved hears about it, plus anyone @mentioned by first name or full name.
  const staff = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const lower = text.toLowerCase();
  const mentioned = staff
    .filter((u) => lower.includes(`@${u.name.toLowerCase()}`) || lower.includes(`@${u.name.split(" ")[0]!.toLowerCase()}`))
    .map((u) => u.id);
  await notify([task.assigneeId, task.reviewerId, task.createdById, ...mentioned], actor.id, {
    title: `${actor.name} commented on "${task.title}"`,
    body: text.slice(0, 140),
    link: `/tasks?task=${task.id}`,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function attachFiles(taskId: string, fd: FormData): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  if (!(await canEditTask(actor, taskId))) return { ok: false, error: "You can only attach files to tasks you're working on" };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Choose a file" };
  try {
    for (const f of files) {
      const stored = await saveFile(f, { purpose: "TASK_ATTACHMENT", uploadedById: actor.id });
      await db.taskAttachment.create({ data: { taskId, fileId: stored.id } });
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAttachment(attachmentId: string): Promise<Result> {
  const actor = await requirePermission("tasks.work");
  const a = await db.taskAttachment.findUnique({ where: { id: attachmentId }, include: { file: { select: { uploadedById: true } } } });
  if (!a) return { ok: false, error: "Attachment not found" };
  if (a.file.uploadedById !== actor.id && !can(actor.role, "tasks.manageAll")) return { ok: false, error: "Only the uploader or a manager can remove this file" };
  await db.storedFile.delete({ where: { id: a.fileId } });
  revalidatePath("/", "layout");
  return { ok: true };
}
