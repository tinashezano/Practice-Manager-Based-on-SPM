import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { recordRenewal, verifyAndConfirm } from "@/lib/proposals";
import { verifyWebhookSignature } from "@/lib/paystack";

export const dynamic = "force-dynamic";

type PaystackEvent = {
  event: string;
  data: {
    id?: number;
    reference?: string;
    plan?: { plan_code?: string } | string | null;
    subscription_code?: string;
    next_payment_date?: string | null;
    subscription?: { subscription_code?: string };
  };
};

/**
 * Paystack webhook. Set this URL in Paystack → Settings → API Keys & Webhooks.
 * The signature is checked, and payments are re-verified with Paystack's API
 * before anything changes.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const evt = JSON.parse(raw) as PaystackEvent;
  const key = `paystack:${evt.event}:${evt.data.id ?? evt.data.reference ?? evt.data.subscription_code ?? raw.length}`;
  if (await db.eventLog.findUnique({ where: { idempotencyKey: key } })) return Response.json({ ok: true, duplicate: true });

  try {
    const code = evt.data.subscription_code ?? evt.data.subscription?.subscription_code;
    switch (evt.event) {
      case "charge.success": {
        const ref = evt.data.reference;
        if (!ref) break;
        const planCode = typeof evt.data.plan === "object" ? evt.data.plan?.plan_code : undefined;
        // Our own checkout references are known; monthly retainer charges are new each month.
        if (await db.payment.findUnique({ where: { reference: ref } })) await verifyAndConfirm(ref);
        else if (planCode) await recordRenewal(ref, planCode);
        break;
      }
      case "subscription.create":
        if (code) await db.subscription.updateMany({ where: { subscriptionCode: code }, data: { status: "ACTIVE", nextPaymentDate: evt.data.next_payment_date ? new Date(evt.data.next_payment_date) : undefined } });
        break;
      case "invoice.payment_failed":
      case "subscription.not_renew":
      case "subscription.disable": {
        if (!code) break;
        const status = evt.event === "invoice.payment_failed" ? "PAST_DUE" : "CANCELLED";
        const sub = await db.subscription.findUnique({ where: { subscriptionCode: code }, include: { proposal: { include: { deal: true } }, client: true } });
        if (!sub) break;
        await db.subscription.update({ where: { id: sub.id }, data: { status } });
        const directors = await db.user.findMany({ where: { role: "DIRECTOR", active: true }, select: { id: true } });
        await notify([sub.proposal.deal.ownerId, ...directors.map((d) => d.id)], "system", {
          title: status === "PAST_DUE" ? `Retainer payment failed: ${sub.client?.name ?? sub.proposal.deal.name}` : `Retainer cancelled: ${sub.client?.name ?? sub.proposal.deal.name}`,
          link: sub.clientId ? `/clients/${sub.clientId}` : `/proposals/${sub.proposalId}`,
        });
        break;
      }
    }
    await db.eventLog.create({ data: { type: `paystack.${evt.event}`, payload: JSON.parse(raw), idempotencyKey: key, processedAt: new Date() } });
  } catch (err) {
    console.error("[paystack] webhook failed:", err);
    // A 500 makes Paystack retry later.
    return new Response("Error", { status: 500 });
  }
  return Response.json({ ok: true });
}
