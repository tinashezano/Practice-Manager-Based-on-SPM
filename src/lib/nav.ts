import {
  BarChart3, Bell, BookOpen, Briefcase, CalendarClock, CalendarDays, ClipboardCheck, Clock,
  FileSignature, FolderKanban, GraduationCap, Handshake, Home, KanbanSquare, Layers, ListChecks,
  LayoutTemplate, Package, Plug, Radar, Receipt, Users, UserCog, Workflow, type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Build phase that delivers this screen (see docs/PLAN.md). */
  phase: number;
  description: string;
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    title: "My focus",
    items: [
      { label: "My Dashboard", href: "/", icon: Home, phase: 0, description: "Your day: tasks due, overdue work, reviews and time." },
      { label: "Notifications", href: "/notifications", icon: Bell, phase: 1, description: "Assignments, mentions, client uploads and automation alerts." },
    ],
  },
  {
    title: "Firm Overview",
    items: [
      { label: "Practice Dashboard", href: "/overview/practice", icon: BarChart3, permission: "financials.view", phase: 7, description: "Revenue, WIP, utilisation, margins and capacity across the firm." },
      { label: "Helicopter View", href: "/overview/helicopter", icon: Radar, permission: "financials.view", phase: 7, description: "Daily stand-up matrix: risks, blockers, overdue work and management focus." },
    ],
  },
  {
    title: "Leads & Deals",
    items: [
      { label: "Pipeline", href: "/deals/pipeline", icon: KanbanSquare, permission: "deals.manage", phase: 2, description: "New Lead → Discovery Booked → Discovery Completed → Proposal Required → Proposal Sent → Won / Lost." },
      { label: "Deals", href: "/deals", icon: Handshake, permission: "deals.manage", phase: 2, description: "Every lead and deal in a searchable table with reports." },
      { label: "Booking Links", href: "/deals/booking", icon: CalendarClock, permission: "deals.manage", phase: 2, description: "Discovery-call booking pages backed by Google Calendar, with Meet links." },
    ],
  },
  {
    title: "Proposals",
    items: [
      { label: "Proposals", href: "/proposals", icon: FileSignature, permission: "proposals.manage", phase: 3, description: "Build, send (DocuSign) and collect payment (Paystack) for proposals." },
      { label: "Services", href: "/proposals/services", icon: Layers, permission: "proposals.manage", phase: 3, description: "Service catalogue with once-off and monthly retainer pricing." },
      { label: "Service Packages", href: "/proposals/packages", icon: Package, permission: "proposals.manage", phase: 3, description: "Bundles of services for quick proposals." },
    ],
  },
  {
    title: "Clients",
    items: [
      { label: "Clients", href: "/clients", icon: Briefcase, permission: "clients.view", phase: 1, description: "Client profiles, contacts, engagements, documents and tasks." },
      { label: "Onboarding", href: "/clients/onboarding", icon: ClipboardCheck, permission: "clients.view", phase: 4, description: "Information Requested → Information Received → Setup → Review → Complete." },
    ],
  },
  {
    title: "Work",
    items: [
      { label: "Tasks", href: "/tasks", icon: ListChecks, phase: 1, description: "All tasks grouped by client — List, Board, Calendar and Timeline views." },
      { label: "Projects", href: "/projects", icon: FolderKanban, phase: 1, description: "Engagements per client (e.g. Bookkeeping, Annual Financials, Tax)." },
      { label: "Workload", href: "/workload", icon: Users, phase: 6, description: "Capacity planner: hours allocated vs available per person per week." },
      { label: "Time Tracker", href: "/time", icon: Clock, phase: 6, description: "Timers and timesheets against client tasks." },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, phase: 2, description: "Your Google Calendar alongside task due dates." },
    ],
  },
  {
    title: "Resource Hub",
    items: [
      { label: "SOPs & Templates", href: "/resources", icon: BookOpen, permission: "resources.view", phase: 5, description: "Standard operating procedures, checklists and templates." },
      { label: "Job Templates", href: "/resources/job-templates", icon: LayoutTemplate, permission: "resources.view", phase: 5, description: "Task lists used when projects start, linked to SOPs." },
      { label: "Staff Onboarding", href: "/resources/staff-onboarding", icon: GraduationCap, permission: "resources.view", phase: 5, description: "Programmes for new employees with tracked progress." },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Team & Roles", href: "/settings/team", icon: UserCog, permission: "team.manage", phase: 0, description: "Add staff, set roles and capacity." },
      { label: "Automations", href: "/settings/automations", icon: Workflow, permission: "settings.manage", phase: 2, description: "The workflow rules that create records, tasks and emails automatically." },
      { label: "Proposals & Billing", href: "/settings/billing", icon: Receipt, permission: "settings.manage", phase: 3, description: "Firm details, VAT, proposal terms, welcome pack and Paystack." },
      { label: "Integrations", href: "/settings/integrations", icon: Plug, permission: "settings.manage", phase: 2, description: "Google Workspace, DocuSign, Paystack and QuickBooks connections." },
    ],
  },
];

export function findNavItem(href: string) {
  for (const section of NAV) {
    const item = section.items.find((i) => i.href === href);
    if (item) return item;
  }
  return null;
}
