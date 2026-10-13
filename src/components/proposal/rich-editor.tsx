"use client";

import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Baseline, Bold, Columns3, Highlighter, ImagePlus, Italic, Link2, List, ListIndentDecrease, ListIndentIncrease, ListOrdered, Minus,
  Redo2, RemoveFormatting, Rows3, Strikethrough, Table, TableCellsMerge, TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart, Trash2, Underline, Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MERGE_FIELDS } from "@/lib/proposal-doc";

// A Word-style editor for proposal pages: a ribbon with fonts, sizes,
// colours, alignment, lists, tables, images, links and merge fields.

export const FONT_FAMILIES = [
  { label: "Theme font", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Carlito, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, 'EB Garamond', Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];
const SIZES = ["10", "11", "12", "14", "15", "16", "18", "20", "24", "28", "32", "36"];
const SWATCHES = ["#000000", "#434343", "#666666", "#c00000", "#e36c09", "#f1c232", "#38761d", "#1155cc", "#375dfb", "#674ea7", "#a61c00", "#ffffff"];
const HIGHLIGHTS = ["#fff2a8", "#ffd6a5", "#ffc9c9", "#c9f2c7", "#c7e3ff", "#e5d4ff"];

type Upload = (file: File) => Promise<{ url: string } | { error: string }>;

export function useDocEditor({ html, editable, placeholder, onChange }: { html: string; editable: boolean; placeholder?: string; onChange: (html: string) => void }) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable,
    content: html,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, codeBlock: false, code: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: true } }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "Start typing…" }),
    ],
    onUpdate: ({ editor }) => onChangeRef.current(editor.isEmpty ? "" : editor.getHTML()),
  });
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  return editor;
}

export function DocEditorContent({ editor }: { editor: Editor | null }) {
  return <EditorContent editor={editor} className="doc-editor doc-content" />;
}

