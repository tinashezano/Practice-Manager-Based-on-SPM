import Link from "next/link";
import { ExternalLink, Video } from "lucide-react";
import { GoogleConnectCard } from "@/components/google-connect";
import { Badge, Card, PageHeader } from "@/components/ui";
import { appUrl } from "@/lib/app-url";
import { bookingUrl, formatWhen } from "@/lib/booking";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { CopyButton, EditLink, NewLinkButton } from "./link-editor";

export const metadata = { title: "Booking Links" };

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function BookingLinksPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await requirePermission("deals.manage");
  const { google } = await searchParams;
  const [links, staff, upcoming] = await Promise.all([
    db.bookingLink.findMany({ include: { host: { select: { name: true } } }, orderBy: [{ active: "desc" }, { isDefault: "desc" }, { title: "asc" }] }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.booking.findMany({
      where: { status: "CONFIRMED", startsAt: { gte: new Date() } },
      include: { host: { select: { name: true } }, deal: { select: { id: true, name: true } } },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Booking Links"
        subtitle="Discovery-call booking pages. Share the link, or let the automation email it to new leads."
        actions={<NewLinkButton staff={staff} currentUserId={user.id} />}
      />
      <div className="mb-6"><GoogleConnectCard userId={user.id} back="/deals/booking" status={google} /></div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {links.map((l) => (
          <Card key={l.id} className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{l.title}</span>
                {l.isDefault && <Badge tone="brand">Default</Badge>}
                {!l.active && <Badge>Inactive</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {l.durationMinutes} min · {l.host.name} · {l.days.map((d) => DAY_NAMES[d]).join(", ")} {l.startTime}–{l.endTime} SAST
              </div>
              <a href={bookingUrl(l.slug)} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs text-brand">{bookingUrl(l.slug)} <ExternalLink size={11} /></a>
            </div>
            <div className="flex gap-2">
              <CopyButton text={bookingUrl(l.slug)} />
              <EditLink link={l} staff={staff} currentUserId={user.id} />
            </div>
          </Card>
        ))}
        {!links.length && (
          <Card className="text-sm text-muted lg:col-span-2">No booking links yet. Create a “Discovery Call” link and mark it as default so new leads get it automatically.</Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Upcoming calls</div>
          <div className="divide-y divide-border">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div>{formatWhen(b.startsAt)}</div>
                  <div className="truncate text-xs text-muted">{b.deal ? <Link href={`/deals/${b.deal.id}`} className="hover:text-brand">{b.deal.name}</Link> : b.name} · with {b.host.name}</div>
                </div>
                {b.meetUrl && <a href={b.meetUrl} target="_blank" className="text-brand" aria-label="Google Meet"><Video size={16} /></a>}
              </div>
            ))}
            {!upcoming.length && <p className="px-4 py-8 text-center text-sm text-muted">No upcoming calls.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Website enquiry form</h2>
          <p className="mt-1 text-sm text-muted">Link to this form from your website (or embed it in an iframe). Each submission creates a lead and starts the automations.</p>
          <div className="mt-3 flex items-center gap-2">
            <a href={appUrl("/enquiry")} target="_blank" className="truncate text-sm text-brand">{appUrl("/enquiry")}</a>
            <CopyButton text={appUrl("/enquiry")} />
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-[11px] text-muted">{`<iframe src="${appUrl("/enquiry")}?embed=1" style="width:100%;height:760px;border:0"></iframe>`}</pre>
        </Card>
      </div>
    </>
  );
}
