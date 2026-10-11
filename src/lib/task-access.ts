import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

type Actor = { id: string; role: Role };

/**
 * Managers (Directors, Accountants) can edit any task. Everyone else can edit
 * tasks they're assigned to, reviewing or created — including the subtasks of
 * such a task.
 */
export async function canEditTask(actor: Actor, taskId: string) {
  if (can(actor.role, "tasks.manageAll")) return true;
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true, reviewerId: true, createdById: true, parent: { select: { assigneeId: true, reviewerId: true, createdById: true } } },
  });
  if (!task) return false;
  const involved = (t: { assigneeId: string | null; reviewerId: string | null; createdById: string | null }) =>
    t.assigneeId === actor.id || t.reviewerId === actor.id || t.createdById === actor.id;
  return involved(task) || (!!task.parent && involved(task.parent));
}
