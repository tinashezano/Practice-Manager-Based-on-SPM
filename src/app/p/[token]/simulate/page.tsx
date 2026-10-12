import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { PublicShell } from "@/components/public/shell";
import { Button, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { formatRand } from "@/lib/money";
import { paystackMode } from "@/lib/paystack";
import { simulatePayment } from "../../actions";

export const dynamic = "force-dynamic";

// Stand-in for Paystack checkout when no Paystack keys are set (never in production).
export default async function SimulatedCheckout({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ reference?: string }> }) {
  if (paystackMode() !== "simulated") notFound();
  const { token } = await params;
  const { reference } = await searchParams;
  const payment = reference ? await db.payment.findUnique({ where: { reference } }) : null;
  if (!payment) notFound();
  return (
    <PublicShell>
      <Card className="mx-auto max-w-md p-8 text-center">
        <FlaskConical size={28} className="mx-auto text-warning" />
        <h1 className="mt-3 text-lg font-semibold">Simulated checkout</h1>
        <p className="mt-1 text-sm text-muted">No Paystack keys are configured, so this stands in for Paystack&apos;s payment page. Add <code>PAYSTACK_SECRET_KEY=sk_test_…</code> to use real Paystack test mode.</p>
        <div className="my-6 text-2xl font-semibold">{formatRand(payment.amountCents)}</div>
        <form action={async () => { "use server"; await simulatePayment(token, payment.reference); }} className="flex flex-col gap-2">
          <Button>Simulate successful payment</Button>
          <a href={`/p/${token}?failed=1`} className="text-sm text-muted hover:text-foreground">Simulate a failed payment</a>
        </form>
      </Card>
    </PublicShell>
  );
}
