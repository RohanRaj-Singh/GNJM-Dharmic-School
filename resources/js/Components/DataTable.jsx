import { Fragment } from "react";
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
            rows.map((row) => {
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
    </div>
  );
}
