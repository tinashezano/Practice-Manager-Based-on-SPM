import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders Resource Hub content. Raw HTML in the source is not rendered, so
// pasted content can't inject scripts.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h2 className="mt-6 text-lg font-semibold" {...p} />,
          h2: (p) => <h3 className="mt-5 text-base font-semibold" {...p} />,
          h3: (p) => <h4 className="mt-4 text-sm font-semibold" {...p} />,
          ul: (p) => <ul className="list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="list-decimal space-y-1 pl-5" {...p} />,
          a: ({ href, ...p }) => <a href={href} target="_blank" rel="noreferrer noopener" className="text-brand underline" {...p} />,
          blockquote: (p) => <blockquote className="border-l-4 border-amber-300 bg-amber-50/60 px-3 py-2 text-foreground" {...p} />,
          code: (p) => <code className="rounded bg-background px-1 py-0.5 font-mono text-[12px]" {...p} />,
          pre: (p) => <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs" {...p} />,
          table: (p) => <div className="overflow-x-auto"><table className="w-full border-collapse text-sm" {...p} /></div>,
          th: (p) => <th className="border border-border bg-background px-2 py-1 text-left font-medium" {...p} />,
          td: (p) => <td className="border border-border px-2 py-1 align-top" {...p} />,
          hr: () => <hr className="border-border" />,
          input: (p) => <input {...p} disabled className="mr-1.5 align-middle" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
