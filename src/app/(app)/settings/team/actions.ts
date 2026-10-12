"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { requirePermission } from "@/lib/session";

export type ActionState = { error?: string; ok?: string };

const addSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.nativeEnum(Role),
  weeklyCapacityHours: z.coerce.number().int().min(0).max(80),
});

export async function addStaff(_: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("team.manage");
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (domain && !parsed.data.email.endsWith(`@${domain.toLowerCase()}`)) {
    return { error: `Staff must use an @${domain} email address.` };
  }
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) {
    return { error: "That email is already on the team." };
  }

  const user = await db.user.create({ data: parsed.data });
  await emitEvent("user.invited", { userId: user.id, role: user.role }, { actorId: actor.id });
  revalidatePath("/settings/team");
  return { ok: `${user.name} added. They can now sign in with Google.` };
}

const rand = z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0).max(100_000)).transform((r) => Math.round(r * 100));

const updateSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(Role),
  weeklyCapacityHours: z.coerce.number().int().min(0).max(80),
  billRate: rand,
  costRate: rand,
  billableTargetPercent: z.coerce.number().int().min(0).max(100),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function updateStaff(formData: FormData) {
  const actor = await requirePermission("team.manage");
  const data = updateSchema.parse(Object.fromEntries(formData));
  const target = await db.user.findUniqueOrThrow({ where: { id: data.userId } });

  // Guard against locking the firm out: you can't demote or deactivate yourself,
  // and there must always be at least one active Director.
  const losesDirector = target.role === Role.DIRECTOR && (data.role !== Role.DIRECTOR || !data.active);
  if (target.id === actor.id && losesDirector) return;
  if (losesDirector) {
    const directors = await db.user.count({ where: { role: Role.DIRECTOR, active: true } });
    if (directors <= 1) return;
  }

  await db.user.update({
    where: { id: target.id },
    data: {
      role: data.role,
      weeklyCapacityHours: data.weeklyCapacityHours,
      active: data.active,
      billRateCents: data.billRate,
      costRateCents: data.costRate,
      billableTargetPercent: data.billableTargetPercent,
    },
  });
  await emitEvent("user.updated", { userId: target.id, role: data.role, active: data.active }, { actorId: actor.id });
  revalidatePath("/settings/team");
}
