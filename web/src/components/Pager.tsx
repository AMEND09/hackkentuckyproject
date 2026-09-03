export function Pager({
  count,
  page,
  pageSize,
  onPage,
}: {
  count?: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return total ? <p className="text-sm text-slate">{total} records</p> : null;
  }
  return (
    <div className="flex items-center gap-3 text-sm pt-2">
      <button className="btn-secondary !py-2 !min-h-9" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-slate font-medium tabular-nums">
        Page {page} of {pages} · {total} records
      </span>
      <button className="btn-secondary !py-2 !min-h-9" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
