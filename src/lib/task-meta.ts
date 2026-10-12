import type { ClientStatus, EntityType, Priority, ProjectStatus, Recurrence, TaskStatus } from "@prisma/client";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING_ON_CLIENT", "IN_REVIEW", "DONE"];

export const STATUS_META: Record<TaskStatus, { label: string; tone: Tone; dot: string }> = {
  TODO: { label: "To do", tone: "neutral", dot: "bg-slate-400" },
  IN_PROGRESS: { label: "In progress", tone: "brand", dot: "bg-indigo-500" },
  WAITING_ON_CLIENT: { label: "Waiting on client", tone: "warning", dot: "bg-amber-500" },
  IN_REVIEW: { label: "In review", tone: "brand", dot: "bg-violet-500" },
  DONE: { label: "Done", tone: "success", dot: "bg-green-500" },
};

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "neutral" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  PRIVATE_COMPANY: "Private company (Pty) Ltd",
  SOLE_PROPRIETOR: "Sole proprietor",
  INDIVIDUAL: "Individual",
  TRUST: "Trust",
  PARTNERSHIP: "Partnership",
  NPO: "NPO / NPC",
  OTHER: "Other",
};

export const CLIENT_STATUS_META: Record<ClientStatus, { label: string; tone: Tone }> = {
  ONBOARDING: { label: "Onboarding", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "brand" },
  ON_HOLD: { label: "On hold", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
};

export function formatEstimate(minutes: number | null | undefined) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

type HomeInput = { client: { id: string; name: string } | null; deal?: { id: string; name: string } | null };

/** Where a task "lives": its client, or the lead (deal) it belongs to before it's a client. */
export function taskHome(t: HomeInput) {
  if (t.client) return { key: t.client.id, name: t.client.name, href: `/clients/${t.client.id}`, isLead: false };
  if (t.deal) return { key: `deal:${t.deal.id}`, name: t.deal.name, href: `/deals/${t.deal.id}`, isLead: true };
  return { key: "none", name: "No client", href: "/tasks", isLead: false };
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  NONE: "Doesn't repeat",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  BIMONTHLY: "Every 2 months (VAT)",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annually",
};
