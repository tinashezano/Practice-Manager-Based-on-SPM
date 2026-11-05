import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Deleting records. Each function checks what must not be lost (signed or
// paid proposals, running retainers, upcoming calls), deletes the record
// with what belongs to it, and removes uploaded files that would otherwise
// be left behind in storage.

export type DeleteResult = { ok: true } | { ok: false; error: string };
type Tx = Prisma.TransactionClient;

const fail = (error: string): DeleteResult => ({ ok: false, error });

/** Files attached to these tasks (and their subtasks). Deleting a task only removes the link, not the file. */
async function taskFileIds(tx: Tx, where: Prisma.TaskWhereInput) {
  const tasks = await tx.task.findMany({ where, select: { id: true } });
  const ids = tasks.map((t) => t.id);
  if (!ids.length) return [];
  const atts = await tx.taskAttachment.findMany({ where: { task: { OR: [{ id: { in: ids } }, { parentId: { in: ids } }] } }, select: { fileId: true } });
  return atts.map((a) => a.fileId);
}

async function onboardingFileIds(tx: Tx, where: Prisma.OnboardingWhereInput) {
  const files = await tx.onboardingFile.findMany({ where: { item: { onboarding: where } }, select: { fileId: true } });
  return files.map((f) => f.fileId);
}

async function removeFiles(tx: Tx, ids: (string | null | undefined)[]) {
  const clean = ids.filter((x): x is string => !!x);
  if (clean.length) await tx.storedFile.deleteMany({ where: { id: { in: clean } } });
}

/** Proposals that are part of the firm's records: signed, accepted or with a successful payment. */
const KEEP_PROPOSAL: Prisma.ProposalWhereInput = {
  OR: [{ status: { in: ["SIGNED", "ACCEPTED"] } }, { paidAt: { not: null } }, { payments: { some: { status: "SUCCESS" } } }],
};

export async function deleteDeal(id: string): Promise<DeleteResult> {
  const deal = await db.deal.findUnique({ where: { id }, select: { id: true } });
  if (!deal) return fail("Deal not found.");
  if (await db.proposal.count({ where: { dealId: id, ...KEEP_PROPOSAL } })) {
    return fail("This deal has a signed or paid proposal, which must be kept for your records. Mark the deal as Lost instead.");
  }
  await db.$transaction(async (tx) => {
    const files = [
      ...(await taskFileIds(tx, { dealId: id })),
      ...(await tx.proposal.findMany({ where: { dealId: id }, select: { signedFileId: true } })).map((p) => p.signedFileId),
    ];
    await tx.task.deleteMany({ where: { dealId: id } }); // also cascades with the deal; explicit so files go first
    await tx.deal.delete({ where: { id } }); // proposals, activity and the deal's tasks go with it
    await removeFiles(tx, files);
  });
  return { ok: true };
}

export async function deleteBookingLink(id: string): Promise<DeleteResult> {
  const upcoming = await db.booking.count({ where: { bookingLinkId: id, status: "CONFIRMED", startsAt: { gte: new Date() } } });
  if (upcoming) return fail(`This link has ${upcoming} upcoming call${upcoming === 1 ? "" : "s"}. Cancel or hold them first, or switch the link off instead.`);
  await db.bookingLink.delete({ where: { id } });
  return { ok: true };
}

export async function deleteProposal(id: string): Promise<DeleteResult> {
  const p = await db.proposal.findUnique({ where: { id }, select: { id: true, signedFileId: true } });
  if (!p) return fail("Proposal not found.");
  if (await db.proposal.count({ where: { id, ...KEEP_PROPOSAL } })) {
    return fail("Signed or paid proposals are kept for your records and can't be deleted.");
  }
  await db.$transaction(async (tx) => {
    await tx.proposal.delete({ where: { id } });
    await removeFiles(tx, [p.signedFileId]);
  });
  return { ok: true };
}

export async function deleteService(id: string): Promise<DeleteResult> {
  // Proposal lines keep their copy of the name and price; packages lose this service.
  await db.service.delete({ where: { id } });
  return { ok: true };
}

export async function deleteServicePackage(id: string): Promise<DeleteResult> {
  await db.servicePackage.delete({ where: { id } });
  return { ok: true };
}

export async function deleteClient(id: string): Promise<DeleteResult> {
  const c = await db.client.findUnique({ where: { id }, select: { isInternal: true } });
  if (!c) return fail("Client not found.");
  if (c.isInternal) return fail("The firm's internal client can't be deleted: it holds your own admin time and tasks.");
  const running = await db.subscription.count({ where: { OR: [{ clientId: id }, { proposal: { clientId: id } }], status: { in: ["ACTIVE", "PENDING", "PAST_DUE"] } } });
  if (running) return fail("This client still has a monthly retainer running. Cancel it (in Paystack) before deleting the client.");
  await db.$transaction(async (tx) => {
    const files = [...(await taskFileIds(tx, { clientId: id })), ...(await onboardingFileIds(tx, { clientId: id }))];
    await tx.client.delete({ where: { id } }); // contacts, projects, tasks and onboarding go with it
    await removeFiles(tx, files);
  });
  return { ok: true };
}

export async function deleteOnboarding(id: string): Promise<DeleteResult> {
  await db.$transaction(async (tx) => {
    const files = await onboardingFileIds(tx, { id });
    await tx.onboarding.delete({ where: { id } });
    await removeFiles(tx, files);
  });
  return { ok: true };
}

/** Deletes the project and its tasks (time already logged stays, without the task). */
export async function deleteProject(id: string): Promise<DeleteResult> {
  await db.$transaction(async (tx) => {
    const files = await taskFileIds(tx, { projectId: id });
    await tx.task.deleteMany({ where: { projectId: id, parentId: null } });
    await tx.task.deleteMany({ where: { projectId: id } });
    await tx.project.delete({ where: { id } });
    await removeFiles(tx, files);
  });
  return { ok: true };
}

export async function deleteResource(id: string): Promise<DeleteResult> {
  // Versions, reads and attachments go with it; tasks and templates just lose the link.
  await db.resource.delete({ where: { id } });
  return { ok: true };
}

export async function deleteJobTemplate(id: string): Promise<DeleteResult> {
  // Projects already started keep their tasks; services fall back to a blank project.
  await db.projectTemplate.delete({ where: { id } });
  return { ok: true };
}

/** Removes a staff onboarding enrolment and its unfinished tasks (completed ones stay as history). */
export async function deleteEnrollment(id: string): Promise<DeleteResult> {
  await db.$transaction(async (tx) => {
    const steps = await tx.enrollmentStep.findMany({ where: { enrollmentId: id }, select: { taskId: true } });
    const taskIds = steps.map((s) => s.taskId).filter((x): x is string => !!x);
    await tx.task.deleteMany({ where: { id: { in: taskIds }, status: { not: "DONE" } } });
    await tx.enrollment.delete({ where: { id } });
  });
  return { ok: true };
}

export async function deleteProgramme(id: string): Promise<DeleteResult> {
  const active = await db.enrollment.count({ where: { programmeId: id, status: "ACTIVE" } });
  if (active) return fail(`${active} team member${active === 1 ? " is" : "s are"} still working through this programme. Remove or finish those first.`);
  await db.programme.delete({ where: { id } }); // steps and finished enrolments go with it
  return { ok: true };
}
