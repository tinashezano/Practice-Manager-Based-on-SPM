import type { BillingType } from "@prisma/client";
import { z } from "zod";
import { formatDate } from "@/lib/dates";
import { computeTotals, dueNow, formatRand, monthlyTotal } from "@/lib/money";
import { v1Schema, type V1Doc } from "@/lib/proposal-doc-v1";

// The proposal document: A4 pages of blocks (text, headings, images, form
// fields the client fills in, the pricing table and package choice), plus
// header/footer, theme and email. Stored as JSON on Proposal.content and in
// ProposalTemplate.doc. Client-safe, so the builder, the client's page and
// the server all share it.

const id = () => Math.random().toString(36).slice(2, 10);
const align = z.enum(["left", "center", "right"]).default("left");
const label = z.string().max(300);

const packageLine = z.object({
  name: z.string().max(200),
  description: z.string().max(2000).nullable(),
  billingType: z.enum(["ONCE_OFF", "MONTHLY"]),
  quantity: z.number().int().min(1).max(10_000),
  unitPriceCents: z.number().int().min(0).max(1_000_000_000),
  taxable: z.boolean(),
});
const packageSnapshot = z.object({ id: z.string(), name: z.string().max(200), description: z.string().max(2000).nullable(), items: z.array(packageLine).max(30) });

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("heading"), text: z.string().max(500), level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2), align }),
  z.object({ id: z.string(), type: z.literal("text"), html: z.string().max(200_000) }),
  z.object({ id: z.string(), type: z.literal("image"), fileId: z.string().nullable(), width: z.number().int().min(10).max(100).default(100), align, caption: z.string().max(300).default("") }),
  z.object({ id: z.string(), type: z.literal("divider") }),
  z.object({ id: z.string(), type: z.literal("signature"), label, required: z.boolean().default(true) }),
  z.object({ id: z.string(), type: z.literal("initials"), label, required: z.boolean().default(true) }),
  z.object({ id: z.string(), type: z.literal("textField"), label, placeholder: z.string().max(200).default(""), required: z.boolean().default(false), multiline: z.boolean().default(false) }),
  z.object({ id: z.string(), type: z.literal("date"), label, required: z.boolean().default(false), autoToday: z.boolean().default(true) }),
  z.object({ id: z.string(), type: z.literal("checkbox"), label, required: z.boolean().default(false) }),
  z.object({ id: z.string(), type: z.literal("radio"), label, options: z.array(z.string().max(200)).min(1).max(20), required: z.boolean().default(false) }),
  z.object({ id: z.string(), type: z.literal("pricingTable"), title: z.string().max(200).default("Services Breakdown"), showVat: z.boolean().default(true), showDescriptions: z.boolean().default(true) }),
  z.object({ id: z.string(), type: z.literal("packages"), title: z.string().max(200).default("Packages"), packages: z.array(packageSnapshot).max(6).default([]), required: z.boolean().default(true) }),
]);

export const pageSchema = z.object({ id: z.string(), orientation: z.enum(["portrait", "landscape"]).default("portrait"), blocks: z.array(blockSchema).max(200) });

export const docSchema = z.object({
  v: z.literal(2),
  pages: z.array(pageSchema).min(1).max(60),
  header: z.object({ enabled: z.boolean(), text: z.string().max(300), logoFileId: z.string().nullable(), align, showOnFirstPage: z.boolean() }),
  footer: z.object({ enabled: z.boolean(), text: z.string().max(300), pageNumbers: z.boolean() }),
  theme: z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), font: z.enum(["sans", "serif", "modern"]) }),
  email: z.object({ subject: z.string().max(200), body: z.string().max(10_000) }),
});

export type ProposalDoc = z.infer<typeof docSchema>;
export type DocPage = z.infer<typeof pageSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;
export type PackageSnapshot = z.infer<typeof packageSnapshot>;
export type PackageLine = z.infer<typeof packageLine>;

export const FORM_TYPES: BlockType[] = ["signature", "initials", "textField", "date", "checkbox", "radio", "packages"];

