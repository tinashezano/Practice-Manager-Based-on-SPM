import { db } from "@/lib/db";

export const DEFAULT_TERMS = `1. Scope. We will provide the services listed in this proposal. Work outside this scope will be quoted separately before we start.
2. Fees. Once-off fees are payable on acceptance. Monthly retainers are billed in advance and charged automatically each month until cancelled.
3. Your responsibilities. You agree to give us complete and accurate information on time. Deadlines missed because information arrived late are not our responsibility.
4. Cancellation. Either party may end a monthly retainer with one calendar month's written notice.
5. Confidentiality and POPIA. We keep your information confidential and process personal information only to provide our services, in line with the Protection of Personal Information Act.

[Replace these placeholder terms with your own engagement letter terms under Settings → Proposals & billing.]`;

export const DEFAULT_WELCOME = `Welcome to Outset! We're excited to work with you.

Over the next few days we'll set up your account and ask you for the information we need to get started. Your dedicated contact will be in touch shortly.`;

/** Firm-wide settings (single row), created with defaults on first use. */
export async function getFirmSettings() {
  return db.firmSettings.upsert({ where: { id: "firm" }, create: { id: "firm" }, update: {} });
}

export function proposalNumber(n: number) {
  return `PRO-${String(n).padStart(4, "0")}`;
}
