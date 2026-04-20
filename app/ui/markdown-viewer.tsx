"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Info, Copy, Check } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100"
      title="Copiar código"
      aria-label="Copiar código"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export const MarkdownViewer = memo(function MarkdownViewer({
  markdown,
  idPrefix,
}: {
  markdown: string;
  idPrefix?: string;
}) {
  const prefix = useMemo(() => (idPrefix ? idPrefix.trim() : ""), [idPrefix]);
  const withPrefix = (id: string) => (prefix ? `${prefix}-${id}` : id);

  return (
    <div className="docs-markdown space-y-6 text-[15px] leading-relaxed text-zinc-800 antialiased">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => {
            const text = toPlainText(props.children);
            const id = typeof props.id === "string" ? props.id : withPrefix(slugify(text));
            return (
              <h1
                {...props}
                id={id}
                className="scroll-mt-24 border-b border-zinc-200 pb-4 pt-8 text-4xl font-extrabold tracking-tight text-zinc-900 first:pt-0"
              />
            );
          },
          h2: (props) => {
            const text = toPlainText(props.children);
            const id = typeof props.id === "string" ? props.id : withPrefix(slugify(text));
            return (
              <h2
                {...props}
                id={id}
                className="scroll-mt-24 border-b border-zinc-100 pb-2 pt-8 text-2xl font-bold tracking-tight text-zinc-900"
              />
            );
          },
          h3: (props) => {
            const text = toPlainText(props.children);
            const id = typeof props.id === "string" ? props.id : withPrefix(slugify(text));
            return (
              <h3
                {...props}
                id={id}
                className="scroll-mt-24 pt-6 text-xl font-semibold tracking-tight text-zinc-900"
              />
            );
          },
          p: (props) => <p {...props} className="text-[15px] leading-8 text-zinc-700" />,
          a: (props) => {
            const href = typeof props.href === "string" ? props.href : "";
            const isHash = href.startsWith("#");
            const nextHref =
              isHash && prefix && !href.startsWith(`#${prefix}-`) ? `#${prefix}-${href.slice(1)}` : href;
            return (
              <a
                {...props}
                href={nextHref || props.href}
              className="font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-4 transition-colors hover:text-indigo-800 hover:decoration-indigo-400"
                target={href?.startsWith("#") ? undefined : "_blank"}
                rel={href?.startsWith("#") ? undefined : "noreferrer"}
              />
            );
          },
          ul: (props) => <ul {...props} className="list-disc space-y-2 pl-6 text-zinc-700" />,
          ol: (props) => <ol {...props} className="list-decimal space-y-2 pl-6 text-zinc-700" />,
          li: (props) => <li {...props} className="text-[15px] leading-relaxed marker:text-zinc-400" />,
          blockquote: ({ node, ...props }) => (
            <motion.blockquote
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative my-6 flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-indigo-900 shadow-sm"
            >
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
              <div className="flex-1 space-y-2 text-[14.5px] italic leading-relaxed">
                {props.children}
              </div>
            </motion.blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = match != null || (className && className.includes("language-"));
            
            if (!isBlock) {
              return (
                <code
                  {...props}
                  className="rounded-md border border-zinc-200 bg-zinc-100/80 px-[5px] py-[2px] font-mono text-[13px] font-medium text-indigo-600"
                >
                  {children}
                </code>
              );
            }

            const language = match ? match[1] : "text";
            const codeString = String(children).replace(/\n$/, "");

            return (
              <div className="group relative my-6 overflow-hidden rounded-2xl border border-zinc-800 bg-[#1E1E1E] shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
                  <span className="font-mono text-xs font-semibold uppercase text-zinc-400">
                    {language}
                  </span>
                  <CopyButton text={codeString} />
                </div>
                <SyntaxHighlighter
                  {...(props as any)}
                  style={vscDarkPlus}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "13px",
                    lineHeight: "1.6",
                  }}
                  codeTagProps={{
                    style: { fontFamily: "var(--font-mono)", fontSize: "13px" },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          pre: (props) => <>{props.children}</>, // Evitamos el pre doble porque SyntaxHighlighter ya usa div/pre
          table: (props) => (
            <div className="my-8 w-full overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <table {...props} className="w-full border-collapse text-left text-sm" />
            </div>
          ),
          thead: (props) => <thead {...props} className="bg-zinc-50/80 text-zinc-900" />,
          th: (props) => (
            <th {...props} className="border-b border-zinc-200 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-600" />
          ),
          tbody: (props) => <tbody {...props} className="divide-y divide-zinc-100 bg-white" />,
          td: (props) => (
            <td {...props} className="px-4 py-3 align-top text-sm leading-relaxed text-zinc-700 transition-colors hover:bg-zinc-50/50" />
          ),
          hr: (props) => <hr {...props} className="my-10 border-t-2 border-zinc-100" />,
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} className="my-8 rounded-2xl border border-zinc-200 shadow-sm" alt={props.alt || "Imagen"} />
          )
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
