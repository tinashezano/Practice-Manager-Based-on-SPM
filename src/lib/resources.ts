import type { Prisma, ResourceStatus, ResourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";

export type ResourceInput = {
  title: string;
  summary: string | null;
  body: string;
  type: ResourceType;
  category: string;
  tags: string[];
  videoUrl: string | null;
  status: ResourceStatus;
  ownerId: string | null;
  reviewDue: Date | null;
  changeNote: string | null;
};

/**
 * Creates or updates a resource. A change to the title or body is a new
 * version (kept in history), which means staff need to re-acknowledge it.
 */
export async function saveResource(id: string | null, input: ResourceInput, actorId: string) {
  const { changeNote, ...data } = input;
  if (!id) {
    return db.resource.create({
      data: { ...data, updatedById: actorId, versions: { create: { version: 1, title: data.title, body: data.body, changeNote: changeNote ?? "First version", editedById: actorId } } },
    });
  }
  const before = await db.resource.findUniqueOrThrow({ where: { id } });
  const contentChanged = before.title !== data.title || before.body !== data.body;
  const version = contentChanged ? before.version + 1 : before.version;
  return db.$transaction(async (tx) => {
    const r = await tx.resource.update({
      where: { id },
      data: { ...data, version, updatedById: actorId, reviewNotifiedAt: data.reviewDue?.getTime() === before.reviewDue?.getTime() ? undefined : null },
    });
    if (contentChanged) await tx.resourceVersion.create({ data: { resourceId: id, version, title: data.title, body: data.body, changeNote, editedById: actorId } });
    return r;
  });
}

/**
 * Records that a user read the current version. Also ticks off any open
 * staff-onboarding step that asks them to read it (via its task).
 */
export async function markRead(resourceId: string, user: { id: string }) {
  const r = await db.resource.findUniqueOrThrow({ where: { id: resourceId } });
  await db.resourceRead.upsert({
    where: { resourceId_userId_version: { resourceId, userId: user.id, version: r.version } },
    create: { resourceId, userId: user.id, version: r.version },
    update: {},
  });
  const steps = await db.enrollmentStep.findMany({
    where: { resourceId, completedAt: null, enrollment: { userId: user.id, status: "ACTIVE" }, taskId: { not: null } },
    select: { taskId: true },
  });
  for (const s of steps) {
    const task = await db.task.update({ where: { id: s.taskId! }, data: { status: "DONE", completedAt: new Date() } });
    await emitEvent("task.completed", { taskId: task.id }, { actorId: user.id });
  }
}

export async function searchResources(opts: { q?: string; category?: string; type?: ResourceType; includeDrafts: boolean }) {
  const where: Prisma.ResourceWhereInput = {
    status: opts.includeDrafts ? { not: "ARCHIVED" } : "PUBLISHED",
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.type ? { type: opts.type } : {}),
  };
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q, mode: "insensitive" } },
      { summary: { contains: opts.q, mode: "insensitive" } },
      { body: { contains: opts.q, mode: "insensitive" } },
      { tags: { has: opts.q.toLowerCase() } },
    ];
  }
  const rows = await db.resource.findMany({ where, include: { owner: { select: { id: true, name: true } } }, orderBy: [{ category: "asc" }, { title: "asc" }] });
  if (!opts.q) return rows;
  // Title matches first.
  const q = opts.q.toLowerCase();
  return rows.sort((a, b) => Number(b.title.toLowerCase().includes(q)) - Number(a.title.toLowerCase().includes(q)));
}

/** Short excerpt around the first match, for search results. */
export function excerpt(body: string, q?: string, length = 180) {
  const plain = body.replace(/[#>*_`|[\]()-]/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return plain.slice(0, length) + (plain.length > length ? "…" : "");
  const i = plain.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return plain.slice(0, length) + (plain.length > length ? "…" : "");
  const start = Math.max(0, i - 60);
  return `${start ? "…" : ""}${plain.slice(start, start + length)}${start + length < plain.length ? "…" : ""}`;
}
