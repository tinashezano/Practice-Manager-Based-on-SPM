import sanitizeHtml from "sanitize-html";
import type { ProposalDoc } from "@/lib/proposal-doc";

// Proposal pages are shown to clients, so everything typed in the editor is
// cleaned on save: only formatting markup survives, never scripts, event
// handlers, iframes or arbitrary styles.

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "span", "mark", "ul", "ol", "li",
    "blockquote", "a", "hr", "img", "table", "colgroup", "col", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    th: ["colspan", "rowspan", "colwidth"],
    td: ["colspan", "rowspan", "colwidth"],
    col: ["span"],
    mark: ["data-color"],
  },
  allowedStyles: {
    "*": {
      color: COLOR,
      "background-color": COLOR,
      "font-family": [/^[\w\s,'"-]+$/],
      "font-size": [/^\d{1,2}(\.\d+)?(px|pt|em|rem)$/],
      "text-align": [/^(left|right|center|justify)$/],
      "line-height": [/^[\d.]+$/],
      width: [/^\d+(px|%)$/],
      "min-width": [/^\d+px$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  // Images may also come from our own proposal asset store.
  exclusiveFilter: (frame) => frame.tag === "img" && !/^(https:\/\/|\/api\/assets\/)/.test(frame.attribs.src ?? ""),
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
  },
};

export function cleanHtml(html: string) {
  return sanitizeHtml(html, OPTIONS);
}

export function sanitizeDoc(doc: ProposalDoc): ProposalDoc {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      html: cleanHtml(s.html),
      title: s.title.trim() || "Untitled",
      perks: s.perks.map((p) => ({ ...p, title: p.title.trim(), text: p.text.trim() })),
    })),
  };
}
