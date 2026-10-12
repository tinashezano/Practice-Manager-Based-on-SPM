import { createHmac, timingSafeEqual } from "node:crypto";

// Paystack REST client. Mode comes from the secret key:
//   sk_test_… → Paystack test mode (test cards, no real money)
//   sk_live_… → live payments
//   no key    → "simulated" outside production (a fake checkout for local
//               development), "off" in production.

export type PaystackMode = "live" | "test" | "simulated" | "off";

export function paystackMode(): PaystackMode {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return process.env.NODE_ENV === "production" ? "off" : "simulated";
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !json.status) throw new Error(`Paystack ${path}: ${json.message ?? res.status}`);
  return json.data as T;
}

export async function initializeTransaction(p: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  /** Cards only, so the authorisation can be reused for the monthly retainer. */
  cardOnly: boolean;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("POST", "/transaction/initialize", {
    email: p.email,
    amount: p.amountCents,
    currency: "ZAR",
    reference: p.reference,
    callback_url: p.callbackUrl,
    metadata: p.metadata,
    ...(p.cardOnly ? { channels: ["card"] } : {}),
  });
}

export type VerifiedTransaction = {
  status: string; // "success" | "failed" | "abandoned" | …
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  paid_at: string | null;
  customer: { customer_code: string; email: string };
  authorization: { authorization_code: string; reusable: boolean } | null;
  metadata: Record<string, unknown> | null;
};

export async function verifyTransaction(reference: string) {
  return call<VerifiedTransaction>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createPlan(name: string, amountCents: number) {
  return call<{ plan_code: string }>("POST", "/plan", { name, amount: amountCents, interval: "monthly", currency: "ZAR" });
}

export async function createSubscription(p: { customer: string; plan: string; authorization: string; startDate: Date }) {
  return call<{ subscription_code: string; next_payment_date: string | null; status: string }>("POST", "/subscription", {
    customer: p.customer,
    plan: p.plan,
    authorization: p.authorization,
    start_date: p.startDate.toISOString(),
  });
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
