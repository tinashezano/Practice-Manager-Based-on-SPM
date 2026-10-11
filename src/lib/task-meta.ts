import type { EntityType, Priority, ProjectStatus, TaskStatus, ClientStatus } from "@prisma/client";

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
