import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "team.manage", // add staff, change roles, deactivate
  "settings.manage", // integrations, automations, services pricing
  "financials.view", // practice dashboard money figures, margins, rates
  "deals.manage", // leads, pipeline, bookings
  "proposals.manage", // build and send proposals
  "clients.manage", // create/edit clients, onboarding
  "clients.view",
  "tasks.manageAll", // edit/reassign anyone's tasks
  "tasks.work", // work on own/assigned tasks
  "resources.edit", // write and publish SOPs
  "resources.view",
  "workload.viewAll", // see the whole team's capacity
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  DIRECTOR: PERMISSIONS,
  ACCOUNTANT: [
    "deals.manage",
    "proposals.manage",
    "clients.manage",
    "clients.view",
    "tasks.manageAll",
    "tasks.work",
    "resources.edit",
    "resources.view",
    "workload.viewAll",
  ],
  BOOKKEEPER: ["clients.view", "tasks.work", "resources.view"],
};

export function can(role: Role | undefined | null, permission: Permission) {
  return !!role && ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  DIRECTOR: "Director",
  ACCOUNTANT: "Accountant",
  BOOKKEEPER: "Bookkeeper",
};
