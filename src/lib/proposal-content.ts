import type { FirmSettings, Proposal } from "@prisma/client";
import type { DocContext } from "@/components/proposal/document";
import { toISODate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { DEFAULT_TERMS, proposalNumber } from "@/lib/firm";
import { defaultDoc, normalizeDoc, type ProposalDoc } from "@/lib/proposal-doc";
import type { ProposalWithLines } from "@/lib/proposals";

/** The firm's starting document for new proposals (Settings, or "Save as template"). */
export function templateDoc(firm: FirmSettings): ProposalDoc {
  return normalizeDoc(firm.proposalTemplate, () => defaultDoc(firm.proposalTerms || DEFAULT_TERMS));
}

/** A proposal's document. Older proposals (before the builder) are converted on the fly. */
export function proposalDoc(p: Pick<Proposal, "content" | "introduction" | "terms">, firm: FirmSettings): ProposalDoc {
  return normalizeDoc(p.content, () => {
    const base = templateDoc(firm);
    if (!p.introduction && !p.terms) return base;
    const legacy = defaultDoc(p.terms || firm.proposalTerms || DEFAULT_TERMS, p.introduction);
    return { ...base, sections: legacy.sections };
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
