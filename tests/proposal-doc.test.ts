import { describe, expect, it } from "vitest";
import {
  allBlocks, defaultDoc, docIssues, linesWithPackage, mergeFields, newBlock, normalizeDoc, textToHtml, validateResponses, type DocLine, type ProposalDoc,
} from "@/lib/proposal-doc";
import { cleanHtml, sanitizeDoc } from "@/lib/sanitize";

const base = () => defaultDoc("1. Fees are payable on acceptance.");
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const pkg = { id: "pk1", name: "Essentials", description: null, items: [{ name: "Bookkeeping", description: null, billingType: "MONTHLY" as const, quantity: 1, unitPriceCents: 250000, taxable: true }] };

function withPackages(doc: ProposalDoc) {
  const b = newBlock("packages");
  if (b.type === "packages") b.packages = [pkg];
  doc.pages[1]!.blocks.push(b);
  return b.id;
}

describe("proposal document", () => {
  it("starts with three A4 pages: cover, pricing, terms with signature", () => {
    const doc = base();
    expect(doc.pages).toHaveLength(3);
    expect(doc.pages[1]!.blocks.map((b) => b.type)).toContain("pricingTable");
    expect(doc.pages[2]!.blocks.map((b) => b.type)).toEqual(["heading", "text", "heading", "checkbox", "signature", "date"]);
  });

  it("falls back to the default for missing or broken content", () => {
    expect(normalizeDoc(null, base).pages).toHaveLength(3);
    expect(normalizeDoc({ v: 2, pages: [] }, base).pages).toHaveLength(3);
  });

  it("converts first-format proposals (sections) into pages and blocks", () => {
    const v1 = {
      v: 1,
      cover: { heading: "Prepared for", subtitle: "{{title}}" },
      theme: { color: "#0f766e", font: "serif", logoFileId: "logo1" },
      sections: [
        { id: "a", kind: "introduction", title: "Introduction", html: "<p>Hi</p>" },
        { id: "b", kind: "services", title: "Services", html: "" },
        { id: "c", kind: "nextStep", title: "Next", html: "<p>x</p>", hidden: true },
        { id: "d", kind: "terms", title: "Terms", html: "<p>T</p>" },
      ],
      email: { subject: "S", body: "B" },
    };
    const doc = normalizeDoc(v1, base);
    expect(doc.v).toBe(2);
    expect(doc.theme).toEqual({ color: "#0f766e", font: "serif" });
    expect(doc.header.logoFileId).toBe("logo1");
    expect(doc.pages.map((p) => p.blocks.map((b) => b.type).join(","))).toEqual(["image,heading,heading,heading,text", "heading,text", "heading,pricingTable", "heading,text,signature,date"]);
    expect(doc.email).toEqual({ subject: "S", body: "B" });
  });

  it("fills merge fields and escapes values in HTML", () => {
    expect(mergeFields("<p>Hi {{contactFirstName}} of {{client}} {{unknown}}</p>", { contactFirstName: "Lerato", client: "A & B <Pty>" })).toBe(
      "<p>Hi Lerato of A &amp; B &lt;Pty&gt; {{unknown}}</p>",
    );
    expect(mergeFields("Hi {{ client }}", { client: "A & B" }, false)).toBe("Hi A & B");
  });

  it("converts plain text terms to paragraphs", () => {
    expect(textToHtml("One\nline two\n\n<b>Two</b>")).toBe("<p>One<br>line two</p><p>&lt;b&gt;Two&lt;/b&gt;</p>");
  });

  it("adds the chosen package's services to the pricing", () => {
    const doc = base();
    withPackages(doc);
    const own: DocLine[] = [{ id: "l1", name: "Setup", description: null, billingType: "ONCE_OFF", quantity: 1, unitPriceCents: 100000, taxable: true }];
    expect(linesWithPackage(own, doc, "pk1").map((l) => l.name)).toEqual(["Setup", "Bookkeeping"]);
    expect(linesWithPackage(own, doc, "nope")).toEqual(own);
    expect(linesWithPackage(own, doc, null)).toEqual(own);
  });

  it("lists what's missing before sending", () => {
    const doc = base();
    const msgs = docIssues(doc, { lineCount: 0, hasEmail: false, expired: false }).map((i) => i.message);
    expect(msgs).toContain("No services or packages added");
    expect(msgs).toContain("The lead has no email address");
    expect(msgs).toContain("An image block has no picture");
    withPackages(doc);
    expect(docIssues(doc, { lineCount: 0, hasEmail: true, expired: false }).map((i) => i.message)).not.toContain("No services or packages added");
  });
});

