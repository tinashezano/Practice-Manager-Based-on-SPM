import { notFound } from "next/navigation";
import { Clock, Video } from "lucide-react";
import { PublicShell } from "@/components/public/shell";
import { SlotPicker } from "@/components/public/slot-picker";
import { Card } from "@/components/ui";
import { availableSlots } from "@/lib/booking";
import { db } from "@/lib/db";
import { bookSlot } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await db.bookingLink.findUnique({ where: { slug } });
  return { title: link ? `Book a ${link.title}` : "Booking" };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await db.bookingLink.findUnique({ where: { slug }, include: { host: { select: { name: true } } } });
  if (!link?.active) notFound();
  const slots = await availableSlots(link);
  const serial = Object.fromEntries(Object.entries(slots).map(([d, s]) => [d, s.map((x) => x.toISOString())]));

  return (
    <PublicShell>
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-semibold">{link.title}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {link.durationMinutes} minutes</span>
          <span className="inline-flex items-center gap-1.5"><Video size={14} /> Online · with {link.host.name}</span>
        </div>
        {link.description && <p className="mt-3 text-sm">{link.description}</p>}
        <div className="mt-6 border-t border-border pt-6">
          <SlotPicker slots={serial} action={bookSlot.bind(null, slug)} mode="book" />
        </div>
      </Card>
    </PublicShell>
  );
}
