import { useMemo } from "react";
import DataTable from "@/Components/DataTable";

/**
 * StudentTable — desktop primary affordance for the redesigned Fees list.
 *
 * Five columns (per spec §14):
 *   #, Student, Classes, Unpaid, Paid, View
 *
 * The "View" column is the entry point into the Student Fee Sheet — clicking
 * either the button or the row opens the sheet (whole-row tap target; button
 * is the explicit affordance for keyboard / screen-reader users).
 *
 * Classes column derives a concise label from distinct `student_section_id`
 * values; the same algorithm the StudentCard uses so the two views are
 * visually consistent. The per-row computation is cheap (≤ ~20 fees per
 * student in practice) and runs through `useMemo`.
 *
 * Props:
 *   data   — student rows from the FeesController::index mapper
 *   onOpen — (student) => void, fired when a row's View is clicked
 *   loading — boolean, shows a loading row instead of empty
 */
export default function StudentTable({ data, onOpen, loading = false }) {
  const fmt = (n) => Number(n || 0).toLocaleString("en-PK");

  const columns = useMemo(
    () => [
      {
        header: "#",
        cell: ({ row }) => row.index + 1,
        meta: { cellClassName: "px-3 py-2 text-xs text-gray-500 w-10" },
      },
      {
        accessorKey: "student_name",
        header: "Student",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">
              {row.original.student_name}
            </div>
            {row.original.father_name ? (
              <div className="truncate text-xs text-gray-500">
                S/o {row.original.father_name}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        header: "Classes",
        cell: ({ row }) => (
          <ClassesCell student={row.original} />
        ),
      },
      {
        header: "Unpaid",
        cell: ({ row }) => {
          const amount = Number(row.original.unpaid_amount) || 0;
          const count = row.original.unpaid_count ?? 0;
          return (
            <div className="text-sm">
              <div
                className={`font-semibold ${amount > 0 ? "text-red-700" : "text-green-700"}`}
              >
                Rs {fmt(amount)}
              </div>
              <div className="text-xs text-gray-500">
                {amount > 0 ? `${count} unpaid` : "All paid"}
              </div>
            </div>
          );
        },
        meta: { cellClassName: "px-3 py-2 whitespace-nowrap" },
      },
      {
        header: "Paid",
        cell: ({ row }) => {
          const amount = Number(row.original.paid_amount) || 0;
          const count = row.original.paid_count ?? 0;
          return (
            <div className="text-sm">
              <div className="font-medium text-green-700">
                Rs {fmt(amount)}
              </div>
              <div className="text-xs text-gray-500">{count} paid</div>
            </div>
          );
        },
        meta: { cellClassName: "px-3 py-2 whitespace-nowrap" },
      },
      {
        header: "View",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => onOpen?.(row.original)}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 min-h-[40px] sm:min-h-[36px]"
          >
            View
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.25a.75.75 0 010 1.08l-4.25 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ),
        meta: { cellClassName: "px-3 py-2 whitespace-nowrap" },
      },
    ],
    [onOpen]
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={loading}
      emptyMessage="No fees match the current filters."
      containerClassName="bg-white border rounded-lg overflow-x-auto"
      tableClassName="min-w-[760px] text-sm"
      theadClassName="bg-gray-50 border-b"
      headerCellClassName="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
      cellClassName="px-3 py-2"
    />
  );
}

/**
 * ClassesCell — concise label for the per-student enrollment list, shared
 * with StudentCard. Lives in this file because it is currently used only
 * by the table; promoting it would require coordination with the card.
 */
function ClassesCell({ student }) {
  const enrollments = useMemo(() => {
    const map = new Map();
    for (const fee of student.fees ?? []) {
      const key = fee.student_section_id;
      if (key == null) continue;
      if (!map.has(key)) {
        map.set(key, {
          className: fee.class_name ?? null,
          sectionName: fee.section_name ?? null,
        });
      }
    }
    return [...map.values()];
  }, [student.fees]);

  const labelFor = (e) =>
    [e.className, e.sectionName].filter(Boolean).join(" · ") || "Class";

  if (enrollments.length === 0) {
    return <span className="text-xs text-gray-500">No classes</span>;
  }
  if (enrollments.length === 1) {
    return (
      <span className="text-sm text-gray-800">{labelFor(enrollments[0])}</span>
    );
  }
  if (enrollments.length === 2) {
    return (
      <div className="text-xs text-gray-700">
        <div>{labelFor(enrollments[0])}</div>
        <div className="text-gray-500">+ {labelFor(enrollments[1])}</div>
      </div>
    );
  }
  return (
    <div className="text-xs text-gray-700">
      <div>{labelFor(enrollments[0])}</div>
      <div className="text-gray-500">+ {enrollments.length - 1} more</div>
    </div>
  );
}