describe("client answers", () => {
  const today = "2026-10-30";
  const fields = () => {
    const doc = base();
    const ids = Object.fromEntries(allBlocks(doc).map((b) => [b.type, b.id]));
    return { doc, ids };
  };

  it("requires the signature and ticked agreement box", () => {
    const { doc, ids } = fields();
    expect(validateResponses(doc, {}, today)).toMatchObject({ ok: false });
    expect(validateResponses(doc, { [ids.checkbox!]: true }, today)).toMatchObject({ ok: false, error: expect.stringContaining("sign") });
    const r = validateResponses(doc, { [ids.checkbox!]: true, [ids.signature!]: { name: "Sipho Ndlovu", image: PNG } }, today);
    expect(r).toMatchObject({ ok: true, signerName: "Sipho Ndlovu" });
    if (r.ok) expect(r.values[ids.date!]).toBe(today);
  });

  it("rejects anything that isn't a PNG signature", () => {
    const { doc, ids } = fields();
    const r = validateResponses(doc, { [ids.checkbox!]: true, [ids.signature!]: { name: "Sipho", image: "javascript:alert(1)" } }, today);
    expect(r.ok).toBe(false);
  });

  it("only accepts listed radio options and offered packages", () => {
    const doc = base();
    const radio = newBlock("radio");
    if (radio.type === "radio") radio.required = true;
    doc.pages[0]!.blocks.push(radio);
    const pkgId = withPackages(doc);
    const sig = allBlocks(doc).find((b) => b.type === "signature")!.id;
    const box = allBlocks(doc).find((b) => b.type === "checkbox")!.id;
    const good = { [box]: true, [sig]: { name: "Sipho Ndlovu", image: PNG }, [radio.id]: "Option 1", [pkgId]: "pk1" };
    expect(validateResponses(doc, good, today)).toMatchObject({ ok: true, packageId: "pk1" });
    expect(validateResponses(doc, { ...good, [radio.id]: "Hacked" }, today).ok).toBe(false);
    expect(validateResponses(doc, { ...good, [pkgId]: "someone-elses" }, today)).toMatchObject({ ok: false, error: "Please choose a package." });
  });
});

describe("sanitising proposal HTML", () => {
  it("keeps Word-style formatting", () => {
    const html = '<h2 style="text-align: center">Title</h2><p><span style="color: #c00000; font-size: 18px; font-family: Georgia, serif">red</span> <mark data-color="#fff2a8" style="background-color: #fff2a8">hi</mark></p><table><tbody><tr><td colspan="2">x</td></tr></tbody></table>';
    // Only the spacing inside style attributes is normalised.
    expect(cleanHtml(html)).toBe(html.replace(/: /g, ":").replace(/; /g, ";"));
  });

  it("removes scripts, event handlers and unsafe links", () => {
    const out = cleanHtml('<p onclick="x()">a<script>alert(1)</script><a href="javascript:alert(1)">b</a><img src="x" onerror="alert(1)"><iframe src="https://evil"></iframe></p>');
    expect(out).not.toMatch(/script|onclick|onerror|javascript|iframe/);
  });

  it("only allows pictures from https or our asset store", () => {
    expect(cleanHtml('<img src="/api/assets/abc">')).toContain('src="/api/assets/abc"');
    expect(cleanHtml('<img src="data:image/png;base64,AAA">')).toBe("");
    expect(cleanHtml('<img src="/api/files/abc">')).toBe("");
  });

  it("drops style tricks", () => {
    expect(cleanHtml('<p style="position: fixed; background-image: url(x); color: red">t</p>')).toBe('<p style="color:red">t</p>');
  });

  it("opens links in a new tab safely", () => {
    expect(cleanHtml('<a href="https://outset.co.za">x</a>')).toBe('<a href="https://outset.co.za" target="_blank" rel="noopener noreferrer">x</a>');
  });

  it("cleans every text block of a document", () => {
    const doc = base();
    const text = doc.pages[0]!.blocks.find((b) => b.type === "text")!;
    if (text.type === "text") text.html = "<p>ok</p><script>bad()</script>";
    const out = sanitizeDoc(doc).pages[0]!.blocks.find((b) => b.id === text.id)!;
    expect(out.type === "text" && out.html).toBe("<p>ok</p>");
  });
});
