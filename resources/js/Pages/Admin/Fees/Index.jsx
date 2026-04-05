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

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}-01`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function formatCollectionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function FeeActionCard({
  fee,
  isPaid,
  onCollect,
  onDeCollect,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded px-2 py-1.5 bg-white">
      <div className="truncate min-w-0">
        <div className="text-xs font-medium truncate">
          {fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title}
        </div>
        <div className="text-xs text-gray-500">Rs {fee.amount}</div>
        {isPaid && fee.paid_at ? (
          <div className="text-xs text-gray-500">
            Collected on {formatCollectionDate(fee.paid_at)}
          </div>
        ) : null}
      </div>

      {isPaid ? (
        <button
          type="button"
          onClick={() => onDeCollect(fee.id)}
          className="text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 self-start"
        >
          Un-collect
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onCollect(fee)}
          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0 self-start"
        >
          Collect
        </button>
      )}
    </div>
  );
}

function FeeGroupColumn({
  title,
  titleClassName,
  unpaidFees,
  paidFees,
  onCollect,
  onDeCollect,
}) {
  return (
    <div className="border rounded-lg p-2 sm:p-3 bg-white">
      <div className={`text-xs font-bold mb-2 uppercase tracking-wide ${titleClassName}`}>
        {title}
      </div>

      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">
          Unpaid Fees
        </div>
        {unpaidFees.length === 0 ? (
          <div className="text-xs text-gray-500">No unpaid fees.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {unpaidFees.map((fee) => (
              <FeeActionCard
                key={fee.id}
                fee={fee}
                isPaid={false}
                onCollect={onCollect}
                onDeCollect={onDeCollect}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-600 mb-2">
          Paid Fees
        </div>
        {paidFees.length === 0 ? (
          <div className="text-xs text-gray-500">No paid fees.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {paidFees.map((fee) => (
              <FeeActionCard
                key={fee.id}
                fee={fee}
                isPaid={true}
                onCollect={onCollect}
                onDeCollect={onDeCollect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CollectFeeModal({
  fee,
  collectionDate,
  onCollectionDateChange,
  onClose,
  onConfirm,
}) {
  if (!fee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">Collect Fee</h2>
          <p className="text-sm text-gray-500 mt-1">
            {fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title} • Rs {fee.amount}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Collection Date
            </label>
            <input
              type="date"
              value={collectionDate}
              onChange={(e) => onCollectionDateChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!collectionDate}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirm Collection
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeesIndex() {
  const { fees, filters } = usePage().props;

  const data = fees ?? [];
  const [sorting, setSorting] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [searchInput, setSearchInput] = useState(filters?.search ?? "");
  const [expandedId, setExpandedId] = useState(null);
  const [isGeneratingMonthlyFees, setIsGeneratingMonthlyFees] = useState(false);
  const [collectingFee, setCollectingFee] = useState(null);
  const [collectionDate, setCollectionDate] = useState(getTodayDateInput());

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

  const closeCollectModal = () => {
    setCollectingFee(null);
    setCollectionDate(getTodayDateInput());
  };

  const openCollectModal = (fee) => {
    setCollectingFee(fee);
    setCollectionDate(getTodayDateInput());
  };

  const confirmCollectFee = () => {
    if (!collectingFee || !collectionDate) return;

    router.post(
      route("admin.fees.collect", collectingFee.id),
      { collection_date: collectionDate },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
          toast.success("Fee collected");
          closeCollectModal();
        },
      }
    );
  };

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
                type="button"
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

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

        <input
          type="month"
          className="border px-3 py-2 rounded text-sm"
          value={filters?.month ?? ""}
          onChange={(e) => applyFilter("month", e.target.value)}
        />

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

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {statusPills.map((pill) => {
            const active = (filters?.status ?? "") === pill.value;

            return (
              <button
                key={pill.value || "all"}
                type="button"
                onClick={() => applyFilter("status", pill.value)}
                className={`px-3 py-1 text-sm rounded-md transition ${
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
          type="date"
          className="border px-3 py-2 rounded text-sm"
          value={filters?.paid_from ?? ""}
          onChange={(e) => applyFilter("paid_from", e.target.value)}
        />

        <input
          type="date"
          className="border px-3 py-2 rounded text-sm"
          value={filters?.paid_to ?? ""}
          onChange={(e) => applyFilter("paid_to", e.target.value)}
        />

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

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-[1000px] text-sm">
          <thead className="bg-gray-50 border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-left">
                    {flexRender(header.column.columnDef.header, header.getContext())}
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

              const sortByMonthDesc = (a, b) => {
                if (a.type === "monthly" && b.type === "monthly") {
                  return (b.month ?? "").localeCompare(a.month ?? "");
                }
                if (a.type === "monthly") return -1;
                if (b.type === "monthly") return 1;
                return 0;
              };

              const gurmukhiFees = fees.filter((fee) => (fee.class_type ?? "gurmukhi") !== "kirtan");
              const kirtanFees = fees.filter((fee) => fee.class_type === "kirtan");

              const gurmukhiUnpaid = gurmukhiFees.filter((fee) => !fee.is_paid).sort(sortByMonthDesc);
              const gurmukhiPaid = gurmukhiFees.filter((fee) => fee.is_paid).sort(sortByMonthDesc);
              const kirtanUnpaid = kirtanFees.filter((fee) => !fee.is_paid).sort(sortByMonthDesc);
              const kirtanPaid = kirtanFees.filter((fee) => fee.is_paid).sort(sortByMonthDesc);

              return (
                <Fragment key={row.id}>
                  <tr className="border-b">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>

                  {isOpen && (
                    <tr className="border-b bg-gray-50">
                      <td colSpan={8} className="p-0">
                        <div className="overflow-x-auto min-w-full px-2 py-3">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <FeeGroupColumn
                              title="Gurmukhi"
                              titleClassName="text-blue-700"
                              unpaidFees={gurmukhiUnpaid}
                              paidFees={gurmukhiPaid}
                              onCollect={openCollectModal}
                              onDeCollect={deCollectFee}
                            />

                            <FeeGroupColumn
                              title="Kirtan"
                              titleClassName="text-purple-700"
                              unpaidFees={kirtanUnpaid}
                              paidFees={kirtanPaid}
                              onCollect={openCollectModal}
                              onDeCollect={deCollectFee}
                            />
                          </div>
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

      <CollectFeeModal
        fee={collectingFee}
        collectionDate={collectionDate}
        onCollectionDateChange={setCollectionDate}
        onClose={closeCollectModal}
        onConfirm={confirmCollectFee}
      />
    </AdminLayout>
  );
}
