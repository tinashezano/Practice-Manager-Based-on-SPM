"use server";

import { ClientStatus, EntityType, ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { notify } from "@/lib/notify";
import { requirePermission } from "@/lib/session";

export type FormState = { error?: string };

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const opt = z.preprocess(blank, z.string().trim().max(500).nullable().optional());

const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter the client's name").max(200),
  entityType: z.nativeEnum(EntityType),
  status: z.nativeEnum(ClientStatus).optional(),
  registrationNumber: opt,
  taxNumber: opt,
  vatNumber: opt,
  email: z.preprocess(blank, z.string().trim().email("Enter a valid email").nullable().optional()),
  phone: opt,
  address: opt,
  notes: z.preprocess(blank, z.string().max(10_000).nullable().optional()),
  ownerId: z.preprocess(blank, z.string().nullable().optional()),
});

export async function saveClient(clientId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("clients.manage");
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  let id = clientId;
  if (id) {
    await db.client.update({ where: { id }, data: parsed.data });
  } else {
    const client = await db.client.create({ data: { ...parsed.data, ownerId: parsed.data.ownerId ?? actor.id } });
    id = client.id;
    await emitEvent("client.created", { clientId: id, source: "manual" }, { actorId: actor.id });
    await notify([client.ownerId], actor.id, { title: `You're the owner of new client ${client.name}`, link: `/clients/${id}` });
  }
  revalidatePath("/", "layout");
  redirect(`/clients/${id}`);
}

const contactSchema = z.object({
  clientId: z.string(),
  name: z.string().trim().min(2, "Enter the contact's name").max(200),
  email: z.preprocess(blank, z.string().trim().email("Enter a valid email").nullable().optional()),
  phone: opt,
  position: opt,
  isPrimary: z.preprocess((v) => v === "on", z.boolean()),
});

export async function addContact(_: FormState, formData: FormData): Promise<FormState> {
  await requirePermission("clients.manage");
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { clientId, ...data } = parsed.data;
  if (data.isPrimary) await db.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
  const isFirst = (await db.clientContact.count({ where: { clientId } })) === 0;
  await db.clientContact.create({ data: { ...data, clientId, isPrimary: data.isPrimary || isFirst } });
  revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function removeContact(formData: FormData) {
  await requirePermission("clients.manage");
  const contact = await db.clientContact.delete({ where: { id: String(formData.get("contactId")) } });
  revalidatePath(`/clients/${contact.clientId}`);
}

const projectSchema = z.object({
  clientId: z.string(),
  name: z.preprocess(blank, z.string().trim().max(200).nullable().optional()),
  templateId: z.preprocess(blank, z.string().nullable().optional()),
  ownerId: z.preprocess(blank, z.string().nullable().optional()),
  startDate: z.preprocess(blank, z.string().nullable().optional()),
  dueDate: z.preprocess(blank, z.string().nullable().optional()),
});

/**
 * Creates a project. With a template, its tasks and subtasks are created too,
 * due relative to the start date and assigned to the project owner.
 */
export async function createProject(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("clients.manage");
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { clientId, templateId, ownerId } = parsed.data;

  const template = templateId
    ? await db.projectTemplate.findUnique({ where: { id: templateId }, include: { tasks: { orderBy: { position: "asc" } } } })
    : null;
  const name = parsed.data.name || template?.name;
  if (!name) return { error: "Give the project a name or pick a template" };

  const start = parsed.data.startDate ?? todayISO();
  if (!parseISODate(start)) return { error: "Invalid start date" };
  const owner = ownerId ?? actor.id;

  const project = await db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        clientId,
        name,
        description: template?.description,
        ownerId: owner,
        templateId: template?.id,
        startDate: parseISODate(start),
        dueDate: parseISODate(parsed.data.dueDate ?? null),
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
            clientId,
            projectId: project.id,
            assigneeId: owner,
            createdById: actor.id,
            priority: t.priority,
            estimateMinutes: t.estimateMinutes,
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
            clientId,
            projectId: project.id,
            parentId: ids.get(t.parentId!)!,
            assigneeId: owner,
            createdById: actor.id,
            priority: t.priority,
            estimateMinutes: t.estimateMinutes,
            dueDate: due(t.dueOffsetDays),
            position: t.position,
          },
        });
      }
    }
    return project;
  });

  await notify([owner], actor.id, { title: `New project assigned to you: ${project.name}`, link: `/clients/${clientId}?project=${project.id}` });
  revalidatePath("/", "layout");
  return {};
}

export async function setProjectStatus(formData: FormData) {
  await requirePermission("clients.manage");
  const status = z.nativeEnum(ProjectStatus).parse(formData.get("status"));
  const project = await db.project.update({ where: { id: String(formData.get("projectId")) }, data: { status } });
  revalidatePath("/", "layout");
  revalidatePath(`/clients/${project.clientId}`);
}
