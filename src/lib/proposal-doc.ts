import { z } from "zod";

// The proposal document: an ordered list of pages (sections) plus cover,
// theme and email settings. Stored as JSON on Proposal.content and, as the
// firm's starting point, on FirmSettings.proposalTemplate. Client-safe: no
// server imports, so the editor and the client page share it.

export const SECTION_KINDS = ["introduction", "services", "pricing", "documents", "terms", "nextStep", "perks", "thankYou", "custom"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Sections edited with the Word-style editor (everything except the services list). */
export const RICH_KINDS: SectionKind[] = ["introduction", "pricing", "documents", "terms", "nextStep", "perks", "thankYou", "custom"];
/** Sections that can't be removed (custom ones can). Services and pricing can't be hidden either. */
export const REQUIRED_KINDS: SectionKind[] = ["services", "pricing", "terms"];

export const KIND_LABELS: Record<SectionKind, string> = {
  introduction: "Introduction",
  services: "Services",
  pricing: "Pricing",
  documents: "Add. Docs.",
  terms: "Terms & Sign",
  nextStep: "Next Step",
  perks: "Perks",
  thankYou: "Thank You",
  custom: "Custom section",
};

export const FONTS = {
  sans: { label: "Clean (sans-serif)", css: "var(--font-app), ui-sans-serif, system-ui, sans-serif" },
  serif: { label: "Classic (serif)", css: "Georgia, 'Times New Roman', serif" },
  modern: { label: "Modern", css: "'Helvetica Neue', Arial, sans-serif" },
} as const;
export type FontKey = keyof typeof FONTS;

const id = () => Math.random().toString(36).slice(2, 10);

const perkSchema = z.object({ id: z.string(), title: z.string().max(120), text: z.string().max(600) });
const fileSchema = z.object({ id: z.string(), name: z.string().max(200) });

const sectionSchema = z.object({
  id: z.string(),
  kind: z.enum(SECTION_KINDS),
  title: z.string().max(120),
  html: z.string().max(200_000).default(""),
  hidden: z.boolean().default(false),
  perks: z.array(perkSchema).max(20).default([]),
  files: z.array(fileSchema).max(20).default([]),
});

export const docSchema = z.object({
  v: z.literal(1).default(1),
  general: z.object({ termMonths: z.number().int().min(0).max(120).nullable().default(12) }).default({ termMonths: 12 }),
  cover: z
    .object({
      heading: z.string().max(120).default("A proposal prepared for"),
      subtitle: z.string().max(200).default("{{title}}"),
      tagline: z.string().max(200).default(""),
      preparedBy: z.string().max(120).default("{{senderName}}"),
      showLogo: z.boolean().default(true),
    })
    .default({ heading: "A proposal prepared for", subtitle: "{{title}}", tagline: "", preparedBy: "{{senderName}}", showLogo: true }),
  theme: z
    .object({
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#375dfb"),
      background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#efe8dc"),
      font: z.enum(["sans", "serif", "modern"]).default("sans"),
      logoFileId: z.string().nullable().default(null),
    })
    .default({ color: "#375dfb", background: "#efe8dc", font: "sans", logoFileId: null }),
  sections: z.array(sectionSchema).max(40),
  email: z
    .object({ subject: z.string().max(200), body: z.string().max(10_000) })
    .default({ subject: "", body: "" }),
});

export type ProposalDoc = z.infer<typeof docSchema>;
export type DocSection = z.infer<typeof sectionSchema>;
export type Perk = z.infer<typeof perkSchema>;

export const DEFAULT_EMAIL = {
  subject: "Your proposal from {{firm}}: {{title}}",
  body: `Hi {{contactFirstName}},

Thank you for your time. Your proposal is ready. You can review it, accept it online and pay securely in a few minutes.

{{proposalButton}}

This proposal is valid until {{validUntil}}.

Kind regards,
{{senderName}}`,
};

const DEFAULT_PERKS: Perk[] = [
  { id: "p1", title: "A dedicated accountant", text: "One person who knows your business and answers your questions." },
  { id: "p2", title: "Deadlines handled", text: "We track SARS and CIPC deadlines so you never pay a late penalty." },
  { id: "p3", title: "Fixed monthly fee", text: "No surprise bills. Everything in scope is included." },
];

export function newSection(kind: SectionKind, title = KIND_LABELS[kind]): DocSection {
  return { id: id(), kind, title, html: kind === "custom" ? "<p>Start typing…</p>" : "", hidden: false, perks: kind === "perks" ? DEFAULT_PERKS : [], files: [] };
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plain text (blank-line paragraphs) → simple HTML. Used for older proposals and firm terms. */
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** The built-in starting document. `terms` is the firm's terms as plain text. */
export function defaultDoc(terms: string, introduction?: string | null): ProposalDoc {
  const s = (kind: SectionKind, html: string, extra: Partial<DocSection> = {}) => ({ ...newSection(kind), html, ...extra });
  return {
    v: 1,
    general: { termMonths: 12 },
    cover: { heading: "A proposal prepared for", subtitle: "{{title}}", tagline: "", preparedBy: "{{senderName}}", showLogo: true },
    theme: { color: "#375dfb", background: "#efe8dc", font: "sans", logoFileId: null },
    sections: [
      s(
        "introduction",
        introduction
          ? textToHtml(introduction)
          : "<p>Hi {{contactFirstName}},</p><p>Thank you for considering {{firm}} as your trusted partner. This proposal outlines how we will support {{client}}, what is included, and what it costs.</p><p>We have kept it simple: review the services and pricing, read the terms, and accept online when you are ready.</p>",
      ),
      s("services", ""),
      s("pricing", "<p>Once-off fees and the first month are payable on acceptance. Monthly fees are then charged automatically each month.</p>"),
      s("documents", "<p>Supporting documents for your review.</p>", { hidden: true }),
      s("terms", `<p>Confirmation of agreement for services between {{firm}} and {{client}}.</p>${textToHtml(terms)}`),
      s("nextStep", "<h3>Review &amp; sign the proposal</h3><p>Once you have reviewed all the details and are happy to proceed, sign online and pay the first invoice. We will then send your welcome pack and start onboarding.</p>"),
      s("perks", "<p>What you get when you work with us:</p>"),
      s("thankYou", "<h2>Thank you</h2><p>We look forward to working with you, {{contactFirstName}}.</p>"),
    ],
    email: DEFAULT_EMAIL,
  };
}

/** Reads stored JSON, falling back to the default document for anything missing or invalid. */
export function normalizeDoc(raw: unknown, fallback: () => ProposalDoc): ProposalDoc {
  const parsed = docSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.sections.length) return fallback();
  const doc = parsed.data;
  // Every proposal needs its services, pricing and terms pages.
  for (const kind of REQUIRED_KINDS) {
    if (!doc.sections.some((s) => s.kind === kind)) doc.sections.push(fallback().sections.find((s) => s.kind === kind) ?? newSection(kind));
  }
  if (!doc.email.subject) doc.email = { ...DEFAULT_EMAIL, ...(doc.email.body ? { body: doc.email.body } : {}) };
  return doc;
}

// ---------- Merge fields ----------

export const MERGE_FIELDS: { key: string; label: string }[] = [
  { key: "client", label: "Client business name" },
  { key: "contactName", label: "Contact full name" },
  { key: "contactFirstName", label: "Contact first name" },
  { key: "firm", label: "Your firm name" },
  { key: "title", label: "Proposal title" },
  { key: "proposalNumber", label: "Proposal number" },
  { key: "senderName", label: "Your name" },
  { key: "validUntil", label: "Valid until date" },
  { key: "startDate", label: "Start date" },
  { key: "term", label: "Agreement length" },
  { key: "dueNow", label: "Amount due on acceptance" },
  { key: "monthlyTotal", label: "Monthly fee" },
  { key: "today", label: "Today's date" },
];

export type MergeValues = Record<string, string>;

/** Replaces {{field}} with its value. In HTML mode values are escaped. Unknown fields stay as typed. */
export function mergeFields(text: string, values: MergeValues, html = true) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key: string) => (key in values ? (html ? escapeHtml(values[key]!) : values[key]!) : all));
}

