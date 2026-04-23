"use client";

import ReactPaginate from "react-paginate";

type MinimalPaginationProps = {
  pageCount: number;
  page: number;
  onChange: (nextPage: number) => void;
};

export function MinimalPagination({ pageCount, page, onChange }: MinimalPaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <ReactPaginate
      previousLabel="‹"
      nextLabel="›"
      breakLabel="…"
      pageCount={pageCount}
      forcePage={page}
      onPageChange={(e) => onChange(e.selected)}
      containerClassName="mt-4 flex flex-wrap items-center justify-center gap-1"
      pageClassName=""
      pageLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground/70 hover:bg-muted"
      previousClassName=""
      previousLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground/70 hover:bg-muted"
      nextClassName=""
      nextLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground/70 hover:bg-muted"
      breakClassName=""
      breakLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-foreground/45"
      activeClassName=""
      activeLinkClassName="border-primary bg-primary text-primary-foreground hover:bg-primary"
      disabledClassName="opacity-50"
      disabledLinkClassName="cursor-not-allowed hover:bg-surface"
    />
  );
}

