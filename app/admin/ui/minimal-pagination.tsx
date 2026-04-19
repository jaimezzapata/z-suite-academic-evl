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
      pageLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
      previousClassName=""
      previousLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
      nextClassName=""
      nextLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
      breakClassName=""
      breakLinkClassName="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-500"
      activeClassName=""
      activeLinkClassName="border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-900"
      disabledClassName="opacity-50"
      disabledLinkClassName="cursor-not-allowed hover:bg-white"
    />
  );
}

