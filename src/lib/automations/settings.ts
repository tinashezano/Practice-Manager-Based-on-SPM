import { db } from "@/lib/db";

type Config = Record<string, number>;

export const AUTOMATIONS = {
  "lead.sendBookingLink": {
    title: "Email the discovery-call booking link to new leads",
    detail: "Sent from the lead owner's Gmail, using the default booking link.",
    config: {} as Config,
  },
  "lead.followUp": {
    title: "Follow-up task when a lead hasn't booked",
    detail: "Creates a task for the lead owner if no call is booked within the set number of days.",
    config: { days: 3 } as Config,
  },
  "booking.discoveryTask": {
    title: "Discovery Call task when a call is booked",
    detail: "Moves the deal to Discovery Booked and creates a task on the call date for the host. Also emails the lead a confirmation with reschedule/cancel links.",
    config: {} as Config,
  },
  "discovery.proposalTask": {
    title: "Prepare Proposal task when the discovery call is done",
    detail: "When the Discovery Call task is completed (or the deal moves to Discovery Completed / Proposal Required), creates a proposal task.",
    config: { dueDays: 2 } as Config,
  },
  "deal.lostCloseTasks": {
    title: "Close open lead tasks when a deal is lost",
    detail: "Marks the lead's open tasks as done so they leave everyone's lists.",
    config: {} as Config,
  },
  "task.recurrence": {
    title: "Create the next occurrence of recurring tasks",
    detail: "When a repeating task is completed, the next one is created with its subtasks reset.",
    config: {} as Config,
  },
} as const;

export type AutomationKey = keyof typeof AUTOMATIONS;

export async function getAutomation(key: AutomationKey) {
  const row = await db.automationSetting.findUnique({ where: { key } });
  return {
    enabled: row?.enabled ?? true,
    config: { ...AUTOMATIONS[key].config, ...((row?.config as Config | null) ?? {}) },
  };
}
