import type { DealStage, Prisma } from "@prisma/client";
import { firmDate } from "@/lib/availability";
import { bookingUrl, formatWhen, manageUrl } from "@/lib/booking";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { changeDealStage, logActivity } from "@/lib/deals";
import { bookingConfirmationEmail, bookingInviteEmail, deliverEmail, queueEmail } from "@/lib/email";
import { enqueue } from "@/lib/jobs";
import { notify } from "@/lib/notify";
import { nextOccurrence } from "@/lib/recurrence";
import { getAutomation } from "./settings";

// Keys stored on automation-created tasks.
export const TASK_KEYS = {
  discoveryCall: "deal.discovery_call",
  proposal: "deal.proposal",
  followUp: "deal.follow_up",
} as const;

type Payload = Record<string, unknown>;

/** Entry point for every queued job. */
export async function runJob(name: string, payload: Payload) {
  switch (name) {
    case "event":
      return handleEvent(String(payload.eventId));
    case "email.send":
      return deliverEmail(String(payload.emailId));
    case "lead.followUp":
      return leadFollowUp(String(payload.dealId));
    default:
      throw new Error(`Unknown job "${name}"`);
  }
}

async function handleEvent(eventId: string) {
  const event = await db.eventLog.findUnique({ where: { id: eventId } });
  if (!event || event.processedAt) return;
  const p = event.payload as Payload;
  try {
    switch (event.type) {
      case "lead.created":
        await onLeadCreated(String(p.dealId));
        break;
      case "booking.confirmed":
        await onBookingConfirmed(String(p.bookingId));
        break;
      case "booking.rescheduled":
        await onBookingRescheduled(String(p.bookingId));
        break;
      case "booking.cancelled":
        await onBookingCancelled(String(p.bookingId));
        break;
      case "task.completed":
        await onTaskCompleted(String(p.taskId), event.actorId);
        break;
      case "deal.stageChanged":
        await onDealStageChanged(String(p.dealId), p.to as DealStage, event.actorId);
        break;
    }
    await db.eventLog.update({ where: { id: eventId }, data: { processedAt: new Date(), error: null } });
  } catch (err) {
    await db.eventLog.update({ where: { id: eventId }, data: { error: err instanceof Error ? err.message : String(err) } });
    throw err;
  }
}

// ---------- Leads ----------

async function onLeadCreated(dealId: string) {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return;

  const send = await getAutomation("lead.sendBookingLink");
  // A lead that arrived through a booking page has already booked.
  if (send.enabled && deal.email && deal.source !== "BOOKING_PAGE") {
    const link =
      (await db.bookingLink.findFirst({ where: { active: true, isDefault: true, hostId: deal.ownerId ?? undefined }, include: { host: true } })) ??
      (await db.bookingLink.findFirst({ where: { active: true, isDefault: true }, include: { host: true }, orderBy: { createdAt: "asc" } }));
    if (link) {
      const sender = deal.ownerId ? await db.user.findUnique({ where: { id: deal.ownerId } }) : link.host;
      const mail = bookingInviteEmail({ contactName: deal.contactName, senderName: sender?.name ?? link.host.name, linkTitle: link.title, url: bookingUrl(link.slug) });
      await queueEmail({ to: deal.email, ...mail, senderId: sender?.id ?? link.hostId, dealId });
      await logActivity(dealId, "SYSTEM", `Booking link (${link.title}) queued to ${deal.email}.`);
    } else {
      await logActivity(dealId, "SYSTEM", "Booking link not sent: no default booking link is set up (Leads & Deals → Booking Links).");
    }
  }

  const followUp = await getAutomation("lead.followUp");
  if (followUp.enabled && deal.source !== "BOOKING_PAGE") {
    await enqueue("lead.followUp", { dealId }, new Date(Date.now() + followUp.config.days! * 86_400_000));
  }
}

