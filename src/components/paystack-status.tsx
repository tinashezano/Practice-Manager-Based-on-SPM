import { CreditCard } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { appUrl } from "@/lib/app-url";
import { paystackMode } from "@/lib/paystack";

const MODES = {
  live: { badge: <Badge tone="success">Live</Badge>, text: "Real payments are being taken." },
  test: { badge: <Badge tone="warning">Test mode</Badge>, text: "Using your sk_test_ key: use Paystack's test cards, no real money moves. Switch to the sk_live_ key when you're ready." },
  simulated: { badge: <Badge tone="warning">Simulated</Badge>, text: "No Paystack key set. On development machines, checkout is simulated so the flow can be tested. Add PAYSTACK_SECRET_KEY=sk_test_… to use Paystack test mode." },
  off: { badge: <Badge tone="danger">Not configured</Badge>, text: "Add PAYSTACK_SECRET_KEY in Railway to accept payments. Until then, record EFT payments manually on each proposal." },
};

export function PaystackStatus() {
  const mode = paystackMode();
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CreditCard size={16} className="text-brand" /> Paystack {MODES[mode].badge}</div>
      <p className="text-sm text-muted">{MODES[mode].text}</p>
      <div className="mt-3 text-xs text-muted">
        Webhook URL (Paystack → Settings → API Keys & Webhooks):
        <code className="mt-1 block break-all rounded bg-background px-2 py-1 text-foreground">{appUrl("/api/paystack/webhook")}</code>
      </div>
    </Card>
  );
}
