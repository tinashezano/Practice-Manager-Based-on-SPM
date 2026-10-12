import type { Prisma } from "@prisma/client";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";

/**
 * Creates a project for a client. With a template, its tasks and subtasks are
 * created too, due relative to the start date and assigned to the owner.
 */
export async function createProjectFromTemplate(p: {
  clientId: string;
  name?: string | null;
  description?: string | null;
  templateId?: string | null;
  ownerId: string | null;
  createdById: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  const template = p.templateId
    ? await db.projectTemplate.findUnique({ where: { id: p.templateId }, include: { tasks: { orderBy: { position: "asc" } } } })
    : null;
  const name = p.name || template?.name;
  if (!name) throw new Error("Give the project a name or pick a template");
  const start = p.startDate ?? todayISO();
  if (!parseISODate(start)) throw new Error("Invalid start date");

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const project = await tx.project.create({
      data: {
        clientId: p.clientId,
        name,
        description: p.description ?? template?.description,
        ownerId: p.ownerId,
        templateId: template?.id,
        startDate: parseISODate(start),
        dueDate: parseISODate(p.dueDate ?? null),
      },
    });
    if (template) {
      const due = (offset: number | null) => (offset === null ? null : parseISODate(addDays(start, offset)));
      const ids = new Map<string, string>();
      for (const t of template.tasks.filter((t) => !t.parentId)) {
        const task = await tx.task.create({
          data: {
            title: t.title,
            description: t.description,
            clientId: p.clientId,
            projectId: project.id,
            assigneeId: p.ownerId,
            createdById: p.createdById,
            priority: t.priority,
            estimateMinutes: t.estimateMinutes,
            resourceId: t.resourceId,
            startDate: parseISODate(start),
            dueDate: due(t.dueOffsetDays),
            position: t.position,
          },
        });
        ids.set(t.id, task.id);
      }
      for (const t of template.tasks.filter((t) => t.parentId)) {
        await tx.task.create({
          data: {
            title: t.title,
            clientId: p.clientId,
            projectId: project.id,
            parentId: ids.get(t.parentId!)!,
            assigneeId: p.ownerId,
            createdById: p.createdById,
            priority: t.priority,
            estimateMinutes: t.estimateMinutes,
            resourceId: t.resourceId,
            dueDate: due(t.dueOffsetDays),
            position: t.position,
          },
        });
      }
    }
    return project;
  });
}
