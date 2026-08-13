import { Fragment, useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

const SORT_INDICATOR = { asc: " ↑", desc: " ↓" };

/**
 * Generic tanstack-backed table shared across list pages (Sprint 4.1).
 *
 * Pages supply tanstack column defs plus opt-in feature flags, so a page's
 * current output is preserved exactly:
 *  - `sortable`  → clickable headers with ↑/↓ sort indicators
 *  - `globalFilter` / `onGlobalFilterChange` / `globalFilterFn` → inline search
 *  - `emptyMessage` → renders an empty-state row when there are no rows
 *  - `loading` → renders a loading row instead of the empty state
 *  - `renderExpandedRow` + `expandedId` → renders an expandable detail row
 *  - `externalSort` = `{ key, dir, onSort }` → externally-controlled sort.
 *    Columns opt in with `column.columnDef.meta.sortKey`; the header becomes
 *    clickable (calls `onSort(sortKey)`) and renders a ⇅/↑/↓ indicator from
 *    the external `{ key, dir }`. Unlike `sortable`, no tanstack sort model is
 *    wired — the page owns the sorted data.
 *  - Per-column `meta.headerClassName` / `meta.cellClassName` override the
 *    shared header/cell classes for that column only.
 *  - `pagination` → opt-in client-side paging (Sprint 4.3). Pass an object to
 *    configure, e.g. `{ pageSize: 10 }` (default 10). The full filtered/sorted
 *    row set is sliced per page and a slim Prev/Next + "Showing X–Y of Z"
 *    footer renders only when there is more than one page. `row.index` remains
 *    the position within the full set, so `#` columns keep numbering across
 *    pages and inline `updateCell(row.index, …)` editors stay correct.
 *    `pagerClassName` (default "") is appended to the footer for pages whose
 *    container scrolls — e.g. `"sticky bottom-0 bg-white"` pins it above the
 *    fold inside a `max-h-*` container.
 *
 * Class names are passed per page so no visual change occurs on migration.
 */
export default function DataTable({
  data = [],
  columns,
  sortable = false,
  globalFilter,
  onGlobalFilterChange,
  globalFilterFn,
  getRowId,
  emptyMessage,
  loading = false,
  loadingMessage = "Loading…",
  renderExpandedRow,
  expandedId,
  externalSort,
  pagination,
  pagerClassName = "",
  containerClassName = "bg-white border rounded-lg overflow-x-auto",
  tableClassName = "min-w-full text-sm",
  theadClassName,
  tbodyClassName,
  headerRowClassName,
  headerCellClassName = "px-3 py-2 text-left",
  bodyRowClassName = "border-b",
  cellClassName = "px-3 py-2",
  expandedRowClassName = "border-b bg-gray-50",
  expandedCellClassName = "p-0",
  emptyClassName = "px-4 py-12 text-center text-sm text-gray-400",
}) {
  // Global search is opt-in: only wire the filter model when the page hands
  // down a globalFilter value.
  const filtering = globalFilter !== undefined;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable ? { getSortedRowModel: getSortedRowModel() } : {}),
    ...(filtering
      ? {
          getFilteredRowModel: getFilteredRowModel(),
          state: { globalFilter },
          onGlobalFilterChange,
          ...(globalFilterFn ? { globalFilterFn } : {}),
        }
      : {}),
    ...(getRowId ? { getRowId } : {}),
  });

  const rows = table.getRowModel().rows;
  const colSpan = Math.max(1, columns?.length ?? 0);

  // Client-side paging is opt-in (Sprint 4.3). We page over the full
  // filtered/sorted row model, keeping row.index as the full-set position so
  // `#` numbering and inline `updateCell(row.index, …)` editors stay correct
  // across pages. Off by default, so existing pages are byte-for-byte unchanged.
  const paged = pagination !== undefined;
  const pageSize = paged ? (pagination?.pageSize ?? 10) : 0;
  const [pageIndex, setPageIndex] = useState(0);
  const total = rows.length;
  const pageCount = paged ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = paged ? Math.min(pageIndex, pageCount - 1) : 0;
  const start = paged ? safePage * pageSize : 0;
  const pageRows = paged ? rows.slice(start, start + pageSize) : rows;

  // If the dataset shrinks (search/filter/edit) past the current page, fall
  // back to the last valid page instead of rendering an empty page.
  useEffect(() => {
    if (paged && pageIndex > pageCount - 1) {
      setPageIndex(Math.max(0, pageCount - 1));
    }
  }, [paged, pageIndex, pageCount]);

  // External sort is opt-in: the page owns the sorted data and hands down
  // { key, dir, onSort }. Columns opt in per-header via meta.sortKey.
  const useExternalSort = externalSort !== undefined;

  return (
    <div className={containerClassName}>
      <table className={tableClassName}>
        <thead className={theadClassName}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className={headerRowClassName}>
              {headerGroup.headers.map((header) => {
                const sortKey = useExternalSort
                  ? header.column.columnDef.meta?.sortKey
                  : undefined;
                const externallySortable = sortKey !== undefined;
                const isActiveSort =
                  externallySortable && externalSort.key === sortKey;

                return (
                  <th
                    key={header.id}
                    className={`${
                      header.column.columnDef.meta?.headerClassName ??
                      headerCellClassName
                    }${sortable ? " cursor-pointer" : ""}`}
                    onClick={
                      sortable
                        ? header.column.getToggleSortingHandler()
                        : externallySortable
                          ? () => externalSort.onSort(sortKey)
                          : undefined
                    }
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortable && (SORT_INDICATOR[header.column.getIsSorted()] ?? "")}
                    {externallySortable &&
                      (isActiveSort ? (
                        <span className="ml-1 text-gray-600">
                          {externalSort.dir === "asc" ? "↑" : "↓"}
                        </span>
                      ) : (
                        <span className="ml-1 text-gray-300">⇅</span>
                      ))}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className={tbodyClassName}>
          {loading ? (
            <tr>
              <td colSpan={colSpan} className={emptyClassName}>
                {loadingMessage}
              </td>
            </tr>
          ) : rows.length === 0 && emptyMessage ? (
            <tr>
              <td colSpan={colSpan} className={emptyClassName}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            pageRows.map((row) => {
              const isExpanded =
                renderExpandedRow &&
                expandedId !== undefined &&
                String(expandedId) === String(row.id);

              const rowClass =
                typeof bodyRowClassName === "function"
                  ? bodyRowClassName(row)
                  : bodyRowClassName;

              return (
                <Fragment key={row.id}>
                  <tr className={rowClass}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          cell.column.columnDef.meta?.cellClassName ??
                          cellClassName
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className={expandedRowClassName}>
                      <td colSpan={colSpan} className={expandedCellClassName}>
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>

      {paged && pageCount > 1 && (
        <div
          className={`flex items-center justify-between px-3 py-2 border-t text-sm ${pagerClassName}`}
        >
          <span className="text-xs text-gray-500">
            Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-2 py-1 border rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="px-2 py-1 border rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
