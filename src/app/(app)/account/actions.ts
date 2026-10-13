"use server";

import { db } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";

export type ActionState = { error?: string; ok?: string };

export async function changeOwnPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Your current password is wrong." };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== confirm) return { error: "The new passwords don't match." };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: "Password changed." };
}
