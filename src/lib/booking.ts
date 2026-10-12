import type { Booking, BookingLink, User } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { computeSlots, firmClock, firmDate, type Interval } from "@/lib/availability";
import { randomToken } from "@/lib/crypto";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { createDeal, logActivity } from "@/lib/deals";
import { emitEvent } from "@/lib/events";
import { cancelEvent, createEvent, freeBusy, getConnection, moveEvent } from "@/lib/google";

export function bookingUrl(slug: string) {
  return appUrl(`/book/${slug}`);
}

export function manageUrl(token: string) {
  return appUrl(`/book/manage/${token}`);
}

/** "Tue 14 Oct 2026, 10:30 SAST" */
export function formatWhen(d: Date) {
  return `${formatDate(firmDate(d), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, ${firmClock(d)} SAST`;
}

/** Host's busy times: confirmed bookings in Outset PM plus their Google Calendar (if connected). */
async function busyFor(hostId: string, from: Date, to: Date, ignoreBookingId?: string): Promise<Interval[]> {
  const bookings = await db.booking.findMany({
    where: { hostId, status: "CONFIRMED", startsAt: { lt: to }, endsAt: { gt: from }, id: ignoreBookingId ? { not: ignoreBookingId } : undefined },
    select: { startsAt: true, endsAt: true, googleEventId: true },
  });
  const busy: Interval[] = bookings.map((b) => ({ start: b.startsAt, end: b.endsAt }));
  if (await getConnection(hostId)) {
    try {
      // Google already contains our own booked events; overlapping intervals are harmless.
      busy.push(...(await freeBusy(hostId, from, to)));
    } catch (err) {
      console.error("[booking] Google free/busy failed, using Outset PM bookings only:", err);
    }
  }
  return busy;
}

export async function availableSlots(link: BookingLink, ignoreBookingId?: string) {
  const from = new Date();
  const to = new Date(from.getTime() + (link.maxDaysAhead + 1) * 86_400_000);
  return computeSlots(link, await busyFor(link.hostId, from, to, ignoreBookingId), from);
}

async function slotIsFree(link: BookingLink, start: Date, ignoreBookingId?: string) {
  const slots = await availableSlots(link, ignoreBookingId);
  return (slots[firmDate(start)] ?? []).some((s) => s.getTime() === start.getTime());
}

export type BookingRequest = { start: Date; name: string; email: string; phone?: string | null; company?: string | null; message?: string | null; popiaConsent: boolean };

function eventDescription(b: Pick<Booking, "name" | "email" | "phone" | "company" | "message">) {
  return [`Booked via Outset PM`, `Name: ${b.name}`, `Email: ${b.email}`, b.phone && `Phone: ${b.phone}`, b.company && `Company: ${b.company}`, b.message && `\n${b.message}`]
    .filter(Boolean)
    .join("\n");
}

/** Books a slot: links (or creates) the lead, adds the Google event with a Meet link, and fires booking.confirmed. */
export async function createBooking(link: BookingLink & { host: User }, req: BookingRequest) {
  if (!(await slotIsFree(link, req.start))) return { ok: false as const, error: "Sorry, that time was just taken. Please choose another." };
  const email = req.email.trim().toLowerCase();

  let deal = await db.deal.findFirst({ where: { email, stage: { notIn: ["WON", "LOST"] } }, orderBy: { createdAt: "desc" } });
  if (!deal) {
    deal = await createDeal(
      { name: req.company?.trim() || req.name.trim(), contactName: req.name.trim(), email, phone: req.phone, notes: req.message, source: "BOOKING_PAGE", ownerId: link.hostId, popiaConsent: req.popiaConsent },
      null,
    );
  }

  const end = new Date(req.start.getTime() + link.durationMinutes * 60_000);
  let booking = await db.booking.create({
    data: {
      bookingLinkId: link.id,
      hostId: link.hostId,
      dealId: deal.id,
      startsAt: req.start,
      endsAt: end,
      name: req.name.trim(),
      email,
      phone: req.phone || null,
      company: req.company || null,
      message: req.message || null,
      manageToken: randomToken(),
    },
  });

  if (await getConnection(link.hostId)) {
    try {
      const ev = await createEvent(link.hostId, {
        summary: `${link.title}: ${booking.company ?? booking.name}`,
        description: `${eventDescription(booking)}\n\nReschedule or cancel: ${manageUrl(booking.manageToken)}`,
        start: booking.startsAt,
        end: booking.endsAt,
        attendee: { email, name: booking.name },
        requestId: booking.id,
      });
      booking = await db.booking.update({ where: { id: booking.id }, data: { googleEventId: ev.id, meetUrl: ev.meetUrl } });
    } catch (err) {
      console.error("[booking] Google event creation failed:", err);
      await logActivity(deal.id, "SYSTEM", `Couldn't add the call to ${link.host.name}'s Google Calendar: ${err instanceof Error ? err.message : err}`);
    }
  }

  await logActivity(deal.id, "BOOKING", `${link.title} booked for ${formatWhen(booking.startsAt)} with ${link.host.name}.`);
  await emitEvent("booking.confirmed", { bookingId: booking.id });
  return { ok: true as const, booking };
}

export async function rescheduleBooking(token: string, start: Date) {
  const booking = await db.booking.findUnique({ where: { manageToken: token }, include: { bookingLink: true } });
  if (!booking || booking.status !== "CONFIRMED") return { ok: false as const, error: "This booking can no longer be changed." };
  if (!(await slotIsFree(booking.bookingLink, start, booking.id))) return { ok: false as const, error: "Sorry, that time was just taken. Please choose another." };
  const end = new Date(start.getTime() + booking.bookingLink.durationMinutes * 60_000);
  await db.booking.update({ where: { id: booking.id }, data: { startsAt: start, endsAt: end } });
  if (booking.googleEventId) {
    await moveEvent(booking.hostId, booking.googleEventId, start, end).catch((err) => console.error("[booking] Google reschedule failed:", err));
  }
  if (booking.dealId) await logActivity(booking.dealId, "BOOKING", `Call rescheduled from ${formatWhen(booking.startsAt)} to ${formatWhen(start)}.`);
  await emitEvent("booking.rescheduled", { bookingId: booking.id });
  return { ok: true as const };
}

export async function cancelBooking(token: string) {
  const booking = await db.booking.findUnique({ where: { manageToken: token } });
  if (!booking || booking.status !== "CONFIRMED") return { ok: false as const, error: "This booking is already cancelled." };
  await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
  if (booking.googleEventId) {
    await cancelEvent(booking.hostId, booking.googleEventId).catch((err) => console.error("[booking] Google cancel failed:", err));
  }
  if (booking.dealId) await logActivity(booking.dealId, "BOOKING", `Call on ${formatWhen(booking.startsAt)} was cancelled by the lead.`);
  await emitEvent("booking.cancelled", { bookingId: booking.id });
  return { ok: true as const };
}
