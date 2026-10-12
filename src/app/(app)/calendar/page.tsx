import clsx from "clsx";
import Link from "next/link";
import { CalendarDays, CheckSquare, Video } from "lucide-react";
import { GoogleConnectCard } from "@/components/google-connect";
import { Card, PageHeader } from "@/components/ui";
import { firmClock, firmDate } from "@/lib/availability";
import { addDays, formatDate, parseISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { getConnection, listEvents } from "@/lib/google";
import { requireUser } from "@/lib/session";
import { taskHome } from "@/lib/task-meta";

export const metadata = { title: "Calendar" };

type Item = { key: string; date: string; time: string | null; title: string; sub?: string; href?: string; external?: boolean; meetUrl?: string | null; kind: "google" | "booking" | "task" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const user = await requireUser();
  const { google } = await searchParams;
  const today = todayISO();
  const end = addDays(today, 13);
  const from = new Date(`${today}T00:00:00+02:00`);
  const to = new Date(`${addDays(end, 1)}T00:00:00+02:00`);

  const [tasks, bookings, conn] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: user.id, status: { not: "DONE" }, dueDate: { gte: parseISODate(today)!, lte: parseISODate(end)! } },
      include: { client: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.booking.findMany({ where: { hostId: user.id, status: "CONFIRMED", startsAt: { gte: from, lt: to } }, include: { deal: { select: { id: true, name: true } } } }),
    getConnection(user.id),
  ]);

  let googleItems: Item[] = [];
  let googleError: string | null = null;
  if (conn) {
    try {
      const bookedIds = new Set(bookings.map((b) => b.googleEventId));
      googleItems = (await listEvents(user.id, from, to))
        .filter((e) => !bookedIds.has(e.id))
        .map((e) => ({ key: `g${e.id}`, date: firmDate(e.start), time: e.allDay ? null : firmClock(e.start), title: e.title, href: e.link, external: true, meetUrl: e.meetUrl, kind: "google" }));
    } catch (err) {
      googleError = err instanceof Error ? err.message : String(err);
    }
  }

  const items: Item[] = [
    ...googleItems,
    ...bookings.map((b): Item => ({ key: `b${b.id}`, date: firmDate(b.startsAt), time: firmClock(b.startsAt), title: `Discovery call: ${b.deal?.name ?? b.name}`, href: b.deal ? `/deals/${b.deal.id}` : undefined, meetUrl: b.meetUrl, kind: "booking" })),
    ...tasks.map((t): Item => ({ key: `t${t.id}`, date: t.dueDate!.toISOString().slice(0, 10), time: null, title: t.title, sub: taskHome(t).name, href: `/tasks?task=${t.id}`, kind: "task" })),
  ];
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <>
      <PageHeader title="Calendar" subtitle="Your next two weeks: Google Calendar events, discovery calls and tasks due." />
      {!conn && <div className="mb-6"><GoogleConnectCard userId={user.id} back="/calendar" status={google} /></div>}
      {googleError && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-warning">Couldn&apos;t load Google Calendar: {googleError}</p>}
      <Card className="divide-y divide-border p-0">
        {days.map((d) => {
          const dayItems = items.filter((i) => i.date === d).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
          const weekend = [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
          if (!dayItems.length && weekend) return null;
          return (
            <div key={d} className="flex gap-4 px-5 py-3">
              <div className={clsx("w-28 shrink-0 text-sm", d === today ? "font-semibold text-brand" : "text-muted")}>
                {d === today ? "Today" : formatDate(d, { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {dayItems.map((i) => {
                  const Icon = i.kind === "task" ? CheckSquare : i.kind === "booking" ? Video : CalendarDays;
                  const content = (
                    <span className="flex items-center gap-2 text-sm">
                      <Icon size={14} className={i.kind === "task" ? "text-amber-500" : i.kind === "booking" ? "text-green-600" : "text-brand"} />
                      <span className="w-12 shrink-0 text-xs text-muted">{i.time ?? (i.kind === "task" ? "Due" : "All day")}</span>
                      <span className="truncate">{i.title}</span>
                      {i.sub && <span className="truncate text-xs text-muted">· {i.sub}</span>}
                    </span>
                  );
                  return (
                    <div key={i.key} className="flex items-center gap-2">
                      {i.href ? (i.external ? <a href={i.href} target="_blank" className="min-w-0 hover:text-brand">{content}</a> : <Link href={i.href} className="min-w-0 hover:text-brand">{content}</Link>) : content}
                      {i.meetUrl && <a href={i.meetUrl} target="_blank" className="text-xs text-brand">Meet</a>}
                    </div>
                  );
                })}
                {!dayItems.length && <span className="text-xs text-muted">Nothing scheduled</span>}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}