export function termLabel(termMonths: number | null, startsOnAcceptance: boolean, startDateLabel: string) {
  const term = termMonths ? `${termMonths} Month${termMonths === 1 ? "" : "s"}` : "Ongoing";
  return { term, start: startsOnAcceptance ? "Starts on acceptance" : `Starts ${startDateLabel}` };
}

// ---------- Checks before sending ----------

export type Issue = { message: string; target: string };

export function docIssues(doc: ProposalDoc, ctx: { lineCount: number; hasEmail: boolean; expired: boolean }): Issue[] {
  const issues: Issue[] = [];
  const services = doc.sections.find((s) => s.kind === "services");
  if (!ctx.lineCount) issues.push({ message: "No services added", target: services?.id ?? "general" });
  if (!ctx.hasEmail) issues.push({ message: "The lead has no email address", target: "email" });
  if (ctx.expired) issues.push({ message: "The valid-until date has passed", target: "general" });
  const intro = doc.sections.find((s) => s.kind === "introduction" && !s.hidden);
  if (intro && !stripTags(intro.html).trim()) issues.push({ message: "Introduction is empty", target: intro.id });
  const terms = doc.sections.find((s) => s.kind === "terms");
  if (terms && !stripTags(terms.html).trim()) issues.push({ message: "Terms are empty", target: terms.id });
  const docs = doc.sections.find((s) => s.kind === "documents" && !s.hidden);
  if (docs && !docs.files.length) issues.push({ message: "Documents page is shown but has no files", target: docs.id });
  return issues;
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

export function stripTags(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]!)
    .replace(/\s+/g, " ");
}

/** A short line of the section's text for the side panel. */
export function snippet(html: string, max = 70) {
  const t = stripTags(html).trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
