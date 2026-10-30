import type { FirmSettings, Proposal } from "@prisma/client";
import { toISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { DEFAULT_TERMS, proposalNumber } from "@/lib/firm";
import { defaultDoc, normalizeDoc, textToHtml, type DocContext, type ProposalDoc } from "@/lib/proposal-doc";
import type { ProposalWithLines } from "@/lib/proposals";

const builtIn = (firm: FirmSettings) => defaultDoc(firm.proposalTerms || DEFAULT_TERMS);

/** What new proposals start from: the default template, else the older saved layout, else the built-in one. */
export async function startingDoc(firm: FirmSettings): Promise<ProposalDoc> {
  const tpl = await db.proposalTemplate.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: "desc" } });
  if (tpl) return normalizeDoc(tpl.doc, () => builtIn(firm));
  return normalizeDoc(firm.proposalTemplate, () => builtIn(firm));
}

/** A proposal's document. Older proposals (sections, or plain intro/terms) are converted on the fly. */
export function proposalDoc(p: Pick<Proposal, "content" | "introduction" | "terms">, firm: FirmSettings): ProposalDoc {
  return normalizeDoc(p.content, () => {
    const doc = defaultDoc(p.terms || firm.proposalTerms || DEFAULT_TERMS);
    const intro = doc.pages[0]!.blocks.at(-1);
    if (p.introduction && intro?.type === "text") intro.html = textToHtml(p.introduction);
    return doc;
  });
}

export async function docContext(p: ProposalWithLines, firm: FirmSettings): Promise<DocContext> {
  const creator = p.createdById ? await db.user.findUnique({ where: { id: p.createdById }, select: { name: true } }) : null;
  return {
    number: proposalNumber(p.number),
    title: p.title,
    clientName: p.deal.name,
    contactName: p.deal.contactName,
    senderName: creator?.name ?? firm.legalName,
    firm: { legalName: firm.legalName, registrationNumber: firm.registrationNumber, vatNumber: firm.vatNumber, email: firm.email, phone: firm.phone, address: firm.address },
    validUntil: toISODate(p.validUntil),
    startDate: p.startDate ? toISODate(p.startDate) : null,
    issuedAt: toISODate(p.sentAt ?? p.createdAt),
    today: todayISO(),
    vatRate: p.vatRatePercent,
    lines: p.lineItems.map((l) => ({ id: l.id, name: l.name, description: l.description, billingType: l.billingType, quantity: l.quantity, unitPriceCents: l.unitPriceCents, taxable: l.taxable })),
  };
}
