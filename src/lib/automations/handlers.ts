import type { DealStage, Prisma } from "@prisma/client";
import { firmDate } from "@/lib/availability";
import { bookingUrl, formatWhen, manageUrl } from "@/lib/booking";
import { addDays, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { changeDealStage, convertDealToClient, logActivity } from "@/lib/deals";
import { bookingConfirmationEmail, bookingInviteEmail, deliverEmail, queueEmail, welcomePackEmail } from "@/lib/email";
import { outstandingLabels, reminderJob, startOnboarding, uploadUrl } from "@/lib/onboarding";
import { onStepTaskCompleted } from "@/lib/staff-onboarding";
import { DEFAULT_WELCOME, getFirmSettings, proposalNumber } from "@/lib/firm";
import { formatRand } from "@/lib/money";
import { createPlan, createSubscription } from "@/lib/paystack";
import { createProjectFromTemplate } from "@/lib/projects";
import { finalizeIfComplete, totalsOf } from "@/lib/proposals";
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
    case "paystack.subscribe":
      return paystackSubscribe(payload);
    case "onboarding.reminder":
      return reminderJob(String(payload.onboardingId));
    case "daily":
      return dailyJob();
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
      case "proposal.signed":
      case "payment.succeeded":
        await finalizeIfComplete(String(p.proposalId));
        break;
      case "proposal.accepted":
        await onProposalAccepted(String(p.proposalId));
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

  await onStepTaskCompleted(task.id);

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

// ---------- Proposals & payments ----------

/**
 * Signed + paid: create the client, set up a project per service (from its
 * job template), send the welcome pack and tell the team.
 */
async function onProposalAccepted(proposalId: string) {
  const p = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { lineItems: { orderBy: { position: "asc" }, include: { service: true } }, deal: { include: { owner: true } } },
  });
  if (!p) return;
  const clientId = p.clientId ?? (await convertDealToClient(p.dealId, null));
  await db.proposal.update({ where: { id: p.id }, data: { clientId } });
  await db.subscription.updateMany({ where: { proposalId: p.id }, data: { clientId } });

  // Projects are created once per proposal (a retry won't duplicate them).
  const already = await db.project.count({ where: { clientId, description: { contains: proposalNumber(p.number) } } });
  if (!already) {
    const start = p.startDate && p.startDate.toISOString().slice(0, 10) > todayISO() ? p.startDate.toISOString().slice(0, 10) : todayISO();
    for (const line of p.lineItems) {
      await createProjectFromTemplate({
        clientId,
        name: line.name,
        // Also marks the project as created from this proposal (checked above on retries).
        description: `From proposal ${proposalNumber(p.number)}${line.billingType === "MONTHLY" ? " (monthly retainer)" : ""}.`,
        templateId: line.service?.templateId ?? null,
        ownerId: p.deal.ownerId,
        createdById: null,
        startDate: start,
      });
    }
  }

  // Onboarding: checklist from the services bought, then the welcome pack with the upload link.
  const services = p.lineItems.map((l) => l.name);
  const onboarding = await startOnboarding(clientId, { ownerId: p.deal.ownerId, actorId: null, services, proposalId: p.id });
  const firm = await getFirmSettings();
  if (p.deal.email) {
    const mail = welcomePackEmail({
      contactName: p.deal.contactName,
      senderName: p.deal.owner?.name ?? firm.legalName,
      message: firm.welcomeMessage || DEFAULT_WELCOME,
      services,
      ownerName: p.deal.owner?.name ?? firm.legalName,
      needed: await outstandingLabels(onboarding.id),
      uploadUrl: uploadUrl(onboarding.uploadToken),
    });
    await queueEmail({ to: p.deal.email, ...mail, senderId: p.deal.ownerId, dealId: p.dealId });
  }

  const directors = await db.user.findMany({ where: { role: "DIRECTOR", active: true }, select: { id: true } });
  const t = totalsOf(p);
  await notify([p.deal.ownerId, ...directors.map((d) => d.id)], "system", {
    title: `New client signed: ${p.deal.name}`,
    body: `${formatRand(t.dueNow)} paid${t.monthly ? ` · ${formatRand(t.monthly)}/month` : ""}`,
    link: `/clients/${clientId}`,
  });
  await logActivity(p.dealId, "SYSTEM", `Proposal ${proposalNumber(p.number)} accepted and paid. Client, projects and onboarding created; welcome pack with upload link queued.`);
}

/** Sets up the monthly retainer at Paystack, reusing the card from the first payment. */
async function paystackSubscribe(payload: Payload) {
  const sub = await db.subscription.findUnique({ where: { id: String(payload.subscriptionId) }, include: { proposal: { include: { deal: true } } } });
  if (!sub || sub.subscriptionCode) return;
  const authorization = payload.authorization ? decrypt(String(payload.authorization)) : null;
  if (!authorization || !payload.customerCode) {
    await db.subscription.update({ where: { id: sub.id }, data: { lastError: "Card can't be reused (paid by another method). Bill this retainer manually." } });
    await notify([sub.proposal.deal.ownerId], "system", { title: `Set up billing manually for ${sub.proposal.deal.name}`, body: "Their payment method can't be charged monthly.", link: `/proposals/${sub.proposalId}` });
    return;
  }
  const planCode = sub.planCode ?? (await createPlan(`Outset retainer ${proposalNumber(sub.proposal.number)} ${sub.proposal.deal.name}`.slice(0, 100), sub.amountCents)).plan_code;
  if (!sub.planCode) await db.subscription.update({ where: { id: sub.id }, data: { planCode } });
  const created = await createSubscription({
    customer: String(payload.customerCode),
    plan: planCode,
    authorization,
    startDate: new Date(`${(sub.nextPaymentDate ?? new Date()).toISOString().slice(0, 10)}T08:00:00+02:00`),
  });
  await db.subscription.update({
    where: { id: sub.id },
    data: { subscriptionCode: created.subscription_code, status: "ACTIVE", lastError: null, nextPaymentDate: created.next_payment_date ? new Date(created.next_payment_date) : sub.nextPaymentDate },
  });
  await logActivity(sub.proposal.dealId, "SYSTEM", `Monthly retainer of ${formatRand(sub.amountCents)} set up at Paystack (${created.subscription_code}).`);
}

// ---------- Daily housekeeping ----------

/** Runs once a day (06:00 SAST) and schedules the next run. */
async function dailyJob() {
  const today = parseISODate(todayISO())!;
  const due = await db.resource.findMany({ where: { status: "PUBLISHED", reviewDue: { lte: today }, reviewNotifiedAt: null } });
  for (const r of due) {
    const directors = r.ownerId ? [] : await db.user.findMany({ where: { role: "DIRECTOR", active: true }, select: { id: true } });
    await notify([r.ownerId, ...directors.map((d) => d.id)], "system", { title: `Time to review: ${r.title}`, body: "This SOP's review date has arrived.", link: `/resources/${r.id}` });
    await db.resource.update({ where: { id: r.id }, data: { reviewNotifiedAt: new Date() } });
  }
  await scheduleNextDaily();
}

export async function scheduleNextDaily() {
  const pending = await db.job.findFirst({ where: { name: "daily", doneAt: null, runAt: { gt: new Date() } } });
  if (pending) return;
  const tomorrow = addDays(todayISO(), 1);
  await enqueue("daily", {}, new Date(`${tomorrow}T06:00:00+02:00`));
}
