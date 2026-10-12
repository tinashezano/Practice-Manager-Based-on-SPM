"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { paystackMode } from "@/lib/paystack";
import { acceptByClick, confirmPayment, startCheckout } from "@/lib/proposals";
import { rateLimited } from "@/lib/rate-limit";

export type PublicState = { error?: string };

export async function accept(token: string, _: PublicState, fd: FormData): Promise<PublicState> {
  if (await rateLimited("proposal", 20, 3_600_000)) return { error: "Too many attempts. Please try again later." };
  const parsed = z
    .object({
      name: z.string().trim().min(3, "Type your full name to sign").max(200),
      agree: z.literal("on", { message: "Tick the box to confirm you accept" }),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const h = await headers();
  const r = await acceptByClick(token, {
    name: parsed.data.name,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown",
    userAgent: h.get("user-agent") ?? "",
  });
  if (!r.ok) return { error: r.error };
  redirect(`/p/${token}?signed=1`);
}

export async function pay(token: string): Promise<PublicState> {
  if (await rateLimited("proposal", 20, 3_600_000)) return { error: "Too many attempts. Please try again later." };
  const r = await startCheckout(token);
  if (!r.ok) return { error: r.error };
  redirect(r.url);
}

/** Development only: completes a simulated payment. */
export async function simulatePayment(token: string, reference: string) {
  if (paystackMode() !== "simulated") throw new Error("Simulated payments are disabled");
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.provider !== "SIMULATED") throw new Error("Unknown simulated payment");
  await confirmPayment(reference, { amount: payment.amountCents, currency: "ZAR", channel: "simulated card", customerCode: "CUS_simulated" });
  redirect(`/p/${token}?paid=1`);
}
