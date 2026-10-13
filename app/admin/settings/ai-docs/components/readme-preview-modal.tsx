"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { MarkdownViewer } from "@/app/ui/markdown-viewer";

interface ReadmePreviewModalProps {
  open: boolean;
  onClose: () => void;
  markdown: string;
}

export function ReadmePreviewModal({
  open,
  onClose,
  markdown,
}: ReadmePreviewModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative flex h-full max-h-[800px] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-950">Vista previa del documento</h3>
                <p className="text-xs text-zinc-500">Así lo verá el estudiante en la plataforma.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-zinc-50/50 p-6">
              <div className="mx-auto max-w-none rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <MarkdownViewer markdown={markdown} />
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
