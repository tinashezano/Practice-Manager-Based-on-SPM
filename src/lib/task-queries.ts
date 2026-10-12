import type { Prisma, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { parseISODate } from "@/lib/dates";

export type TaskFilters = {
  clientId?: string;
  dealId?: string;
  projectId?: string;
  /** user id, or undefined for everyone */
  assigneeId?: string;
  status?: "open" | "done" | "all";
  q?: string;
  /** Only tasks with a due date or start date inside [from, to]. */
  from?: string;
  to?: string;
};

export function taskWhere(f: TaskFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { parentId: null };
  if (f.clientId) where.clientId = f.clientId;
  if (f.dealId) where.dealId = f.dealId;
  if (f.projectId) where.projectId = f.projectId;
  if (f.assigneeId) where.assigneeId = f.assigneeId;
  if (f.status === "open" || !f.status) where.status = { not: "DONE" };
  if (f.status === "done") where.status = "DONE";
  if (f.q) where.title = { contains: f.q, mode: "insensitive" };
  if (f.from && f.to) {
    const from = parseISODate(f.from)!;
    const to = parseISODate(f.to)!;
    where.OR = [{ dueDate: { gte: from, lte: to } }, { startDate: { gte: from, lte: to } }, { startDate: { lt: from }, dueDate: { gt: to } }];
  }
  return where;
}

const userSelect = { select: { id: true, name: true } } as const;

export const taskListInclude = {
  client: { select: { id: true, name: true, isInternal: true } },
  deal: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  assignee: userSelect,
  subtasks: {
    orderBy: { position: "asc" },
    include: { assignee: userSelect },
  },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskListInclude }>;

export async function listTasks(f: TaskFilters, take = 1000) {
  return db.task.findMany({
    where: taskWhere(f),
    include: taskListInclude,
    orderBy: [{ client: { name: "asc" } }, { deal: { name: "asc" } }, { position: "asc" }],
    take,
  });
}

export async function getTaskDetail(id: string) {
  return db.task.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true } },
      assignee: userSelect,
      reviewer: userSelect,
      createdBy: userSelect,
      subtasks: { orderBy: { position: "asc" }, include: { assignee: userSelect } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: userSelect } },
      attachments: { orderBy: { createdAt: "asc" }, include: { file: { select: { id: true, name: true, size: true } } } },
      resource: { select: { id: true, title: true, summary: true } },
    },
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export const OPEN_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING_ON_CLIENT", "IN_REVIEW"];