export const FONTS = {
  sans: { label: "Clean (sans-serif)", css: "var(--font-app), ui-sans-serif, system-ui, sans-serif" },
  serif: { label: "Classic (serif)", css: "Georgia, 'Times New Roman', serif" },
  modern: { label: "Modern", css: "'Helvetica Neue', Arial, sans-serif" },
} as const;

// ---------- Elements palette ----------

export const ELEMENTS: { type: BlockType; label: string; hint: string; group: "Text Elements" | "Form Elements" | "Business Elements" }[] = [
  { type: "text", label: "Text Block", hint: "Add editable text", group: "Text Elements" },
  { type: "heading", label: "Heading", hint: "Add a heading", group: "Text Elements" },
  { type: "image", label: "Image", hint: "Upload images", group: "Text Elements" },
  { type: "divider", label: "Divider", hint: "Horizontal line", group: "Text Elements" },
  { type: "signature", label: "Signature", hint: "Digital signature field", group: "Form Elements" },
  { type: "initials", label: "Initials", hint: "Initials field", group: "Form Elements" },
  { type: "textField", label: "Text Field", hint: "Input field", group: "Form Elements" },
  { type: "date", label: "Date Picker", hint: "Date selection", group: "Form Elements" },
  { type: "checkbox", label: "Checkbox", hint: "Boolean selection", group: "Form Elements" },
  { type: "radio", label: "Radio Buttons", hint: "Single choice selection", group: "Form Elements" },
  { type: "pricingTable", label: "Pricing Table", hint: "Pricing table with auto totals", group: "Business Elements" },
  { type: "packages", label: "Packages", hint: "Package selection", group: "Business Elements" },
];

export function newBlock(type: BlockType): Block {
  const b = { id: id() };
  switch (type) {
    case "heading": return { ...b, type, text: "Add a heading", level: 2, align: "left" };
    case "text": return { ...b, type, html: "<p>Start typing…</p>" };
    case "image": return { ...b, type, fileId: null, width: 100, align: "center", caption: "" };
    case "divider": return { ...b, type };
    case "signature": return { ...b, type, label: "Client signature", required: true };
    case "initials": return { ...b, type, label: "Initials", required: true };
    case "textField": return { ...b, type, label: "Your answer", placeholder: "", required: false, multiline: false };
    case "date": return { ...b, type, label: "Date", required: false, autoToday: true };
    case "checkbox": return { ...b, type, label: "I agree", required: false };
    case "radio": return { ...b, type, label: "Choose one", options: ["Option 1", "Option 2"], required: false };
    case "pricingTable": return { ...b, type, title: "Services Breakdown", showVat: true, showDescriptions: true };
    case "packages": return { ...b, type, title: "Packages", packages: [], required: true };
  }
}

/** A copy with new ids (duplicating blocks/pages, inserting from the library). */
export function cloneBlock(b: Block): Block {
  return { ...structuredClone(b), id: id() };
}
export function clonePage(p: DocPage): DocPage {
  return { ...p, id: id(), blocks: p.blocks.map(cloneBlock) };
}
export function newPage(orientation: DocPage["orientation"] = "portrait"): DocPage {
  return { id: id(), orientation, blocks: [] };
}

// ---------- Defaults ----------

export const DEFAULT_EMAIL = {
  subject: "Your proposal from {{firm}}: {{title}}",
  body: `Hi {{contactFirstName}},

Thank you for your time. Your proposal is ready. You can review it, accept it online and pay securely in a few minutes.

{{proposalButton}}

This proposal is valid until {{validUntil}}.

Kind regards,
{{senderName}}`,
};

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plain text (blank-line paragraphs) → simple HTML. Used for firm terms and older proposals. */
export function textToHtml(text: string) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const base = (): Omit<ProposalDoc, "pages"> => ({
  v: 2,
  header: { enabled: true, text: "{{firm}}", logoFileId: null, align: "right", showOnFirstPage: false },
  footer: { enabled: true, text: "{{firm}} · {{proposalNumber}}", pageNumbers: true },
  theme: { color: "#4f46e5", font: "sans" },
  email: DEFAULT_EMAIL,
});