async function leadFollowUp(dealId: string) {
  const deal = await db.deal.findUnique({ where: { id: dealId }, include: { bookings: { where: { status: "CONFIRMED" } } } });
  if (!deal || deal.stage !== "NEW_LEAD" || deal.bookings.length) return;
  if (!(await getAutomation("lead.followUp")).enabled) return;
  const exists = await db.task.findFirst({ where: { dealId, automationKey: TASK_KEYS.followUp, status: { not: "DONE" } } });
  if (exists) return;
  await db.task.create({
    data: {
      title: `Follow up with ${deal.contactName}: no discovery call booked yet`,
      description: `${deal.contactName}${deal.email ? ` (${deal.email}` : ""}${deal.phone ? `, ${deal.phone}` : ""}${deal.email ? ")" : ""} hasn't booked a discovery call. Give them a call or resend the booking link.`,
      dealId,
      assigneeId: deal.ownerId,
      dueDate: parseISODate(todayISO()),
      priority: "HIGH",
      automationKey: TASK_KEYS.followUp,
    },
  });
  await logActivity(dealId, "TASK", "Follow-up task created: no call booked yet.");
  await notify([deal.ownerId], "system", { title: `Follow up with ${deal.name}`, body: "No discovery call booked yet", link: `/deals/${dealId}` });
}

// ---------- Bookings ----------

async function onBookingConfirmed(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { bookingLink: true, host: true, deal: true } });
  if (!booking?.deal || booking.status !== "CONFIRMED") return;
  if (!(await getAutomation("booking.discoveryTask")).enabled) return;
  const deal = booking.deal;

  if (deal.stage === "NEW_LEAD") await changeDealStage(deal.id, "DISCOVERY_BOOKED", { note: "Call booked by the lead." });

  // Booking means the follow-up isn't needed any more.
  await db.task.updateMany({ where: { dealId: deal.id, automationKey: TASK_KEYS.followUp, status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });

  const day = parseISODate(firmDate(booking.startsAt));
  await db.task.create({
    data: {
      title: `${booking.bookingLink.title}: ${deal.name}`,
      description: [
        `When: ${formatWhen(booking.startsAt)}`,
        booking.meetUrl && `Google Meet: ${booking.meetUrl}`,
        `Contact: ${booking.name} · ${booking.email}${booking.phone ? ` · ${booking.phone}` : ""}`,
        booking.message && `\nTheir message:\n${booking.message}`,
        "\nMark this task done after the call to create the proposal task.",
      ]
        .filter(Boolean)
        .join("\n"),
      dealId: deal.id,
      assigneeId: booking.hostId,
      startDate: day,
      dueDate: day,
      priority: "HIGH",
      estimateMinutes: booking.bookingLink.durationMinutes,
      automationKey: TASK_KEYS.discoveryCall,
    },
  });
  await logActivity(deal.id, "TASK", `Discovery call task created for ${booking.host.name}.`);
  await notify([booking.hostId], "system", { title: `New discovery call: ${deal.name}`, body: formatWhen(booking.startsAt), link: `/deals/${deal.id}` });

  const mail = bookingConfirmationEmail({
    name: booking.name,
    title: booking.bookingLink.title,
    when: formatWhen(booking.startsAt),
    hostName: booking.host.name,
    meetUrl: booking.meetUrl,
    manageUrl: manageUrl(booking.manageToken),
  });
  await queueEmail({ to: booking.email, ...mail, senderId: booking.hostId, dealId: deal.id });
}

async function onBookingRescheduled(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { bookingLink: true, host: true } });
  if (!booking?.dealId) return;
  const day = parseISODate(firmDate(booking.startsAt));
  await db.task.updateMany({
    where: { dealId: booking.dealId, automationKey: TASK_KEYS.discoveryCall, status: { not: "DONE" } },
    data: { startDate: day, dueDate: day },
  });
  await notify([booking.hostId], "system", { title: `Discovery call moved: ${booking.company ?? booking.name}`, body: formatWhen(booking.startsAt), link: `/deals/${booking.dealId}` });
  const mail = bookingConfirmationEmail({ name: booking.name, title: booking.bookingLink.title, when: formatWhen(booking.startsAt), hostName: booking.host.name, meetUrl: booking.meetUrl, manageUrl: manageUrl(booking.manageToken) });
  await queueEmail({ to: booking.email, ...mail, subject: `Rescheduled: ${booking.bookingLink.title} on ${formatWhen(booking.startsAt)}`, senderId: booking.hostId, dealId: booking.dealId });
}

async function onBookingCancelled(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { deal: true } });
  if (!booking?.deal) return;
  await db.task.deleteMany({ where: { dealId: booking.deal.id, automationKey: TASK_KEYS.discoveryCall, status: { not: "DONE" } } });
  if (booking.deal.stage === "DISCOVERY_BOOKED") await changeDealStage(booking.deal.id, "NEW_LEAD", { note: "Call cancelled." });
  await notify([booking.hostId, booking.deal.ownerId], "system", { title: `Discovery call cancelled: ${booking.deal.name}`, body: formatWhen(booking.startsAt), link: `/deals/${booking.deal.id}` });
}

// ---------- Tasks ----------

