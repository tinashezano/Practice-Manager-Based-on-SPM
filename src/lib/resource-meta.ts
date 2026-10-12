import type { ResourceStatus, ResourceType } from "@prisma/client";

export const TYPE_META: Record<ResourceType, { label: string; tone: "neutral" | "brand" | "success" | "warning" }> = {
  SOP: { label: "SOP", tone: "brand" },
  TEMPLATE: { label: "Template", tone: "neutral" },
  GUIDE: { label: "Guide", tone: "success" },
  POLICY: { label: "Policy", tone: "warning" },
};

export const STATUS_META: Record<ResourceStatus, { label: string; tone: "neutral" | "brand" | "success" | "warning" }> = {
  DRAFT: { label: "Draft", tone: "warning" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export const DEFAULT_CATEGORIES = ["Tax", "Bookkeeping", "Payroll", "Company secretarial", "Client service", "Admin & policies"];

/** YouTube / Loom / Vimeo links → embeddable URL; anything else is shown as a plain link. */
export function embedUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtube.com") && u.searchParams.get("v")) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.endsWith("loom.com") && u.pathname.startsWith("/share/")) return `https://www.loom.com/embed/${u.pathname.split("/")[2]}`;
    if (u.hostname.endsWith("vimeo.com") && /^\/\d+/.test(u.pathname)) return `https://player.vimeo.com/video${u.pathname}`;
  } catch {
    return null;
  }
  return null;
}
