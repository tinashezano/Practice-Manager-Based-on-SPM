import { db } from "@/lib/db";

/** In-app notifications. Never notifies the person who caused the change. */
export async function notify(
  userIds: (string | null | undefined)[],
  actorId: string,
  n: { title: string; body?: string; link?: string },
) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id && id !== actorId))];
  if (recipients.length === 0) return;
  await db.notification.createMany({ data: recipients.map((userId) => ({ userId, ...n })) });
}
