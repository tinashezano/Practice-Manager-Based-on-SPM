import type { OnboardingStage } from "@prisma/client";

export const STAGES: OnboardingStage[] = ["INFO_REQUESTED", "INFO_RECEIVED", "SETUP", "REVIEW", "COMPLETE"];

export const STAGE_INFO: Record<OnboardingStage, { label: string; dot: string; tone: "neutral" | "brand" | "success" | "warning" }> = {
  INFO_REQUESTED: { label: "Information requested", dot: "bg-amber-500", tone: "warning" },
  INFO_RECEIVED: { label: "Information received", dot: "bg-sky-500", tone: "brand" },
  SETUP: { label: "Setup", dot: "bg-indigo-500", tone: "brand" },
  REVIEW: { label: "Review", dot: "bg-violet-500", tone: "brand" },
  COMPLETE: { label: "Complete", dot: "bg-green-500", tone: "success" },
};

export const TASK_KEYS = { onboarding: "client.onboarding", reviewDocs: "onboarding.review_docs", approve: "onboarding.approve", chase: "onboarding.chase" } as const;

