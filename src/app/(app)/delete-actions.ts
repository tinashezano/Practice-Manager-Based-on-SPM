"use server";

import { revalidatePath } from "next/cache";
import * as del from "@/lib/deletion";
import type { Permission } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

// Delete actions for every module. Each checks the same permission that's
// needed to edit the item (clients: Directors only), then applies the rules
// in lib/deletion.

async function guarded(permission: Permission, fn: () => Promise<del.DeleteResult>): Promise<del.DeleteResult> {
  await requirePermission(permission);
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (err) {
    console.error("[delete]", err);
    return { ok: false, error: "Couldn't delete it. It may already be gone; refresh the page." };
  }
}

export async function deleteDealAction(id: string) {
  return guarded("deals.manage", () => del.deleteDeal(id));
}

export async function deleteBookingLinkAction(id: string) {
  return guarded("deals.manage", () => del.deleteBookingLink(id));
}

export async function deleteProposalAction(id: string) {
  return guarded("proposals.manage", () => del.deleteProposal(id));
}

export async function deleteServiceAction(id: string) {
  return guarded("settings.manage", () => del.deleteService(id));
}

export async function deletePackageAction(id: string) {
  return guarded("settings.manage", () => del.deleteServicePackage(id));
}

export async function deleteClientAction(id: string) {
  return guarded("settings.manage", () => del.deleteClient(id));
}

export async function deleteOnboardingAction(id: string) {
  return guarded("clients.manage", () => del.deleteOnboarding(id));
}

export async function deleteProjectAction(id: string) {
  return guarded("tasks.manageAll", () => del.deleteProject(id));
}

export async function deleteResourceAction(id: string) {
  return guarded("resources.edit", () => del.deleteResource(id));
}

export async function deleteJobTemplateAction(id: string) {
  return guarded("resources.edit", () => del.deleteJobTemplate(id));
}

export async function deleteEnrollmentAction(id: string) {
  return guarded("team.manage", () => del.deleteEnrollment(id));
}

export async function deleteProgrammeAction(id: string) {
  return guarded("team.manage", () => del.deleteProgramme(id));
}