/** The built-in starting document. `terms` is the firm's terms as plain text. */
export function defaultDoc(terms: string): ProposalDoc {
  const b = <T extends BlockType>(type: T, patch: Partial<BlockOf<T>> = {}) => ({ ...newBlock(type), ...patch }) as Block;
  return {
    ...base(),
    pages: [
      {
        id: id(),
        orientation: "portrait",
        blocks: [
          b("image", { width: 30, align: "left" }),
          b("heading", { text: "Proposal for {{client}}", level: 1 }),
          b("text", { html: "<p>Prepared for {{contactName}} · {{today}}<br>Valid until {{validUntil}}</p>" }),
          b("divider"),
          b("text", {
            html: "<p>Hi {{contactFirstName}},</p><p>Thank you for considering {{firm}} as your trusted partner. This proposal sets out how we will support {{client}}, what is included and what it costs.</p><p>Review the services and pricing, read the terms and sign at the end when you are ready.</p>",
          }),
        ],
      },
      {
        id: id(),
        orientation: "portrait",
        blocks: [
          b("heading", { text: "Services & pricing", level: 2 }),
          b("pricingTable"),
          b("text", { html: "<p>Once-off fees and the first month are payable on acceptance. Monthly fees are then charged automatically each month.</p>" }),
        ],
      },
      {
        id: id(),
        orientation: "portrait",
        blocks: [
          b("heading", { text: "Terms & conditions", level: 2 }),
          b("text", { html: `<p>Confirmation of agreement for services between {{firm}} and {{client}}.</p>${textToHtml(terms)}` }),
          b("heading", { text: "Acceptance", level: 3 }),
          b("checkbox", { label: "I confirm I am authorised to accept this proposal on behalf of {{client}}.", required: true }),
          b("signature", { label: "Client signature", required: true }),
          b("date", { label: "Date", autoToday: true }),
        ],
      },
    ],
  };
}

/** Converts a first-format (sections) proposal into pages and blocks. */
export function fromV1(old: V1Doc): ProposalDoc {
  const t = <T extends BlockType>(type: T, patch: Partial<BlockOf<T>>) => ({ ...newBlock(type), ...patch }) as Block;
  const pages: DocPage[] = [
    {
      ...newPage(),
      blocks: [
        ...(old.theme.logoFileId && old.cover.showLogo !== false ? [t("image", { fileId: old.theme.logoFileId, width: 25, align: "center" })] : []),
        t("heading", { text: old.cover.heading || "A proposal prepared for", level: 3, align: "center" }),
        t("heading", { text: "{{client}}", level: 1, align: "center" }),
        t("heading", { text: old.cover.subtitle || "{{title}}", level: 3, align: "center" }),
        t("text", { html: `<p style="text-align:center">Prepared by ${escapeHtml(old.cover.preparedBy || "{{senderName}}")}</p>` }),
      ],
    },
  ];
  for (const s of old.sections) {
    if (s.hidden || s.kind === "thankYou" || s.kind === "pricing" && !s.html) continue;
    const blocks: Block[] = [t("heading", { text: s.title, level: 2 })];
    if (s.kind === "services") blocks.push(newBlock("pricingTable"));
    else if (s.html) blocks.push(t("text", { html: s.html }));
    if (s.kind === "perks" && s.perks.length) blocks.push(t("text", { html: `<ul>${s.perks.map((p) => `<li><p><strong>${escapeHtml(p.title)}</strong>${p.text ? ` – ${escapeHtml(p.text)}` : ""}</p></li>`).join("")}</ul>` }));
    if (s.kind === "documents" && s.files.length) blocks.push(t("text", { html: `<ul>${s.files.map((f) => `<li><p><a href="/api/assets/${f.id}">${escapeHtml(f.name)}</a></p></li>`).join("")}</ul>` }));
    if (s.kind === "terms") blocks.push(newBlock("signature"), t("date", { label: "Date", autoToday: true }));
    pages.push({ ...newPage(), blocks });
  }
  const d = base();
  return {
    ...d,
    pages,
    header: { ...d.header, logoFileId: old.theme.logoFileId ?? null },
    theme: { color: /^#[0-9a-f]{6}$/i.test(old.theme.color ?? "") ? old.theme.color! : d.theme.color, font: (["sans", "serif", "modern"] as const).find((f) => f === old.theme.font) ?? "sans" },
    email: { subject: old.email.subject || DEFAULT_EMAIL.subject, body: old.email.body || DEFAULT_EMAIL.body },
  };
}

/** Reads stored JSON (either format), falling back to `fallback` when missing or invalid. */
export function normalizeDoc(raw: unknown, fallback: () => ProposalDoc): ProposalDoc {
  const v2 = docSchema.safeParse(raw);
  if (v2.success) return v2.data;
  const v1 = v1Schema.safeParse(raw);
  if (v1.success && v1.data.sections.length) return fromV1(v1.data);
  return fallback();
}

export const allBlocks = (doc: ProposalDoc) => doc.pages.flatMap((p) => p.blocks);

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
  { key: "dueNow", label: "Amount due on acceptance" },
  { key: "monthlyTotal", label: "Monthly fee" },
  { key: "today", label: "Today's date" },
];

