import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import toast from "react-hot-toast";

export default function FeesIndex() {
  const { fees, filters } = usePage().props;


  /* -------------------------------------------------
   | Data (single source of truth)
   ------------------------------------------------- */
  const data = fees ?? [];

  /* -------------------------------------------------
   | Local state (UI only)
   ------------------------------------------------- */
  const [sorting, setSorting] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  /* -------------------------------------------------
   | Dynamic years (2025 → current year)
   ------------------------------------------------- */
  const START_YEAR = 2025;
  const CURRENT_YEAR = new Date().getFullYear();
  const years = Array.from(
    { length: CURRENT_YEAR - START_YEAR + 1 },
    (_, i) => START_YEAR + i
  );

  const statusPills = [
  { label: "All", value: "" },
  { label: "Paid", value: "paid" },
  { label: "Unpaid", value: "unpaid" },
];


  /* -------------------------------------------------
   | Load class & section options
   ------------------------------------------------- */
  useEffect(() => {
    fetch("/admin/classes/options")
      .then((r) => r.json())
      .then(setClasses);
  }, []);

  useEffect(() => {
    if (!filters?.class_id) {
      setSections([]);
      return;
    }

    fetch(`/admin/sections/options?class_id=${filters.class_id}`)
      .then((r) => r.json())
      .then(setSections);
  }, [filters?.class_id]);

  /* -------------------------------------------------
   | Actions
   ------------------------------------------------- */
  function collectFee(feeId) {
    router.post(route("admin.fees.collect", feeId), {}, {
      preserveScroll: true,
      onSuccess: () => toast.success("Fee collected"),
    });
  }

  function deCollectFee(feeId) {
    if (!confirm("Un-collect this fee?")) return;

    router.post(route("admin.fees.deCollect", feeId), {}, {
      preserveScroll: true,
      onSuccess: () => toast.success("Fee un-collected"),
    });
  }

  function deleteCustomFee(batchId) {
    if (!confirm("Delete this custom fee for all students?")) return;

    router.delete(route("admin.fees.custom.destroy", batchId), {
      preserveScroll: true,
      onSuccess: () => toast.success("Custom fee deleted"),
    });
  }

  /* -------------------------------------------------
   | Columns
   ------------------------------------------------- */
  const columns = useMemo(
    () => [
      { header: "#", cell: ({ row }) => row.index + 1 },
      { accessorKey: "student_name", header: "Student" },
      { accessorKey: "class_name", header: "Class" },
      { accessorKey: "section_name", header: "Section" },
      {
        header: "Fee",
        cell: ({ row }) =>
          row.original.type === "monthly"
            ? row.original.month
            : row.original.title,
      },
      {
        header: "Amount",
        cell: ({ row }) => `Rs ${row.original.amount}`,
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.is_paid ? (
            <span className="text-green-600 font-medium">✔ Paid</span>
          ) : (
            <span className="text-red-600 font-medium">Unpaid</span>
          ),
      },
      {
        header: "Action",
        cell: ({ row }) => {
          const fee = row.original;

          if (fee.is_paid) {
            return (
              <button
                onClick={() => deCollectFee(fee.id)}
                className="text-yellow-600 text-sm"
              >
                Un-collect
              </button>
            );
          }

          if (fee.source === "custom") {
            return (
              <div className="flex gap-2">
                <button
                  onClick={() => collectFee(fee.id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm"
                >
                  Collect
                </button>
                <button
                  onClick={() => deleteCustomFee(fee.batch_id)}
                  className="text-red-600 text-sm"
                >
                  Delete
                </button>
              </div>
            );
          }

          return (
            <button
              onClick={() => collectFee(fee.id)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm"
            >
              Collect
            </button>
          );
        },
      },
    ],
    []
  );

  /* -------------------------------------------------
   | Table
   ------------------------------------------------- */
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  /* -------------------------------------------------
   | Filter helper (server-side only)
   ------------------------------------------------- */
  function applyFilter(key, value) {
    router.get(
      route("admin.fees.index"),
      {
        ...filters,
        [key]: value,
        ...(key === "class_id" ? { section_id: "" } : {}),
      },
      {
        preserveState: false,
        replace: true,
      }
    );
  }

  /* -------------------------------------------------
   | Render
   ------------------------------------------------- */
  return (
    <AdminLayout title="Fees">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border px-3 py-2 rounded text-sm"
          value={filters?.year ?? ""}
          onChange={(e) => applyFilter("year", e.target.value)}
        >
          <option value="">Year: All</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          className="border px-3 py-2 rounded text-sm"
          value={filters?.class_id ?? ""}
          onChange={(e) => applyFilter("class_id", e.target.value)}
        >
          <option value="">Class: All</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          className="border px-3 py-2 rounded text-sm"
          value={filters?.section_id ?? ""}
          disabled={!filters?.class_id}
          onChange={(e) => applyFilter("section_id", e.target.value)}
        >
          <option value="">Section: All</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {/* Paid / Unpaid pills */}
<div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
  {statusPills.map((pill) => {
    const active = (filters?.status ?? "") === pill.value;

    return (
      <button
        key={pill.value || "all"}
        onClick={() => applyFilter("status", pill.value)}
        className={`px-3 py-1 text-sm rounded-md transition
          ${
            active
              ? "bg-white shadow text-blue-600 font-medium"
              : "text-gray-600 hover:text-black"
          }`}
      >
        {pill.label}
      </button>
    );
  })}
</div>


        <input
          className="border px-3 py-2 rounded text-sm w-64"
          placeholder="Search student…"
          defaultValue={filters?.search ?? ""}
          onChange={(e) => applyFilter("search", e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-[1000px] text-sm">
          <thead className="bg-gray-50 border-b">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 text-left">
                    {flexRender(
                      h.column.columnDef.header,
                      h.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
