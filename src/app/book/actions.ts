"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelBooking, createBooking, rescheduleBooking } from "@/lib/booking";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rate-limit";

export type BookState = { error?: string };

const schema = z.object({
  start: z.string().datetime(),
  name: z.string().trim().min(2, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email").max(200),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().max(3000).optional(),
  consent: z.literal("on", { message: "Please agree to how we use your information" }),
});

export async function bookSlot(slug: string, _: BookState, fd: FormData): Promise<BookState> {
  if (fd.get("website")) return { error: "Something went wrong." }; // honeypot
  if (await rateLimited("book", 10, 3_600_000)) return { error: "Too many attempts. Please try again later." };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const link = await db.bookingLink.findUnique({ where: { slug }, include: { host: true } });
  if (!link?.active) return { error: "This booking page is no longer available." };

  const { start, consent, ...rest } = parsed.data;
  const r = await createBooking(link, { ...rest, start: new Date(start), popiaConsent: consent === "on" });
  if (!r.ok) return { error: r.error };
  redirect(`/book/manage/${r.booking.manageToken}?booked=1`);
}

export async function reschedule(token: string, _: BookState, fd: FormData): Promise<BookState> {
  if (await rateLimited("book", 10, 3_600_000)) return { error: "Too many attempts. Please try again later." };
  const start = z.string().datetime().safeParse(fd.get("start"));
  if (!start.success) return { error: "Choose a new time" };
  const r = await rescheduleBooking(token, new Date(start.data));
  if (!r.ok) return { error: r.error };
  redirect(`/book/manage/${token}?moved=1`);
}

export async function cancel(token: string): Promise<BookState> {
  const r = await cancelBooking(token);
  if (!r.ok) return { error: r.error };
  redirect(`/book/manage/${token}?cancelled=1`);
}
