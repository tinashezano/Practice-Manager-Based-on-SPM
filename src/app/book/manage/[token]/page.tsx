import { notFound } from "next/navigation";
import { CheckCircle2, Video } from "lucide-react";
import { PublicShell } from "@/components/public/shell";
import { SlotPicker } from "@/components/public/slot-picker";
import { Button, Card } from "@/components/ui";
import { availableSlots, formatWhen } from "@/lib/booking";
import { db } from "@/lib/db";
import { cancel, reschedule } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your booking" };

export default async function ManageBookingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ booked?: string; moved?: string; cancelled?: string; change?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const booking = await db.booking.findUnique({ where: { manageToken: token }, include: { bookingLink: true, host: { select: { name: true } } } });
  if (!booking) notFound();
  const confirmed = booking.status === "CONFIRMED";
  const changeable = confirmed && booking.startsAt > new Date();

  let picker: React.ReactNode = null;
  if (changeable && sp.change) {
    const slots = await availableSlots(booking.bookingLink, booking.id);
    picker = (
      <div className="mt-6 border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Pick a new time</h2>
        <SlotPicker slots={Object.fromEntries(Object.entries(slots).map(([d, s]) => [d, s.map((x) => x.toISOString())]))} action={reschedule.bind(null, token)} mode="reschedule" />
      </div>
    );
  }

  return (
    <PublicShell>
      <Card className="p-6 sm:p-8">
        {(sp.booked || sp.moved) && confirmed && (
          <div className="mb-5 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-success">
            <CheckCircle2 size={18} /> {sp.booked ? "You're booked! A confirmation is on its way to your inbox." : "Your call has been moved."}
          </div>
        )}
        {sp.cancelled && <div className="mb-5 rounded-lg bg-background px-4 py-3 text-sm">Your call has been cancelled. You&apos;re welcome to book again any time.</div>}
        <h1 className="text-xl font-semibold">{booking.bookingLink.title}</h1>
        <p className="mt-2 text-sm">
          <span className={confirmed ? "font-medium" : "text-muted line-through"}>{formatWhen(booking.startsAt)}</span> with {booking.host.name}
        </p>
        {!confirmed && <p className="mt-1 text-sm text-muted">This booking is {booking.status.toLowerCase()}.</p>}
        {confirmed && booking.meetUrl && (
          <a href={booking.meetUrl} className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand"><Video size={15} /> Join with Google Meet</a>
        )}
        {changeable && !sp.change && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
            <a href={`/book/manage/${token}?change=1`}><Button variant="secondary">Reschedule</Button></a>
            <form action={async () => { "use server"; await cancel(token); }}>
              <Button variant="ghost" className="text-danger">Cancel booking</Button>
            </form>
          </div>
        )}
        {!confirmed && <a href={`/book/${booking.bookingLink.slug}`} className="mt-6 inline-block text-sm text-brand">Book a new time →</a>}
        {picker}
      </Card>
    </PublicShell>
  );
}
