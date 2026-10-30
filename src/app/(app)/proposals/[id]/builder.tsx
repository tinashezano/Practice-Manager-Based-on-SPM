"use client";

import {
  DndContext, DragOverlay, PointerSensor, closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import type { Editor } from "@tiptap/react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Bookmark, Braces, CalendarDays, ChevronRight, CircleDot, Copy, EllipsisVertical, Eye, FileDown, FileText, GripVertical,
  Heading1, Image as ImageIcon, LayoutTemplate, Library, Minus, Package, PenLine, Plus, Save, Search, Send, Settings2, Signature, SquareCheck, Table,
  TextCursorInput, Trash2, Type, Upload, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BlockView, Sheet, themeStyle } from "@/components/proposal/document";
import { DocEditorContent, Ribbon, useDocEditor } from "@/components/proposal/rich-editor";
import { useAction } from "@/components/tasks/use-action";
import { computeTotals, dueNow, formatRand } from "@/lib/money";
import {
  ELEMENTS, cloneBlock, clonePage, docIssues, mergeValues, newBlock, newPage,
  type Block, type BlockOf, type BlockType, type DocContext, type DocPage, type PackageSnapshot, type ProposalDoc, type Responses,
} from "@/lib/proposal-doc";
import { deleteDraft, deleteLibraryBlock, deleteTemplate, saveLibraryBlock, saveProposal, saveTemplate, send, setDefaultTemplate } from "../actions";
import {
  DetailsModal, HeaderFooterModal, LibraryModal, Modal, PropertiesPanel, SendModal, TemplatesModal, VariablesModal, upload,
  type LibraryRow, type Option, type TemplateRow,
} from "./builder-panels";

type State = { title: string; validUntil: string; startDate: string | null; doc: ProposalDoc };
type DragData = { kind: "new"; type: BlockType } | { kind: "block"; pageId: string } | { kind: "page"; pageId: string };
type Drop = { pageId: string; index: number } | null;
type ModalName = "header" | "templates" | "library" | "variables" | "send" | "details" | "status";

export type BuilderProps = {
  id: string;
  number: string;
  status: string;
  statusLabel: string;
  locked: boolean;
  expired: boolean;
  backHref: string;
  initial: State;
  builtInDoc: ProposalDoc;
  ctx: DocContext;
  contactEmail: string | null;
  responses: Responses | null;
  services: Option[];
  packages: Option[];
  firmPackages: PackageSnapshot[];
  templates: TemplateRow[];
  library: LibraryRow[];
  canManageTemplates: boolean;
  updatedAt: string;
  paymentMode: string;
  statusPanel: React.ReactNode;
};

const ICONS: Record<BlockType, LucideIcon> = {
  text: Type, heading: Heading1, image: ImageIcon, divider: Minus, signature: PenLine, initials: Signature, textField: TextCursorInput,
  date: CalendarDays, checkbox: SquareCheck, radio: CircleDot, pricingTable: Table, packages: Package,
};

const savedFmt = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });

// Pointer-within first (so blocks win over the page behind them), then nearest.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const blocks = hits.filter((h) => !String(h.id).startsWith("page:"));
  if (blocks.length) return blocks;
  return hits.length ? hits : closestCenter(args);
};

