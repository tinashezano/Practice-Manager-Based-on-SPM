"use server";

import { revalidatePath } from "next/cache";
import { AUTOMATIONS, type AutomationKey } from "@/lib/automations/settings";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export async function saveAutomation(fd: FormData) {
  await requirePermission("settings.manage");
  const key = String(fd.get("key")) as AutomationKey;
  const def = AUTOMATIONS[key];
  if (!def) return;
  const config: Record<string, number> = {};
  for (const name of Object.keys(def.config)) {
    const n = Number(fd.get(name));
    if (Number.isFinite(n) && n >= 0 && n <= 365) config[name] = Math.round(n);
  }
  const enabled = fd.get("enabled") === "on";
  await db.automationSetting.upsert({ where: { key }, create: { key, enabled, config }, update: { enabled, config } });
  revalidatePath("/settings/automations");
}