export type MergeValues = Record<string, string>;

/** Replaces {{field}} with its value. In HTML mode values are escaped. Unknown fields stay as typed. */
export function mergeFields(text: string, values: MergeValues, html = true) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, key: string) => (key in values ? (html ? escapeHtml(values[key]!) : values[key]!) : all));
}

export type DocLine = { id: string; name: string; description: string | null; billingType: BillingType; quantity: number; unitPriceCents: number; taxable: boolean };

export type DocContext = {
  number: string;
  title: string;
  clientName: string;
  contactName: string;
  senderName: string;
  firm: { legalName: string; registrationNumber: string | null; vatNumber: string | null; email: string | null; phone: string | null; address: string | null };
  validUntil: string;
  startDate: string | null;
  issuedAt: string;
  today: string;
  vatRate: number;
  lines: DocLine[];
};

const LONG: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

export function mergeValues(ctx: DocContext, lines: Pick<DocLine, "billingType" | "quantity" | "unitPriceCents" | "taxable">[] = ctx.lines): MergeValues {
  const t = computeTotals(lines, ctx.vatRate);
  return {
    client: ctx.clientName,
    contactName: ctx.contactName,
    contactFirstName: ctx.contactName.split(" ")[0] ?? ctx.contactName,
    firm: ctx.firm.legalName,
    title: ctx.title,
    proposalNumber: ctx.number,
    senderName: ctx.senderName,
    validUntil: formatDate(ctx.validUntil, LONG),
    startDate: ctx.startDate ? formatDate(ctx.startDate, LONG) : "acceptance",
    dueNow: formatRand(dueNow(t)),
    monthlyTotal: formatRand(monthlyTotal(t)),
    today: formatDate(ctx.today, LONG),
  };
}

/** The proposal's own lines plus the package the client picked (if any). */
export function linesWithPackage(lines: DocLine[], doc: ProposalDoc, packageId: string | null | undefined): DocLine[] {
  const pkg = packageId ? allBlocks(doc).flatMap((b) => (b.type === "packages" ? b.packages : [])).find((p) => p.id === packageId) : null;
  return pkg ? [...lines, ...pkg.items.map((l, i) => ({ ...l, id: `pkg-${i}` }))] : lines;
}

// ---------- Client answers ----------

export type Responses = Record<string, unknown>;

const SIGNATURE_IMG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