async function onTaskCompleted(taskId: string, actorId: string | null) {
  const task = await db.task.findUnique({ where: { id: taskId }, include: { subtasks: { orderBy: { position: "asc" } } } });
  if (!task || task.status !== "DONE") return;

  if (task.automationKey === TASK_KEYS.discoveryCall && task.dealId) {
    await db.booking.updateMany({ where: { dealId: task.dealId, status: "CONFIRMED", startsAt: { lte: new Date() } }, data: { status: "COMPLETED" } });
    const deal = await db.deal.findUnique({ where: { id: task.dealId } });
    if (deal && (deal.stage === "NEW_LEAD" || deal.stage === "DISCOVERY_BOOKED")) {
      await changeDealStage(deal.id, "PROPOSAL_REQUIRED", { actorId, note: "Discovery call completed." });
    }
  }

  if (task.recurrence !== "NONE" && !task.parentId && (await getAutomation("task.recurrence")).enabled) {
    await createNextOccurrence(task);
  }
}

async function createNextOccurrence(task: Prisma.TaskGetPayload<{ include: { subtasks: true } }>) {
  const base = task.dueDate ?? task.startDate;
  const anchor = base ? base.toISOString().slice(0, 10) : todayISO();
  const nextDue = nextOccurrence(anchor, task.recurrence)!;
  const shift = (d: Date | null) => {
    if (!d) return null;
    const delta = Math.round((parseISODate(nextDue)!.getTime() - parseISODate(anchor)!.getTime()) / 86_400_000);
    return parseISODate(addDays(d.toISOString().slice(0, 10), delta));
  };
  await db.$transaction(async (tx) => {
    const next = await tx.task.create({
      data: {
        title: task.title,
        description: task.description,
        clientId: task.clientId,
        dealId: task.dealId,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
        reviewerId: task.reviewerId,
        createdById: task.createdById,
        priority: task.priority,
        estimateMinutes: task.estimateMinutes,
        recurrence: task.recurrence,
        startDate: shift(task.startDate),
        dueDate: base ? shift(task.dueDate) : parseISODate(nextDue),
        position: task.position,
      },
    });
    if (task.subtasks.length) {
      await tx.task.createMany({
        data: task.subtasks.map((s) => ({
          title: s.title,
          description: s.description,
          clientId: s.clientId,
          dealId: s.dealId,
          projectId: s.projectId,
          parentId: next.id,
          assigneeId: s.assigneeId,
          priority: s.priority,
          estimateMinutes: s.estimateMinutes,
          dueDate: shift(s.dueDate),
          position: s.position,
        })),
      });
    }
    // The finished one no longer repeats; the new one carries the schedule.
    await tx.task.update({ where: { id: task.id }, data: { recurrence: "NONE" } });
  });
}

// ---------- Deal stages ----------

async function onDealStageChanged(dealId: string, to: DealStage, actorId: string | null) {
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return;

  if (to === "DISCOVERY_COMPLETED" || to === "PROPOSAL_REQUIRED") {
    // Moved past the call (by completing the task, or by dragging on the board).
    await db.task.updateMany({ where: { dealId, automationKey: TASK_KEYS.discoveryCall, status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });
    const auto = await getAutomation("discovery.proposalTask");
    const exists = await db.task.findFirst({ where: { dealId, automationKey: TASK_KEYS.proposal } });
    if (auto.enabled && !exists) {
      await db.task.create({
        data: {
          title: `Prepare proposal: ${deal.name}`,
          description: [deal.servicesInterest && `Services discussed: ${deal.servicesInterest}`, "Build the proposal from the service catalogue and send it for signature."].filter(Boolean).join("\n"),
          dealId,
          assigneeId: deal.ownerId,
          createdById: actorId,
          dueDate: parseISODate(addBusinessDays(todayISO(), auto.config.dueDays!)),
          priority: "HIGH",
          automationKey: TASK_KEYS.proposal,
        },
      });
      await logActivity(dealId, "TASK", "Proposal task created.");
      await notify([deal.ownerId], actorId ?? "system", { title: `Proposal needed: ${deal.name}`, link: `/deals/${dealId}` });
    }
  }

  if (to === "LOST" && (await getAutomation("deal.lostCloseTasks")).enabled) {
    const { count } = await db.task.updateMany({ where: { dealId, clientId: null, status: { not: "DONE" } }, data: { status: "DONE", completedAt: new Date() } });
    if (count) await logActivity(dealId, "TASK", `${count} open lead task${count === 1 ? "" : "s"} closed.`);
  }
}

function addBusinessDays(iso: string, days: number) {
  let d = iso;
  let left = days;
  while (left > 0) {
    d = addDays(d, 1);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
}
