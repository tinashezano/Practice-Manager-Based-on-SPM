"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

/** Marks one notification read, then follows its link. */
export async function openNotification(formData: FormData) {
  const user = await requireUser();
  const n = await db.notification.findFirst({ where: { id: String(formData.get("id")), userId: user.id } });
  if (!n) return;
  if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  redirect(n.link ?? "/notifications");
}
