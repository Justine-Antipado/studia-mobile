import { useIsCompact } from '../hooks/useMediaQuery';
import EmptyState from './EmptyState';
import { Icon } from './Icon';

const EMPTY_SET = new Set();

/**
 * The one reusable list view: a real `<table>` above 720px, stacked
 * label/value cards below it (`useIsCompact`), same columns, same actions,
 * same selection and sort behavior either way.
 *
 * columns: [{ key, header, render(row), sortable, align, primary, hideCompact }]
 * `primary` marks the column used as each card's title in compact mode
 * (defaults to the first column). `hideCompact` drops a column from cards
 * entirely (use when it's redundant with the primary cell, e.g. an avatar).
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  rowLabel = (row) => String(rowKey(row)),
  sort,
  onSortChange,
  selectable = false,
  selectedIds = EMPTY_SET,
  onSelectedChange,
  renderActions,
  onRowClick,
  rowClassName,
  caption,
  emptyTitle = 'No results',
  emptyMessage = 'Nothing matches the current filters.',
  emptyAction,
}) {
  const compact = useIsCompact();
  const ids = rows.map(rowKey);
  const allSelected = selectable && ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someSelected = selectable && !allSelected && ids.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (!onSelectedChange) return;
    const next = new Set(selectedIds);
    ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
    onSelectedChange(next);
  };

  const toggleOne = (id) => {
    if (!onSelectedChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const requestSort = (key) => {
    if (!onSortChange) return;
    const order = sort?.key === key && sort.order === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, order });
  };

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  if (compact) {
    const primary = columns.find((c) => c.primary) ?? columns[0];
    const rest = columns.filter((c) => c !== primary && !c.hideCompact);
    return (
      <ul className="dt-cards">
        {rows.map((row) => {
          const id = rowKey(row);
          return (
            <li
              className={'dt-card' + (rowClassName ? ' ' + rowClassName(row) : '') + (onRowClick ? ' dt-clickable' : '')}
              key={id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="dt-card-head">
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(id)}
                    onChange={() => toggleOne(id)}
                    aria-label={`Select ${rowLabel(row)}`}
                  />
                )}
                <div className="dt-card-title">{primary.render ? primary.render(row) : row[primary.key]}</div>
              </div>
              <dl className="dt-card-body">
                {rest.map((c) => (
                  <div className="dt-card-row" key={c.key}>
                    <dt>{c.header}</dt>
                    <dd>{c.render ? c.render(row) : row[c.key]}</dd>
                  </div>
                ))}
              </dl>
              {renderActions && <div className="dt-card-actions">{renderActions(row)}</div>}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <table className="dt-table">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {selectable && (
            <th scope="col" className="dt-check">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => el && (el.indeterminate = someSelected)}
                onChange={toggleAll}
                aria-label="Select all visible rows"
              />
            </th>
          )}
          {columns.map((c) => {
            const sorted = sort?.key === c.key;
            const direction = sorted ? (sort.order === 'desc' ? 'descending' : 'ascending') : undefined;
            return (
              <th
                scope="col"
                key={c.key}
                className={c.align === 'right' ? 'dt-right' : ''}
                aria-sort={c.sortable ? direction ?? 'none' : undefined}
              >
                {c.sortable ? (
                  <button
                    type="button"
                    className="dt-sort"
                    onClick={() => requestSort(c.key)}
                    aria-label={`${c.header}, sort ${sorted && sort.order === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {c.header}
                    {sorted && (
                      <span className={`dt-sort-icon ${sort.order === 'desc' ? 'desc' : ''}`} aria-hidden="true">
                        <Icon.ChevronDown />
                      </span>
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            );
          })}
          {renderActions && (
            <th scope="col" className="dt-right">
              Actions
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const id = rowKey(row);
          return (
            <tr
              key={id}
              className={(rowClassName ? rowClassName(row) : '') + (onRowClick ? ' dt-clickable' : '')}
              onClick={
                onRowClick
                  ? (e) => {
                      // A click on a button or link inside the row is that control's, not the row's.
                      if (e.target.closest('button, a, input, label, [role="button"]')) return;
                      onRowClick(row);
                    }
                  : undefined
              }
            >
              {selectable && (
                <td className="dt-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(id)}
                    onChange={() => toggleOne(id)}
                    aria-label={`Select ${rowLabel(row)}`}
                  />
                </td>
              )}
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'dt-right' : ''}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
              {renderActions && <td className="dt-right">{renderActions(row)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