function Btn({ on, active, title, children, disabled }: { on: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[#30344f] transition hover:bg-[#eef0ff] disabled:opacity-40 ${active ? "bg-[#e3e7ff] text-[#2d3fd3]" : ""}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px bg-[#e3e4ee]" aria-hidden />;

const selectCls = "h-8 rounded-md border border-[#e3e4ee] bg-white px-2 text-[13px] text-[#30344f] hover:border-[#c7cbe6] focus:outline-none";

function ColorMenu({ editor, kind }: { editor: Editor; kind: "text" | "highlight" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = kind === "text" ? (editor.getAttributes("textStyle").color as string | undefined) : (editor.getAttributes("highlight").color as string | undefined);
  const apply = (c: string | null) => {
    const chain = editor.chain().focus();
    if (kind === "text") (c ? chain.setColor(c) : chain.unsetColor()).run();
    else (c ? chain.setHighlight({ color: c }) : chain.unsetHighlight()).run();
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <Btn title={kind === "text" ? "Font colour" : "Highlight colour"} on={() => setOpen(!open)}>
        <span className="flex flex-col items-center leading-none">
          {kind === "text" ? <Baseline size={15} /> : <Highlighter size={15} />}
          <span className="mt-0.5 h-[3px] w-4 rounded" style={{ background: current ?? (kind === "text" ? "#000" : "#fff2a8") }} />
        </span>
      </Btn>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-48 rounded-lg border border-[#e3e4ee] bg-white p-2 shadow-lg">
          <button type="button" onClick={() => apply(null)} className="mb-2 w-full rounded px-2 py-1 text-left text-xs hover:bg-[#f3f4fa]">{kind === "text" ? "Automatic" : "No highlight"}</button>
          <div className="grid grid-cols-6 gap-1.5">
            {(kind === "text" ? SWATCHES : HIGHLIGHTS).map((c) => (
              <button key={c} type="button" title={c} onClick={() => apply(c)} className="h-6 w-6 rounded border border-black/10" style={{ background: c }} />
            ))}
          </div>
          <label className="mt-2 flex items-center justify-between text-xs text-[#6b7090]">
            Custom
            <input type="color" defaultValue={current ?? "#375dfb"} onChange={(e) => apply(e.target.value)} className="h-6 w-10 cursor-pointer" />
          </label>
        </div>
      )}
    </div>
  );
}

function styleValue(editor: Editor) {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("heading", { level: 4 })) return "h4";
  if (editor.isActive("blockquote")) return "quote";
  return "p";
}

/** The ribbon above the page, like Word's Home tab. */
export function Ribbon({ editor, onUpload }: { editor: Editor | null; onUpload?: Upload }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!editor) return <div className="h-11" />;
  const disabled = !editor.isEditable;
  const c = () => editor.chain().focus();
  const inTable = editor.isActive("table");
  const ts = editor.getAttributes("textStyle") as { fontFamily?: string; fontSize?: string };

  const setStyle = (v: string) => {
    const ch = c();
    if (v === "p") ch.setParagraph().run();
    else if (v === "quote") ch.setParagraph().toggleBlockquote().run();
    else ch.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 }).run();
  };
  const link = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url === "https://") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };
  const image = async (file: File) => {
    if (!onUpload) return;
    setBusy(true);
    const r = await onUpload(file);
    setBusy(false);
    if ("error" in r) alert(r.error);
    else c().setImage({ src: r.url, alt: file.name }).run();
  };

  return (
    <div className={`flex flex-wrap items-center gap-0.5 ${disabled ? "pointer-events-none opacity-50" : ""}`} role="toolbar" aria-label="Formatting">
      <Btn title="Undo (Ctrl+Z)" on={() => c().undo().run()} disabled={!editor.can().undo()}><Undo2 size={15} /></Btn>
      <Btn title="Redo (Ctrl+Y)" on={() => c().redo().run()} disabled={!editor.can().redo()}><Redo2 size={15} /></Btn>
      <Sep />
      <select value={styleValue(editor)} onChange={(e) => setStyle(e.target.value)} className={`${selectCls} w-[118px]`} aria-label="Paragraph style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="quote">Quote</option>
      </select>
      <select value={ts.fontFamily ?? ""} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())} className={`${selectCls} w-[128px]`} aria-label="Font">
        {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select value={ts.fontSize?.replace("px", "") ?? ""} onChange={(e) => (e.target.value ? c().setFontSize(`${e.target.value}px`).run() : c().unsetFontSize().run())} className={`${selectCls} w-[62px]`} aria-label="Font size">
        <option value="">Size</option>
        {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Sep />
      <Btn title="Bold (Ctrl+B)" on={() => c().toggleBold().run()} active={editor.isActive("bold")}><Bold size={15} /></Btn>
      <Btn title="Italic (Ctrl+I)" on={() => c().toggleItalic().run()} active={editor.isActive("italic")}><Italic size={15} /></Btn>
      <Btn title="Underline (Ctrl+U)" on={() => c().toggleUnderline().run()} active={editor.isActive("underline")}><Underline size={15} /></Btn>
      <Btn title="Strikethrough" on={() => c().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough size={15} /></Btn>
      <ColorMenu editor={editor} kind="text" />
      <ColorMenu editor={editor} kind="highlight" />
      <Sep />
      <Btn title="Align left" on={() => c().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}><TextAlignStart size={15} /></Btn>
      <Btn title="Centre" on={() => c().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}><TextAlignCenter size={15} /></Btn>
      <Btn title="Align right" on={() => c().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })}><TextAlignEnd size={15} /></Btn>
      <Btn title="Justify" on={() => c().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })}><TextAlignJustify size={15} /></Btn>
      <Sep />
      <Btn title="Bullets" on={() => c().toggleBulletList().run()} active={editor.isActive("bulletList")}><List size={15} /></Btn>
      <Btn title="Numbering" on={() => c().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered size={15} /></Btn>
      <Btn title="Decrease indent" on={() => c().liftListItem("listItem").run()} disabled={!editor.can().liftListItem("listItem")}><ListIndentDecrease size={15} /></Btn>
      <Btn title="Increase indent" on={() => c().sinkListItem("listItem").run()} disabled={!editor.can().sinkListItem("listItem")}><ListIndentIncrease size={15} /></Btn>
      <Sep />
      <Btn title="Link" on={link} active={editor.isActive("link")}><Link2 size={15} /></Btn>
      {onUpload && (
        <>
          <Btn title={busy ? "Uploading…" : "Insert picture"} on={() => fileRef.current?.click()} disabled={busy}><ImagePlus size={15} /></Btn>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void image(f); }} />
        </>
      )}
      <Btn title="Insert table" on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table size={15} /></Btn>
      <Btn title="Horizontal line" on={() => c().setHorizontalRule().run()}><Minus size={15} /></Btn>
      <select
        value=""
        onChange={(e) => { if (e.target.value) c().insertContent(`{{${e.target.value}}}`).run(); }}
        className={`${selectCls} w-[118px]`}
        aria-label="Insert field"
        title="Insert a field that fills in automatically, e.g. the client's name"
      >
        <option value="">Insert field…</option>
        {MERGE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <Btn title="Clear formatting" on={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={15} /></Btn>

      {inTable && (
        <div className="ml-1 flex items-center gap-0.5 rounded-md bg-[#f3f4fa] px-1">
          <span className="px-1 text-[11px] font-medium text-[#6b7090]">Table</span>
          <Btn title="Add row below" on={() => c().addRowAfter().run()}><Rows3 size={15} /></Btn>
          <Btn title="Add column right" on={() => c().addColumnAfter().run()}><Columns3 size={15} /></Btn>
          <Btn title="Merge or split cells" on={() => c().mergeOrSplit().run()}><TableCellsMerge size={15} /></Btn>
          <Btn title="Header row on/off" on={() => c().toggleHeaderRow().run()}><span className="text-[11px] font-semibold">H</span></Btn>
          <Btn title="Delete row" on={() => c().deleteRow().run()}><span className="text-[11px]">−Row</span></Btn>
          <Btn title="Delete column" on={() => c().deleteColumn().run()}><span className="text-[11px]">−Col</span></Btn>
          <Btn title="Delete table" on={() => c().deleteTable().run()}><Trash2 size={14} /></Btn>
        </div>
      )}
    </div>
  );
}
