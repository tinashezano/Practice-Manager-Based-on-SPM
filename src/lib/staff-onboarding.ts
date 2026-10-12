import { addDays, parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

async function internalClientId() {
  const internal = await db.client.findFirst({ where: { isInternal: true } });
  return (internal ?? (await db.client.create({ data: { name: "Outset (Internal)", isInternal: true, entityType: "OTHER" } }))).id;
}

/**
 * Enrols a team member in a programme. Each step becomes a dated task for
 * them, in an internal project, so it shows in their task lists and calendar.
 */
export async function enroll(p: { programmeId: string; userId: string; mentorId: string | null; startDate: string; actorId: string }) {
  const [programme, user] = await Promise.all([
    db.programme.findUniqueOrThrow({ where: { id: p.programmeId }, include: { steps: { orderBy: { position: "asc" } } } }),
    db.user.findUniqueOrThrow({ where: { id: p.userId } }),
  ]);
  if (!programme.steps.length) throw new Error("Add steps to the programme first.");
  if (await db.enrollment.findFirst({ where: { programmeId: p.programmeId, userId: p.userId, status: "ACTIVE" } })) throw new Error(`${user.name} is already doing this programme.`);
  if (!parseISODate(p.startDate)) throw new Error("Choose a start date.");
  const clientId = await internalClientId();

  const enrollment = await db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: { clientId, name: `${programme.name}: ${user.name}`, ownerId: p.mentorId ?? p.actorId, startDate: parseISODate(p.startDate), description: "Staff onboarding programme." },
    });
    const enrollment = await tx.enrollment.create({ data: { programmeId: programme.id, userId: user.id, mentorId: p.mentorId, startDate: parseISODate(p.startDate)! } });
    for (const s of programme.steps) {
      const task = await tx.task.create({
        data: {
          title: s.title,
          description: [s.description, s.resourceId && "Open the linked SOP and click “I've read this” to complete this step."].filter(Boolean).join("\n\n") || null,
          clientId,
          projectId: project.id,
          assigneeId: user.id,
          reviewerId: p.mentorId,
          createdById: p.actorId,
          resourceId: s.resourceId,
          estimateMinutes: s.estimateMinutes,
          startDate: parseISODate(p.startDate),
          dueDate: parseISODate(addDays(p.startDate, s.dueOffsetDays)),
          position: s.position,
          automationKey: "staff.onboarding_step",
        },
      });
      await tx.enrollmentStep.create({ data: { enrollmentId: enrollment.id, stepId: s.id, title: s.title, resourceId: s.resourceId, taskId: task.id, position: s.position } });
    }
    return enrollment;
  });

  await notify([user.id], p.actorId, { title: `Welcome! Your ${programme.name} programme has started`, body: `${programme.steps.length} steps`, link: `/resources/staff-onboarding/${enrollment.id}` });
  await notify([p.mentorId], p.actorId, { title: `You're mentoring ${user.name} through ${programme.name}`, link: `/resources/staff-onboarding/${enrollment.id}` });
  return enrollment;
}

/** Called when any task is completed: ticks the matching programme step. */
export async function onStepTaskCompleted(taskId: string) {
  const step = await db.enrollmentStep.findUnique({ where: { taskId }, include: { enrollment: { include: { user: true, programme: true } } } });
  if (!step || step.completedAt) return;
  await db.enrollmentStep.update({ where: { id: step.id }, data: { completedAt: new Date() } });
  const open = await db.enrollmentStep.count({ where: { enrollmentId: step.enrollmentId, completedAt: null } });
  if (open === 0 && step.enrollment.status === "ACTIVE") {
    await db.enrollment.update({ where: { id: step.enrollmentId }, data: { status: "COMPLETED", completedAt: new Date() } });
    const directors = await db.user.findMany({ where: { role: "DIRECTOR", active: true }, select: { id: true } });
    await notify([step.enrollment.mentorId, ...directors.map((d) => d.id)], step.enrollment.userId, {
      title: `${step.enrollment.user.name} finished ${step.enrollment.programme.name}`,
      link: `/resources/staff-onboarding/${step.enrollmentId}`,
    });
  }
}

/** A step's task reopened → step reopens too. */
export async function onStepTaskReopened(taskId: string) {
  await db.enrollmentStep.updateMany({ where: { taskId, completedAt: { not: null } }, data: { completedAt: null } });
}
