import { CalendarCheck2, CircleAlert } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/google";

const MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  connected: { text: "Google connected. Bookings will use your calendar and emails will send from your Gmail.", ok: true },
  denied: { text: "Google access wasn't granted." },
  failed: { text: "Connecting Google failed. Please try again." },
  "state-mismatch": { text: "That sign-in link expired. Please try again." },
  "not-configured": { text: "Google isn't set up for this app yet. A Director needs to add the Google OAuth keys (see README)." },
};

/** Shows the signed-in user's Google Calendar/Gmail connection with a connect button. */
export async function GoogleConnectCard({ userId, back, status }: { userId: string; back: string; status?: string }) {
  const configured = googleConfigured();
  const conn = configured ? await db.googleConnection.findUnique({ where: { userId } }) : null;
  const msg = status ? MESSAGES[status] : undefined;
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"><CalendarCheck2 size={20} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          Google Calendar & Gmail {conn ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {conn
            ? `Using ${conn.googleEmail}: availability comes from your calendar, calls get a Google Meet link, and automated emails send from your Gmail.`
            : "Connect so booking pages check your real availability, calls appear in your calendar with a Meet link, and automated emails send from your Gmail. Without it, booking pages use your working hours only and emails aren't sent."}
        </p>
        {msg && <p className={`mt-1 inline-flex items-center gap-1 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{!msg.ok && <CircleAlert size={12} />}{msg.text}</p>}
      </div>
      <a href={`/api/google/connect?back=${encodeURIComponent(back)}`} className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-background">
        {conn ? "Reconnect" : "Connect Google"}
      </a>
    </Card>
  );
}
