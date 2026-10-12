"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createDeal } from "@/lib/deals";
import { rateLimited } from "@/lib/rate-limit";

export type EnquiryState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email").max(200),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  services: z.array(z.string().max(100)).max(20),
  message: z.string().trim().max(3000).optional(),
  consent: z.literal("on", { message: "Please agree to how we use your information" }),
});

export async function submitEnquiry(embed: boolean, _: EnquiryState, fd: FormData): Promise<EnquiryState> {
  const done = `/enquiry?sent=1${embed ? "&embed=1" : ""}`;
  if (fd.get("website")) redirect(done); // honeypot: pretend it worked
  if (await rateLimited("enquiry", 5, 3_600_000)) return { error: "Too many submissions. Please try again later." };
  const parsed = schema.safeParse({ ...Object.fromEntries(fd), services: fd.getAll("services") });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const d = parsed.data;
  const email = d.email.toLowerCase();

  // Same person enquiring again while their deal is open: add a note instead of a duplicate lead.
  const open = await db.deal.findFirst({ where: { email, stage: { notIn: ["WON", "LOST"] } } });
  if (open) {
    await db.dealActivity.create({ data: { dealId: open.id, type: "NOTE", body: `New website enquiry: ${[d.services.join(", "), d.message].filter(Boolean).join(" · ") || "(no message)"}` } });
  } else {
    await createDeal(
      {
        name: d.company || d.name,
        contactName: d.name,
        email,
        phone: d.phone || null,
        servicesInterest: d.services.join(", ") || null,
        notes: d.message || null,
        source: "WEBSITE_FORM",
        popiaConsent: true,
      },
      null,
    );
  }
  redirect(done);
}
