"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { paystackMode } from "@/lib/paystack";
import { acceptProposal, confirmPayment, startCheckout } from "@/lib/proposals";
import { rateLimited } from "@/lib/rate-limit";

export type PublicState = { error?: string };

/** The client signs: their answers to the document's fields, plus a typed name if it has no signature field. */
export async function accept(token: string, input: { responses: Record<string, unknown>; typedName: string; agree: boolean }): Promise<PublicState> {
  if (await rateLimited("proposal", 20, 3_600_000)) return { error: "Too many attempts. Please try again later." };
  if (!input.agree) return { error: "Tick the box to confirm you accept." };
  if (JSON.stringify(input.responses ?? {}).length > 1_000_000) return { error: "Your answers are too large. Please draw a simpler signature." };
  const h = await headers();
  const r = await acceptProposal(token, {
    responses: input.responses ?? {},
    typedName: String(input.typedName ?? "").slice(0, 200),
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