export function ProposalBuilder(props: BuilderProps) {
  const { id, locked, ctx } = props;
  const [state, setState] = useState<State>(props.initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState(props.initial.doc.pages[0]!.id);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [modal, setModal] = useState<ModalName | null>(null);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<BlockType | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [save, setSave] = useState<{ status: "saved" | "dirty" | "saving" | "error"; at: string; error?: string }>({ status: "saved", at: props.updatedAt });
  const { run, pending, toast } = useAction();
  const [sending, startSend] = useTransition();
  const stateRef = useRef(state);
  stateRef.current = state;
  const savedJson = useRef(JSON.stringify(props.initial));
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const doc = state.doc;

  const live: DocContext = useMemo(() => ({ ...ctx, title: state.title, validUntil: state.validUntil, startDate: state.startDate }), [ctx, state.title, state.validUntil, state.startDate]);
  const values = useMemo(() => mergeValues(live), [live]);
  const issues = docIssues(doc, { lineCount: ctx.lines.length, hasEmail: !!props.contactEmail, expired: props.expired });
  const totals = computeTotals(ctx.lines, ctx.vatRate);

  // ---------- Autosave ----------
  const flush = useCallback(() => {
    chain.current = chain.current.then(async () => {
      const snapshot = JSON.stringify(stateRef.current);
      if (snapshot === savedJson.current) return true;
      setSave((s) => ({ ...s, status: "saving" }));
      const r = await saveProposal(id, stateRef.current);
      if (!r.ok) {
        setSave((s) => ({ ...s, status: "error", error: r.error }));
        return false;
      }
      savedJson.current = snapshot;
      setSave({ status: JSON.stringify(stateRef.current) === snapshot ? "saved" : "dirty", at: r.savedAt ?? new Date().toISOString() });
      return true;
    });
    return chain.current;
  }, [id]);

  useEffect(() => {
    if (locked || JSON.stringify(state) === savedJson.current) return;
    setSave((s) => (s.status === "dirty" ? s : { ...s, status: "dirty" }));
    const t = setTimeout(() => void flush(), 900);
    return () => clearTimeout(t);
  }, [state, flush, locked]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(stateRef.current) !== savedJson.current) e.preventDefault();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setSelectedId(null), setMenu(false));
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  // ---------- Document edits ----------
  const setDoc = useCallback((fn: (d: ProposalDoc) => ProposalDoc) => setState((s) => ({ ...s, doc: fn(s.doc) })), []);
  const setPages = useCallback((fn: (pages: DocPage[]) => DocPage[]) => setDoc((d) => ({ ...d, pages: fn(d.pages) })), [setDoc]);
  const locate = (blockId: string) => {
    for (const p of doc.pages) {
      const i = p.blocks.findIndex((b) => b.id === blockId);
      if (i >= 0) return { page: p, index: i, block: p.blocks[i]! };
    }
    return null;
  };

  const insertBlock = (block: Block, pageId = activePageId, index?: number) => {
    setPages((pages) => pages.map((p) => (p.id === pageId ? { ...p, blocks: [...p.blocks.slice(0, index ?? p.blocks.length), block, ...p.blocks.slice(index ?? p.blocks.length)] } : p)));
    setSelectedId(block.id);
    setActivePageId(pageId);
  };
  const patchBlock = useCallback((blockId: string, patch: Partial<Block>) => setPages((pages) => pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)) }))), [setPages]);
  const removeBlock = (blockId: string) => {
    setPages((pages) => pages.map((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== blockId) })));
    setSelectedId(null);
  };
  const duplicateBlock = (blockId: string) => {
    const at = locate(blockId);
    if (at) insertBlock(cloneBlock(at.block), at.page.id, at.index + 1);
  };
  const moveBlockTo = (blockId: string, pageId: string, index: number) =>
    setPages((pages) => {
      const from = pages.find((p) => p.blocks.some((b) => b.id === blockId));
      if (!from) return pages;
      const fromIndex = from.blocks.findIndex((b) => b.id === blockId);
      const block = from.blocks[fromIndex]!;
      const target = from.id === pageId && fromIndex < index ? index - 1 : index;
      const without = pages.map((p) => (p.id === from.id ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) } : p));
      return without.map((p) => (p.id === pageId ? { ...p, blocks: [...p.blocks.slice(0, target), block, ...p.blocks.slice(target)] } : p));
    });
  const nudgeBlock = (blockId: string, dir: -1 | 1) => {
    const at = locate(blockId);
    if (!at) return;
    const pi = doc.pages.indexOf(at.page);
    const j = at.index + dir;
    if (j >= 0 && j < at.page.blocks.length) moveBlockTo(blockId, at.page.id, dir === 1 ? j + 1 : j);
    else if (dir === -1 && pi > 0) moveBlockTo(blockId, doc.pages[pi - 1]!.id, doc.pages[pi - 1]!.blocks.length);
    else if (dir === 1 && pi < doc.pages.length - 1) moveBlockTo(blockId, doc.pages[pi + 1]!.id, 0);
  };

  const addPage = (afterIndex: number) => {
    const p = newPage();
    setPages((pages) => [...pages.slice(0, afterIndex + 1), p, ...pages.slice(afterIndex + 1)]);
    setActivePageId(p.id);
  };
  const movePage = (index: number, dir: -1 | 1) =>
    setPages((pages) => {
      const j = index + dir;
      if (j < 0 || j >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });

  const saveToLibrary = (block: Block) => {
    const name = window.prompt("Name this block for your library", block.type === "heading" ? block.text : "");
    if (name?.trim()) run(() => saveLibraryBlock({ name: name.trim(), block }), () => alert("Saved to your library."));
  };

  // ---------- Drag and drop ----------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const dropTarget = (e: DragOverEvent | DragEndEvent): Drop => {
    const { over, active } = e;
    const data = over?.data.current as DragData | undefined;
    if (!over || !data || over.id === active.id) return null;
    const page = doc.pages.find((p) => p.id === (data as { pageId?: string }).pageId);
    if (!page) return null;
    if (data.kind === "page") return { pageId: page.id, index: page.blocks.length };
    const idx = page.blocks.findIndex((b) => b.id === over.id);
    const r = active.rect.current.translated;
    const y = r ? r.top + r.height / 2 : 0;
    return { pageId: page.id, index: idx + (y > over.rect.top + over.rect.height / 2 ? 1 : 0) };
  };
  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData;
    setDragging(data.kind === "new" ? data.type : locate(String(e.active.id))?.block.type ?? null);
  };
  const onDragOver = (e: DragOverEvent) => setDrop(dropTarget(e));
  const onDragEnd = (e: DragEndEvent) => {
    const t = dropTarget(e);
    setDrop(null);
    setDragging(null);
    if (!t) return;
    const data = e.active.data.current as DragData;
    if (data.kind === "new") insertBlock(newBlock(data.type), t.pageId, t.index);
    else moveBlockTo(String(e.active.id), t.pageId, t.index);
  };

  const selected = selectedId ? locate(selectedId)?.block ?? null : null;
  const ribbonEditor = selected?.type === "text" && editor && !editor.isDestroyed ? editor : null;
  const imageUpload = useCallback(async (file: File) => {
    const r = await upload(file, "image");
    return "error" in r ? { error: r.error } : { url: r.url };
  }, []);

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    if (selected?.type === "text" && editor && !editor.isDestroyed) {
      editor.chain().focus().insertContent(token).run();
      return "Inserted";
    }
    if (selected?.type === "heading") {
      patchBlock(selected.id, { text: `${selected.text} ${token}`.trim() });
      return "Inserted";
    }
    void navigator.clipboard?.writeText(token);
    return "Copied";
  };

  const doSend = () =>
    startSend(async () => {
      if (!(await flush())) return;
      run(() => send(id), () => setModal(null));
    });

  const filtered = ELEMENTS.filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount = doc.pages.length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f7f8fc]">
      {toast}
      {/* ---------- Breadcrumb ---------- */}
      <div className="flex h-11 items-center gap-2 border-b border-border bg-white px-4 text-xs text-muted">
        <Link href={props.backHref} className="flex items-center gap-1 hover:text-brand"><ArrowLeft size={14} /> Back</Link>
        <span className="mx-1 h-4 w-px bg-border" />
        <Link href="/proposals" className="hover:text-brand">Proposals</Link>
        <ChevronRight size={12} />
        <span className="text-brand">{locked ? "View" : "Edit"}</span>
        <span className="ml-3 rounded-md bg-background px-2 py-0.5 font-medium text-foreground">{props.number}</span>
        <span className={props.status === "DRAFT" ? "text-[#f97316]" : "text-brand"}>• {props.statusLabel}</span>
        <span className={`ml-auto ${save.status === "error" ? "text-danger" : ""}`} title={save.error}>
          {locked ? "Signed proposals can't be edited" : save.status === "saving" ? "Saving…" : save.status === "dirty" ? "Unsaved changes" : save.status === "error" ? `Not saved: ${save.error}` : `All changes saved · ${savedFmt.format(new Date(save.at))}`}
        </span>
      </div>

      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-4 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white"><FileText size={16} /></span>
        <input
          value={state.title}
          disabled={locked}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          aria-label="Proposal title"
          className="h-8 w-64 rounded-lg border border-border px-3 text-sm focus:border-brand focus:outline-none disabled:bg-background"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-white">Proposal loaded (Total: {formatRand(dueNow(totals))})</span>
          {!locked && (
            <>
              <TopBtn icon={Settings2} onClick={() => setModal("header")}>Header &amp; Footer</TopBtn>
              <TopBtn icon={LayoutTemplate} onClick={() => setModal("templates")}>Templates</TopBtn>
              <TopBtn icon={Library} onClick={() => setModal("library")}>Library</TopBtn>
              <TopBtn icon={Braces} onClick={() => setModal("variables")}>Variables</TopBtn>
            </>
          )}
          <a href={`/proposal-preview/${id}`} target="_blank" className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-background"><Eye size={14} /> Preview</a>
          {!locked && (
            <>
              <button onClick={() => void flush()} className="flex h-8 items-center gap-1.5 rounded-lg border border-brand px-3 text-xs font-medium text-brand hover:bg-brand-soft"><Save size={14} /> Save Proposal</button>
              {!props.expired && props.status !== "WITHDRAWN" && (
                <button onClick={() => setModal("send")} className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white hover:bg-brand-hover"><Send size={14} /> {props.status === "DRAFT" ? "Send" : "Resend"}</button>
              )}
            </>
          )}
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-background" aria-label="More"><EllipsisVertical size={15} /></button>
            {menu && (
              <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-border bg-white p-1.5 text-sm shadow-xl" onMouseLeave={() => setMenu(false)}>
                <MenuItem onClick={() => { setModal("details"); setMenu(false); }}>Proposal details & dates</MenuItem>
                <MenuItem onClick={() => { setModal("status"); setMenu(false); }}>Status, payments & signature</MenuItem>
                <a href={`/proposal-preview/${id}?print=1`} target="_blank" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-background"><FileDown size={14} /> Download PDF</a>
                {props.status === "DRAFT" && <MenuItem danger onClick={() => confirm("Delete this draft proposal?") && run(() => deleteDraft(id))}>Delete draft</MenuItem>}
              </div>
            )}
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setDrop(null); setDragging(null); }}>
        <div className="flex min-h-0 flex-1">
          {/* ---------- Left panel ---------- */}
          <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-border bg-white">
            {selected && !locked ? (
              <div className="p-4">
                <button onClick={() => setSelectedId(null)} className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-brand"><ArrowLeft size={13} /> Elements</button>
                <PropertiesPanel
                  key={selected.id}
                  block={selected}
                  onChange={(patch) => patchBlock(selected.id, patch)}
                  onDuplicate={() => duplicateBlock(selected.id)}
                  onDelete={() => removeBlock(selected.id)}
                  onSaveToLibrary={() => saveToLibrary(selected)}
                  proposalId={id}
                  lines={ctx.lines}
                  vatRate={ctx.vatRate}
                  services={props.services}
                  packages={props.packages}
                  firmPackages={props.firmPackages}
                />
              </div>
            ) : (
              <>
                <div className="border-b border-border px-4 py-4">
                  <h2 className="text-sm font-semibold">Document Builder</h2>
                  <p className="text-xs text-muted">{locked ? "This proposal is signed and locked." : "Drag elements to your document, or click to add"}</p>
                </div>
                {!locked && (
                  <div className="space-y-5 p-4">
                    <div className="flex overflow-hidden rounded-lg border border-border">
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search elements..." className="min-w-0 flex-1 px-3 py-2 text-sm focus:outline-none" aria-label="Search elements" />
                      <span className="flex w-9 items-center justify-center bg-brand text-white"><Search size={14} /></span>
                    </div>
                    {(["Text Elements", "Form Elements", "Business Elements"] as const).map((g) => {
                      const items = filtered.filter((e) => e.group === g);
                      if (!items.length) return null;
                      return (
                        <div key={g}>
                          <h3 className="mb-2 text-xs font-semibold">{g}</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {items.map((e) => <PaletteItem key={e.type} type={e.type} label={e.label} hint={e.hint} onAdd={() => insertBlock(newBlock(e.type))} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </aside>

          {/* ---------- Canvas ---------- */}
          <main className="flex min-w-0 flex-1 flex-col">
            {!locked && (
              <div className="z-20 border-b border-border bg-white px-3 py-1.5">
                <Ribbon editor={ribbonEditor} onUpload={imageUpload} />
              </div>
            )}
            <div
              className="min-h-0 flex-1 overflow-auto bg-[#eef0f7] bg-[radial-gradient(#cdd2e1_1px,transparent_1px)] [background-size:16px_16px] px-6 py-8"
              onMouseDown={(e) => e.target === e.currentTarget && setSelectedId(null)}
              style={themeStyle(doc)}
            >
              <div className="mx-auto max-w-full space-y-4" style={{ width: doc.pages.some((p) => p.orientation === "landscape") ? 1123 : 794 }}>
                {doc.pages.map((page, pi) => (
                  <div key={page.id} className="space-y-3">
                    {!locked && (
                      <div className="flex items-center gap-2">
                        <PageBtn label="Move page up" disabled={pi === 0} onClick={() => movePage(pi, -1)}><ArrowUp size={13} /></PageBtn>
                        <PageBtn label="Move page down" disabled={pi === pageCount - 1} onClick={() => movePage(pi, 1)}><ArrowDown size={13} /></PageBtn>
                        <button
                          onClick={() => setPages((pages) => pages.map((p) => (p.id === page.id ? { ...p, orientation: p.orientation === "portrait" ? "landscape" : "portrait" } : p)))}
                          className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[11px] hover:border-brand"
                          title="Switch portrait / landscape"
                        >
                          <FileText size={12} /> A4 · {page.orientation === "portrait" ? "Portrait" : "Landscape"}
                        </button>
                        <span className="text-[11px] text-muted">Page {pi + 1} of {pageCount}</span>
                        <span className="flex-1" />
                        <PageBtn label="Add a page after this one" onClick={() => addPage(pi)}><Plus size={14} /></PageBtn>
                        <span className="flex-1" />
                        <PageMenu
                          onDuplicate={() => setPages((pages) => [...pages.slice(0, pi + 1), clonePage(page), ...pages.slice(pi + 1)])}
                          onDelete={pageCount > 1 ? () => (!page.blocks.length || confirm("Delete this page and everything on it?")) && setPages((pages) => pages.filter((p) => p.id !== page.id)) : undefined}
                        />
                      </div>
                    )}
                    <div onMouseDown={() => setActivePageId(page.id)}>
                      <Sheet page={page} index={pi} total={pageCount} doc={doc} values={values} className={activePageId === page.id && !locked ? "outline outline-2 outline-offset-4 outline-[#c7cbe6]" : ""}>
                        <PageBody pageId={page.id} empty={!page.blocks.length} locked={locked} showEndLine={drop?.pageId === page.id && drop.index === page.blocks.length && page.blocks.length > 0}>
                          {page.blocks.map((b, bi) => (
                            <div key={b.id}>
                              {drop?.pageId === page.id && drop.index === bi && <DropLine />}
                              {locked ? (
                                <BlockView block={b} values={values} lines={ctx.lines} vatRate={ctx.vatRate} responses={props.responses} />
                              ) : (
                                <BlockShell
                                  block={b}
                                  pageId={page.id}
                                  selected={selectedId === b.id}
                                  onSelect={() => { setSelectedId(b.id); setActivePageId(page.id); }}
                                  onUp={() => nudgeBlock(b.id, -1)}
                                  onDown={() => nudgeBlock(b.id, 1)}
                                  onDuplicate={() => duplicateBlock(b.id)}
                                  onLibrary={() => saveToLibrary(b)}
                                  onDelete={() => removeBlock(b.id)}
                                >
                                  <EditableBlock block={b} values={values} ctx={ctx} onPatch={(patch) => patchBlock(b.id, patch)} onFocusEditor={setEditor} />
                                </BlockShell>
                              )}
                            </div>
                          ))}
                        </PageBody>
                      </Sheet>
                    </div>
                  </div>
                ))}
                {!locked && (
                  <button onClick={() => addPage(pageCount - 1)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#c7cbe6] py-4 text-sm text-brand hover:bg-white">
                    <Plus size={15} /> Add page
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="flex items-center gap-2 rounded-lg border border-brand bg-white px-3 py-2 text-sm font-medium text-brand shadow-xl">
              {(() => { const I = ICONS[dragging]; return <I size={15} />; })()} {ELEMENTS.find((e) => e.type === dragging)?.label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {modal === "header" && <HeaderFooterModal doc={doc} setDoc={setDoc} onClose={() => setModal(null)} />}
      {modal === "templates" && (
        <TemplatesModal
          templates={props.templates}
          canManage={props.canManageTemplates}
          onApply={(tpl) => {
            if (!confirm("Replace this proposal's pages with the template? Services and prices are kept.")) return;
            const source = tpl ?? props.builtInDoc;
            setDoc(() => ({ ...structuredClone(source), pages: source.pages.map(clonePage) }));
            setSelectedId(null);
            setModal(null);
          }}
          onSave={(name, makeDefault) => run(() => saveTemplate({ name, doc, makeDefault }), () => alert(`Saved the template "${name}".`))}
          onSetDefault={(tid) => run(() => setDefaultTemplate(tid))}
          onDelete={(tid) => run(() => deleteTemplate(tid))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "library" && (
        <LibraryModal
          library={props.library}
          onInsert={(b) => { insertBlock(cloneBlock(b)); setModal(null); }}
          onDelete={(lid) => run(() => deleteLibraryBlock(lid))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "variables" && <VariablesModal values={values} onInsert={insertVariable} onClose={() => setModal(null)} />}
      {modal === "send" && (
        <SendModal doc={doc} setDoc={setDoc} to={props.contactEmail} values={{ ...values, senderName: values.senderName }} issues={issues} sending={sending || pending} isDraft={props.status === "DRAFT"} onSend={doSend} onClose={() => setModal(null)} />
      )}
      {modal === "details" && (
        <DetailsModal title={state.title} validUntil={state.validUntil} startDate={state.startDate} locked={locked} onChange={(patch) => setState((s) => ({ ...s, ...patch }))} onClose={() => setModal(null)} />
      )}
      {modal === "status" && (
        <Modal title="Status, payments & signature" onClose={() => setModal(null)}>
          {props.statusPanel}
          <p className="text-[11px] text-muted">Payments: {props.paymentMode}</p>
        </Modal>
      )}
    </div>
  );
}

// ---------- Pieces ----------

function TopBtn({ icon: Icon, onClick, children }: { icon: LucideIcon; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-background">
      <Icon size={14} /> {children}
    </button>
  );
}

function MenuItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-background ${danger ? "text-danger" : ""}`}>{children}</button>;
}

function PageBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label} className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-muted hover:border-brand hover:text-brand disabled:opacity-40">
      {children}
    </button>
  );
}

function PageMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <PageBtn label="Page options" onClick={() => setOpen(!open)}><EllipsisVertical size={14} /></PageBtn>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-border bg-white p-1.5 text-sm shadow-xl" onMouseLeave={() => setOpen(false)}>
          <MenuItem onClick={() => { onDuplicate(); setOpen(false); }}><Copy size={14} /> Duplicate page</MenuItem>
          {onDelete && <MenuItem danger onClick={() => { onDelete(); setOpen(false); }}><Trash2 size={14} /> Delete page</MenuItem>}
        </div>
      )}
    </div>
  );
}

function PaletteItem({ type, label, hint, onAdd }: { type: BlockType; label: string; hint: string; onAdd: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `new:${type}`, data: { kind: "new", type } satisfies DragData });
  const Icon = ICONS[type];
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onAdd}
      title={`Drag onto a page, or click to add`}
      className={`flex items-start gap-2 rounded-lg border border-border p-2.5 text-left transition hover:border-brand hover:shadow-sm ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand"><Icon size={13} /></span>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block truncate text-[10px] text-muted">{hint}</span>
      </span>
    </button>
  );
}

function PageBody({ pageId, empty, locked, showEndLine, children }: { pageId: string; empty: boolean; locked: boolean; showEndLine: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `page:${pageId}`, data: { kind: "page", pageId } satisfies DragData, disabled: locked });
  return (
    <div ref={setNodeRef} className="min-h-[240px] space-y-4">
      {children}
      {showEndLine && <DropLine />}
      {empty && !locked && (
        <div className={`flex h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm ${isOver ? "border-[color:var(--p-accent)] bg-[color-mix(in_srgb,var(--p-accent)_5%,white)]" : "border-[#d9dcea] text-muted"}`}>
          <Plus size={18} className="mb-1" /> Drag elements here
        </div>
      )}
    </div>
  );
}

const DropLine = () => <div className="my-1 h-1 rounded-full" style={{ background: "var(--p-accent)" }} />;

function BlockShell({ block, pageId, selected, onSelect, onUp, onDown, onDuplicate, onLibrary, onDelete, children }: {
  block: Block;
  pageId: string;
  selected: boolean;
  onSelect: () => void;
  onUp: () => void;
  onDown: () => void;
  onDuplicate: () => void;
  onLibrary: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const drag = useDraggable({ id: block.id, data: { kind: "block", pageId } satisfies DragData });
  const dropzone = useDroppable({ id: block.id, data: { kind: "block", pageId } satisfies DragData });
  const tool = "flex h-7 w-7 items-center justify-center rounded-md text-[#4b5563] hover:bg-[#eef0ff] hover:text-[#2d3fd3]";
  return (
    <div ref={dropzone.setNodeRef} className="group relative" onMouseDown={onSelect}>
      <div
        ref={drag.setNodeRef}
        className={`relative rounded-md transition ${selected ? "ring-2 ring-[color:var(--p-accent)] ring-offset-[6px]" : "hover:ring-1 hover:ring-[#c7cbe6] hover:ring-offset-[6px]"} ${drag.isDragging ? "opacity-30" : ""}`}
      >
        <button
          {...drag.listeners}
          {...drag.attributes}
          className="absolute -left-9 top-0 flex h-7 w-6 cursor-grab items-center justify-center rounded text-[#9ca3af] opacity-0 hover:bg-[#eef0ff] hover:text-[#2d3fd3] group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to move"
          title="Drag to move"
        >
          <GripVertical size={15} />
        </button>
        {selected && (
          <div className="absolute -top-11 right-0 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shadow-md" onMouseDown={(e) => e.stopPropagation()}>
            <button className={tool} onClick={onUp} title="Move up" aria-label="Move block up"><ArrowUp size={14} /></button>
            <button className={tool} onClick={onDown} title="Move down" aria-label="Move block down"><ArrowDown size={14} /></button>
            <button className={tool} onClick={onDuplicate} title="Duplicate" aria-label="Duplicate block"><Copy size={14} /></button>
            <button className={tool} onClick={onLibrary} title="Save to library" aria-label="Save block to library"><Bookmark size={14} /></button>
            <button className={`${tool} hover:text-[#dc2626]`} onClick={onDelete} title="Delete" aria-label="Delete block"><Trash2 size={14} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function EditableBlock({ block, values, ctx, onPatch, onFocusEditor }: { block: Block; values: Record<string, string>; ctx: DocContext; onPatch: (p: Partial<Block>) => void; onFocusEditor: (e: Editor) => void }) {
  if (block.type === "heading") return <HeadingEditor block={block} onPatch={onPatch} />;
  if (block.type === "text") return <TextEditor block={block} onPatch={onPatch} onFocusEditor={onFocusEditor} />;
  if (block.type === "image") return <BlockView block={block} values={values} lines={ctx.lines} vatRate={ctx.vatRate} imagePlaceholder={<ImageDrop onUploaded={(fileId) => onPatch({ fileId } as Partial<Block>)} />} />;
  if (block.type === "packages" && !block.packages.length) {
    return <div className="pointer-events-none"><BlockView block={block} values={values} lines={ctx.lines} vatRate={ctx.vatRate} /><p className="mt-1 text-center text-[11px] text-muted">Select this block and tick the packages to offer.</p></div>;
  }
  return <div className="pointer-events-none select-none"><BlockView block={block} values={values} lines={ctx.lines} vatRate={ctx.vatRate} /></div>;
}

const HEADING_CLS = { 1: "text-[28px] leading-tight", 2: "text-[21px]", 3: "text-base" } as const;

function HeadingEditor({ block, onPatch }: { block: BlockOf<"heading">; onPatch: (p: Partial<Block>) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text, block.level]);
  return (
    <textarea
      ref={ref}
      value={block.text}
      rows={1}
      onChange={(e) => onPatch({ text: e.target.value } as Partial<Block>)}
      aria-label="Heading"
      className={`block w-full resize-none overflow-hidden bg-transparent font-semibold tracking-tight text-[#111827] focus:outline-none ${HEADING_CLS[block.level]} ${block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "text-left"}`}
    />
  );
}

function TextEditor({ block, onPatch, onFocusEditor }: { block: BlockOf<"text">; onPatch: (p: Partial<Block>) => void; onFocusEditor: (e: Editor) => void }) {
  const editor = useDocEditor({ html: block.html, editable: true, onChange: (html) => onPatch({ html } as Partial<Block>), onFocus: onFocusEditor, placeholder: "Type here…" });
  return <DocEditorContent editor={editor} />;
}

function ImageDrop({ onUploaded }: { onUploaded: (fileId: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex h-36 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#d9dcea] text-sm text-muted hover:border-[color:var(--p-accent)]"
    >
      <Upload size={18} /> {busy ? "Uploading…" : "Click to upload an image"}
      <span className="text-[11px]">PNG, JPEG or WebP, up to 5 MB</span>
      <input
        ref={ref}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          const r = await upload(f, "image");
          setBusy(false);
          if ("error" in r) alert(r.error);
          else onUploaded(r.id);
        }}
      />
    </button>
  );
}
