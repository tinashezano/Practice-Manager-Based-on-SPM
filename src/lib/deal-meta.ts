import type { DealStage, LeadSource } from "@prisma/client";

export const DEAL_STAGES: DealStage[] = ["NEW_LEAD", "DISCOVERY_BOOKED", "DISCOVERY_COMPLETED", "PROPOSAL_REQUIRED", "PROPOSAL_SENT", "WON", "LOST"];
export const OPEN_STAGES: DealStage[] = ["NEW_LEAD", "DISCOVERY_BOOKED", "DISCOVERY_COMPLETED", "PROPOSAL_REQUIRED", "PROPOSAL_SENT"];

export const STAGE_META: Record<DealStage, { label: string; probability: number; dot: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }> = {
  NEW_LEAD: { label: "New lead", probability: 10, dot: "bg-slate-400", tone: "neutral" },
  DISCOVERY_BOOKED: { label: "Discovery booked", probability: 30, dot: "bg-sky-500", tone: "brand" },
  DISCOVERY_COMPLETED: { label: "Discovery completed", probability: 40, dot: "bg-indigo-500", tone: "brand" },
  PROPOSAL_REQUIRED: { label: "Proposal required", probability: 50, dot: "bg-violet-500", tone: "brand" },
  PROPOSAL_SENT: { label: "Proposal sent", probability: 70, dot: "bg-amber-500", tone: "warning" },
  WON: { label: "Won", probability: 100, dot: "bg-green-500", tone: "success" },
  LOST: { label: "Lost", probability: 0, dot: "bg-red-400", tone: "danger" },
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE_FORM: "Website form",
  BOOKING_PAGE: "Booking page",
  REFERRAL: "Referral",
  MANUAL: "Added manually",
  OTHER: "Other",
};

export function probabilityOf(d: { stage: DealStage; probability: number | null }) {
  return d.probability ?? STAGE_META[d.stage].probability;
}

/** "R 48 000". Formatted by hand because Node and browsers ship different locale data, which breaks hydration. */
export function formatZAR(cents: number) {
  const rands = Math.round(cents / 100);
  const digits = Math.abs(rands).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${rands < 0 ? "-" : ""}R\u00a0${digits}`;
}
