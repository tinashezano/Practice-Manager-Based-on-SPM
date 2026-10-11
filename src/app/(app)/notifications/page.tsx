import clsx from "clsx";
import { Bell } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { markAllRead, openNotification } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread > 0 && <form action={markAllRead}><Button variant="secondary">Mark all as read</Button></form>}
      />
      <Card className="divide-y divide-border p-0">
        {items.map((n) => (
          <form key={n.id} action={openNotification}>
            <input type="hidden" name="id" value={n.id} />
            <button className={clsx("flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-background", !n.readAt && "bg-brand-soft/50")}>
              <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")} />
              <span className="min-w-0 flex-1">
                <span className={clsx("block text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{formatDateTime(n.createdAt)}</span>
            </button>
          </form>
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center py-14 text-sm text-muted">
            <Bell size={20} className="mb-2" /> Notifications about your tasks, reviews and comments appear here.
          </div>
        )}
      </Card>
    </>
  );
}