/** Checks the client's answers against the document's form fields. Returns clean values or the first problem. */
export function validateResponses(doc: ProposalDoc, raw: Responses, today: string): { ok: true; values: Responses; signerName: string | null; packageId: string | null } | { ok: false; error: string } {
  const values: Responses = {};
  let signerName: string | null = null;
  let packageId: string | null = null;
  for (const b of allBlocks(doc)) {
    const v = raw[b.id];
    const name = "label" in b ? b.label : b.type === "packages" ? b.title : "";
    switch (b.type) {
      case "signature": {
        const s = v as { name?: unknown; image?: unknown } | undefined;
        const n = typeof s?.name === "string" ? s.name.trim().slice(0, 200) : "";
        const img = typeof s?.image === "string" && s.image.length < 300_000 && SIGNATURE_IMG.test(s.image) ? s.image : null;
        if ((n.length < 3 || !img) && b.required) return { ok: false, error: `${name}: type your full name and sign in the box.` };
        if (n.length >= 3 && img) {
          values[b.id] = { name: n, image: img };
          signerName ??= n;
        }
        break;
      }
      case "initials": {
        const img = typeof v === "string" && v.length < 150_000 && SIGNATURE_IMG.test(v) ? v : null;
        if (!img && b.required) return { ok: false, error: `${name}: add your initials.` };
        if (img) values[b.id] = img;
        break;
      }
      case "textField": {
        const s = typeof v === "string" ? v.trim().slice(0, b.multiline ? 5000 : 500) : "";
        if (!s && b.required) return { ok: false, error: `Please fill in "${name}".` };
        if (s) values[b.id] = s;
        break;
      }
      case "date": {
        const s = b.autoToday ? today : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
        if (!s && b.required) return { ok: false, error: `Please choose a date for "${name}".` };
        if (s) values[b.id] = s;
        break;
      }
      case "checkbox":
        if (v !== true && b.required) return { ok: false, error: `Please tick "${name}".` };
        values[b.id] = v === true;
        break;
      case "radio": {
        const s = typeof v === "string" && b.options.includes(v) ? v : "";
        if (!s && b.required) return { ok: false, error: `Please choose an option for "${name}".` };
        if (s) values[b.id] = s;
        break;
      }
      case "packages": {
        const s = typeof v === "string" && b.packages.some((p) => p.id === v) ? v : "";
        if (!s && b.required && b.packages.length) return { ok: false, error: "Please choose a package." };
        if (s) values[b.id] = packageId = s;
        break;
      }
    }
  }
  return { ok: true, values, signerName, packageId };
}

// ---------- Checks before sending ----------

export type Issue = { message: string; blockId?: string };

export function docIssues(doc: ProposalDoc, ctx: { lineCount: number; hasEmail: boolean; expired: boolean }): Issue[] {
  const issues: Issue[] = [];
  const blocks = allBlocks(doc);
  const pkgBlocks = blocks.filter((b): b is BlockOf<"packages"> => b.type === "packages");
  const hasPackages = pkgBlocks.some((b) => b.packages.length > 0);
  if (!ctx.lineCount && !hasPackages) issues.push({ message: "No services or packages added" });
  if (!ctx.hasEmail) issues.push({ message: "The lead has no email address" });
  if (ctx.expired) issues.push({ message: "The valid-until date has passed" });
  if (!blocks.some((b) => b.type === "pricingTable") && !hasPackages) issues.push({ message: "No pricing table: the client won't see the prices" });
  if (!blocks.some((b) => b.type === "signature")) issues.push({ message: "No signature field: the client will sign by typing their name" });
  for (const b of pkgBlocks) if (!b.packages.length) issues.push({ message: "A packages block has no packages", blockId: b.id });
  for (const b of blocks) if (b.type === "image" && !b.fileId) issues.push({ message: "An image block has no picture", blockId: b.id });
  return issues;
}

/** Issues that stop the proposal being sent (others are warnings). */
export const isBlocking = (i: Issue) => i.message.startsWith("No services") || i.message.startsWith("The lead has no email") || i.message.startsWith("The valid-until");

export function stripTags(html: string) {
  const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]!)
    .replace(/\s+/g, " ");
}
