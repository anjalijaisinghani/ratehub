// columns: [{ key: 'name', label: 'Name', sortable: true, render: (row) => ... }]
// sortBy / order / onSort come from the page that owns the data
export default function SortableTable({
  columns,
  rows,
  sortBy,
  order,
  onSort,
  onRowClick,
  emptyText = 'No records found',
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) =>
              c.sortable === false ? (
                <th key={c.key}>{c.label}</th>
              ) : (
                <th key={c.key} className="sortable" onClick={() => onSort(c.key)}>
                  {c.label}
                  {sortBy === c.key && (order === 'asc' ? ' ▲' : ' ▼')}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="muted">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? 'clickable' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}