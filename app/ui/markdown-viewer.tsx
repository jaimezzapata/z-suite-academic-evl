"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function toPlainText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(toPlainText).join("");
  if (children && typeof children === "object" && "props" in (children as any)) {
    return toPlainText((children as any).props?.children);
  }
  return "";
}

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || "section";
}

export function MarkdownViewer({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 text-zinc-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => {
            const text = toPlainText(props.children);
            const id = typeof props.id === "string" ? props.id : slugify(text);
            return <h1 {...props} id={id} className="scroll-mt-24 text-2xl font-semibold tracking-tight" />;
          },
          h2: (props) => {
            const text = toPlainText(props.children);
            const id = typeof props.id === "string" ? props.id : slugify(text);
            return <h2 {...props} id={id} className="scroll-mt-24 pt-2 text-xl font-semibold tracking-tight" />;
          },
          h3: (props) => {
            const text = toPlainText(props.children);
            const id = typeof props.id === "string" ? props.id : slugify(text);
            return <h3 {...props} id={id} className="scroll-mt-24 pt-2 text-lg font-semibold tracking-tight" />;
          },
          p: (props) => <p {...props} className="text-sm leading-7 text-zinc-800" />,
          a: (props) => (
            <a
              {...props}
              className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-800"
              target={props.href?.startsWith("#") ? undefined : "_blank"}
              rel={props.href?.startsWith("#") ? undefined : "noreferrer"}
            />
          ),
          ul: (props) => <ul {...props} className="list-disc space-y-1 pl-5 text-zinc-800" />,
          ol: (props) => <ol {...props} className="list-decimal space-y-1 pl-5 text-zinc-800" />,
          li: (props) => <li {...props} className="text-sm leading-7" />,
          blockquote: (props) => (
            <blockquote {...props} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-800" />
          ),
          code: (props) => (
            <code {...props} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[12px] text-zinc-900" />
          ),
          pre: (props) => (
            <pre
              {...props}
              className="overflow-x-auto rounded-2xl bg-zinc-950 p-4 font-mono text-[12px] leading-5 text-zinc-50"
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table {...props} className="w-full border-collapse text-left text-sm" />
            </div>
          ),
          thead: (props) => <thead {...props} className="bg-zinc-50" />,
          th: (props) => <th {...props} className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700" />,
          td: (props) => <td {...props} className="border-b border-zinc-100 px-3 py-2 align-top text-sm text-zinc-800" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
