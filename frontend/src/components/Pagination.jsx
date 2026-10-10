// "Showing 1-12 of 40" with Previous / Next buttons.
// pagination = { page, limit, total, totalPages } as sent by the API
export default function Pagination({ pagination, onPage }) {
  if (!pagination) return null;
  const { page, limit, total, totalPages } = pagination;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="muted">
        Showing {from}–{to} of {total}
      </span>
      {totalPages > 1 && (
        <div className="pager">
          <button className="small secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            ← Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button className="small secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}