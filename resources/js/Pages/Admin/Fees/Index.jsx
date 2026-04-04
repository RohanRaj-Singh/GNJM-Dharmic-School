import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  const [searchInput, setSearchInput] = useState(filters?.search ?? "");
  const [expandedId, setExpandedId] = useState(null);
  const [isGeneratingMonthlyFees, setIsGeneratingMonthlyFees] = useState(false);

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

  useEffect(() => {
    setSearchInput(filters?.search ?? "");
  }, [filters?.search]);

  /* -------------------------------------------------
   | Actions
   ------------------------------------------------- */
  function collectFee(feeId) {
    router.post(route("admin.fees.collect", feeId), {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => toast.success("Fee collected"),
    });
  }

  function deCollectFee(feeId) {
    if (!confirm("Un-collect this fee?")) return;
    router.post(route("admin.fees.deCollect", feeId), {}, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => toast.success("Fee un-collected"),
    });
  }

  function generateMonthlyFees() {
    if (
      !confirm(
        "Generate monthly fees now? Existing fees for the same month will not be duplicated."
      )
    ) {
      return;
    }

    setIsGeneratingMonthlyFees(true);
    router.post(
      route("admin.fees.generate-monthly"),
      {},
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => toast.success("Monthly fees generated"),
        onFinish: () => setIsGeneratingMonthlyFees(false),
      }
    );
  }

  function formatMonthLabel(value) {
    if (!value) return "";
    const date = new Date(`${value}-01`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
  }

  /* -------------------------------------------------
   | Columns
   ------------------------------------------------- */
  const columns = useMemo(
    () => [
      { header: "#", cell: ({ row }) => row.index + 1 },
      { accessorKey: "student_name", header: "Student" },
      { accessorKey: "father_name", header: "Father Name" },
      { accessorKey: "section_name", header: "Section" },
      {
        header: "Unpaid",
        cell: ({ row }) => (
          <div className="text-sm">
            <div className="font-medium text-red-600">
              Rs {row.original.unpaid_amount}
            </div>
            <div className="text-xs text-gray-500">
              {row.original.unpaid_count} fees
            </div>
          </div>
        ),
      },
      {
        header: "Paid",
        cell: ({ row }) => (
          <div className="text-sm">
            <div className="font-medium text-green-600">
              Rs {row.original.paid_amount}
            </div>
            <div className="text-xs text-gray-500">
              {row.original.paid_count} fees
            </div>
          </div>
        ),
      },
      {
        header: "Total",
        cell: ({ row }) => `Rs ${row.original.total_amount}`,
      },
      {
        header: "Details",
        cell: ({ row }) => {
          const item = row.original;
          const unpaidCount = item.unpaid_count ?? 0;

          const isOpen = expandedId === row.id;

          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedId(isOpen ? null : row.id)}
                className="text-blue-600 text-sm"
              >
                {isOpen ? "Hide" : "View"}
              </button>
              <span className="text-xs text-gray-500">
                {unpaidCount === 0 ? "All paid" : `${unpaidCount} unpaid`}
              </span>
            </div>
          );
        },
      },
    ],
    [expandedId]
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
  const applyFilter = useCallback((key, value, options = {}) => {
    router.get(
      route("admin.fees.index"),
      {
        ...filters,
        [key]: value,
        ...(key === "class_id" ? { section_id: "" } : {}),
      },
      {
        preserveState: options.preserveState ?? false,
        replace: true,
      }
    );
  }, [filters]);

  const applySearchLive = useCallback(
    (value) => {
      if ((filters?.search ?? "") !== value) {
        applyFilter("search", value, { preserveState: true });
      }
    },
    [applyFilter, filters?.search]
  );

  /* -------------------------------------------------
   | Render
   ------------------------------------------------- */
  return (
    <AdminLayout title="Fees">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Fees</h1>
          <p className="text-sm text-gray-500">
            If auto-generation misses a run, you can manually generate this month&apos;s fees here.
          </p>
        </div>
        <button
          type="button"
          onClick={generateMonthlyFees}
          disabled={isGeneratingMonthlyFees}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGeneratingMonthlyFees ? "Generating..." : "Generate Monthly Fees"}
        </button>
      </div>

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
          placeholder="Search student..."
          value={searchInput}
          onChange={(e) => {
            const value = e.target.value;
            setSearchInput(value);
            applySearchLive(value);
          }}
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
            {table.getRowModel().rows.map((row) => {
              const item = row.original;
              const isOpen = expandedId === row.id;
              const fees = item.fees ?? [];

              return (
                <Fragment key={row.id}>
                  <tr className="border-b">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="border-b bg-gray-50">
                      <td colSpan={8} className="p-0">
                        {/* Group by Gurmukhi/Kirtan, then by Paid/Unpaid */}
                        <div className="overflow-x-auto min-w-full px-2 py-3">
                        {(() => {
                          const sortByMonthDesc = (a, b) => {
                            if (a.type === 'monthly' && b.type === 'monthly') {
                              return (b.month ?? '').localeCompare(a.month ?? '');
                            }
                            if (a.type === 'monthly') return -1;
                            if (b.type === 'monthly') return 1;
                            return 0;
                          };

                          // Separate fees by class type (Gurmukhi vs Kirtan)
                          const gurmukhiFees = fees.filter((f) => (f.class_type ?? 'gurmukhi') !== 'kirtan');
                          const kirtanFees = fees.filter((f) => f.class_type === 'kirtan');

                          const gurmukhiUnpaid = gurmukhiFees.filter((f) => !f.is_paid).sort(sortByMonthDesc);
                          const gurmukhiPaid = gurmukhiFees.filter((f) => f.is_paid).sort(sortByMonthDesc);
                          const kirtanUnpaid = kirtanFees.filter((f) => !f.is_paid).sort(sortByMonthDesc);
                          const kirtanPaid = kirtanFees.filter((f) => f.is_paid).sort(sortByMonthDesc);

                          return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {/* Gurmukhi Column */}
                              <div className="border rounded-lg p-2 sm:p-3 bg-white">
                                <div className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">
                                  Gurmukhi
                                </div>
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-gray-600 mb-2">
                                    Unpaid Fees
                                  </div>
                                  {gurmukhiUnpaid.length === 0 ? (
                                    <div className="text-xs text-gray-500">No unpaid fees.</div>
                                  ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                      {gurmukhiUnpaid.map((fee) => (
                                        <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded px-2 py-1.5 bg-white">
                                          <div className="truncate min-w-0">
                                            <div className="text-xs font-medium truncate">
                                              {fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title}
                                            </div>
                                            <div className="text-xs text-gray-500">Rs {fee.amount}</div>
                                          </div>
                                          <button onClick={() => collectFee(fee.id)} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 self-start">
                                            Collect
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 mb-2">Paid Fees (Un-collect)</div>
                                  {gurmukhiPaid.length === 0 ? (
                                    <div className="text-xs text-gray-500">No paid fees.</div>
                                  ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                      {gurmukhiPaid.map((fee) => (
                                        <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded px-2 py-1.5 bg-white">
                                          <div className="truncate min-w-0">
                                            <div className="text-xs font-medium truncate">
                                              {fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title}
                                            </div>
                                            <div className="text-xs text-gray-500">Rs {fee.amount}</div>
                                          </div>
                                          <button onClick={() => deCollectFee(fee.id)} className="text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 self-start">
                                            Un-collect
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Kirtan Column */}
                              <div className="border rounded-lg p-2 sm:p-3 bg-white">
                                <div className="text-xs font-bold text-purple-700 mb-2 uppercase tracking-wide">
                                  Kirtan
                                </div>
                                <div className="mb-3">
                                  <div className="text-xs font-semibold text-gray-600 mb-2">
                                    Unpaid Fees
                                  </div>
                                  {kirtanUnpaid.length === 0 ? (
                                    <div className="text-xs text-gray-500">No unpaid fees.</div>
                                  ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                      {kirtanUnpaid.map((fee) => (
                                        <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded px-2 py-1.5 bg-white">
                                          <div className="truncate min-w-0">
                                            <div className="text-xs font-medium truncate">
                                              {fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title}
                                            </div>
                                            <div className="text-xs text-gray-500">Rs {fee.amount}</div>
                                          </div>
                                          <button onClick={() => collectFee(fee.id)} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 self-start">
                                            Collect
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-gray-600 mb-2">Paid Fees (Un-collect)</div>
                                  {kirtanPaid.length === 0 ? (
                                    <div className="text-xs text-gray-500">No paid fees.</div>
                                  ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                      {kirtanPaid.map((fee) => (
                                        <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded px-2 py-1.5 bg-white">
                                          <div className="truncate min-w-0">
                                            <div className="text-xs font-medium truncate">
                                              {fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title}
                                            </div>
                                            <div className="text-xs text-gray-500">Rs {fee.amount}</div>
                                          </div>
                                          <button onClick={() => deCollectFee(fee.id)} className="text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 self-start">
                                            Un-collect
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
