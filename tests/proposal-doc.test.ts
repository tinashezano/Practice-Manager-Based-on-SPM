import { describe, expect, it } from "vitest";
import { defaultDoc, docIssues, mergeFields, normalizeDoc, textToHtml } from "@/lib/proposal-doc";
import { cleanHtml, sanitizeDoc } from "@/lib/sanitize";

const base = () => defaultDoc("1. Fees are payable on acceptance.");

describe("proposal document", () => {
  it("starts with the standard pages in order", () => {
    expect(base().sections.map((s) => s.kind)).toEqual(["introduction", "services", "pricing", "documents", "terms", "nextStep", "perks", "thankYou"]);
  });

  it("falls back to the default for missing or broken content", () => {
    expect(normalizeDoc(null, base).sections).toHaveLength(8);
    expect(normalizeDoc({ nonsense: true }, base).sections).toHaveLength(8);
  });

  it("restores required pages that were removed", () => {
    const doc = base();
    doc.sections = doc.sections.filter((s) => s.kind === "introduction");
    const fixed = normalizeDoc(JSON.parse(JSON.stringify(doc)), base);
    expect(fixed.sections.map((s) => s.kind)).toEqual(["introduction", "services", "pricing", "terms"]);
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

  it("lists what's missing before sending", () => {
    const doc = base();
    const msgs = docIssues(doc, { lineCount: 0, hasEmail: false, expired: false }).map((i) => i.message);
    expect(msgs).toContain("No services added");
    expect(msgs).toContain("The lead has no email address");
    expect(docIssues(doc, { lineCount: 2, hasEmail: true, expired: false })).toEqual([]);
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

  it("cleans every section of a document", () => {
    const doc = base();
    doc.sections[0]!.html = "<p>ok</p><script>bad()</script>";
    expect(sanitizeDoc(doc).sections[0]!.html).toBe("<p>ok</p>");
  });
});
