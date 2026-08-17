import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "@/Components/DataTable";
import toast from "react-hot-toast";
import { generateMonthOptions } from "@/utils/helper";
import { divisionMeta } from "@/utils/divisionType";
import FilterSection from "./components/FilterSection";
import FeeActionCard from "./components/FeeActionCard";
import FeeGroupColumn from "./components/FeeGroupColumn";
import CollectFeeModal from "./components/CollectFeeModal";

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getOrderedRange(startValue, endValue) {
  if (!startValue || !endValue) {
    return { startValue, endValue, swapped: false };
  }

  if (startValue <= endValue) {
    return { startValue, endValue, swapped: false };
  }

  return {
    startValue: endValue,
    endValue: startValue,
    swapped: true,
  };
}


export default function FeesIndex() {
  const { fees, filters } = usePage().props;

  const data = fees ?? [];
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [searchInput, setSearchInput] = useState(filters?.search ?? "");
  const [expandedId, setExpandedId] = useState(null);
  const [isGeneratingMonthlyFees, setIsGeneratingMonthlyFees] = useState(false);
  const [collectingFee, setCollectingFee] = useState(null);
  const [collectionDate, setCollectionDate] = useState(getTodayDateInput());
  const [monthFilter, setMonthFilter] = useState(filters?.month ?? "");
  const [monthFromFilter, setMonthFromFilter] = useState(filters?.month_from ?? "");
  const [monthToFilter, setMonthToFilter] = useState(filters?.month_to ?? "");
  const [paidFromFilter, setPaidFromFilter] = useState(filters?.paid_from ?? "");
  const [paidToFilter, setPaidToFilter] = useState(filters?.paid_to ?? "");
  const [openSections, setOpenSections] = useState(() => ({
    basics: true,
    billingMonth: Boolean(filters?.month || filters?.month_from || filters?.month_to),
    collectionDate: Boolean(filters?.paid_from || filters?.paid_to),
    search: Boolean(filters?.search),
  }));

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

  const monthOptions = useMemo(() => {
    const selectedYear = Number(filters?.year) || CURRENT_YEAR;
    return generateMonthOptions(selectedYear);
  }, [CURRENT_YEAR, filters?.year]);

  const activeFilterCount = useMemo(() => {
    return [
      filters?.year,
      filters?.class_id,
      filters?.section_id,
      filters?.search,
      filters?.status,
      filters?.month,
      filters?.month_from,
      filters?.month_to,
      filters?.paid_from,
      filters?.paid_to,
    ].filter((value) => value !== undefined && value !== null && value !== "").length;
  }, [
    filters?.class_id,
    filters?.month,
    filters?.month_from,
    filters?.month_to,
    filters?.paid_from,
    filters?.paid_to,
    filters?.search,
    filters?.section_id,
    filters?.status,
    filters?.year,
  ]);

  // Client-side summary tiles (Phase 2 / Change C). Computed from the
  // already-fetched `data`; no extra server round-trip. Recomputes only
  // when the rows themselves change.
  const summary = useMemo(() => {
    let totalUnpaid = 0;
    let totalPaid = 0;
    for (const row of data) {
      totalUnpaid += Number(row.unpaid_amount) || 0;
      totalPaid += Number(row.paid_amount) || 0;
    }
    return { totalUnpaid, totalPaid, studentCount: data.length };
  }, [data]);

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

  useEffect(() => {
    setMonthFilter(filters?.month ?? "");
    setMonthFromFilter(filters?.month_from ?? "");
    setMonthToFilter(filters?.month_to ?? "");
    setPaidFromFilter(filters?.paid_from ?? "");
    setPaidToFilter(filters?.paid_to ?? "");
  }, [
    filters?.month,
    filters?.month_from,
    filters?.month_to,
    filters?.paid_from,
    filters?.paid_to,
  ]);

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

  const applyFilters = useCallback((nextFilters, options = {}) => {
    router.get(
      route("admin.fees.index"),
      {
        ...filters,
        ...nextFilters,
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

  const applyMonthFilters = () => {
    const normalizedExactMonth = monthFilter;
    const normalizedMonthRange = getOrderedRange(monthFromFilter, monthToFilter);

    applyFilters(
      {
        month: normalizedExactMonth,
        month_from: normalizedExactMonth ? "" : normalizedMonthRange.startValue,
        month_to: normalizedExactMonth ? "" : normalizedMonthRange.endValue,
      },
      { preserveState: true }
    );
  };

  const applyCollectionRangeFilters = () => {
    const normalizedCollectionRange = getOrderedRange(paidFromFilter, paidToFilter);

    applyFilters(
      {
        paid_from: normalizedCollectionRange.startValue,
        paid_to: normalizedCollectionRange.endValue,
      },
      { preserveState: true }
    );
  };

  const resetFilters = () => {
    setSearchInput("");
    setMonthFilter("");
    setMonthFromFilter("");
    setMonthToFilter("");
    setPaidFromFilter("");
    setPaidToFilter("");

    router.get(
      route("admin.fees.index"),
      {},
      {
        preserveState: false,
        replace: true,
      }
    );
  };

  const useCurrentMonth = () => {
    const currentMonth = `${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    setMonthFilter(currentMonth);
    setMonthFromFilter("");
    setMonthToFilter("");

    applyFilters(
      {
        month: currentMonth,
        month_from: "",
        month_to: "",
      },
      { preserveState: true }
    );
  };

  const normalizedMonthRange = getOrderedRange(monthFromFilter, monthToFilter);
  const normalizedCollectionRange = getOrderedRange(paidFromFilter, paidToFilter);
  const hasMonthRangeValues = monthFromFilter || monthToFilter;
  const hasCollectionRangeValues = paidFromFilter || paidToFilter;
  const hasBasicFilters = Boolean(
    filters?.year || filters?.class_id || filters?.section_id || filters?.status
  );

  const toggleSection = (key) => {
    setOpenSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

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
                className="text-blue-600 text-sm px-2 py-1 min-h-[40px] sm:min-h-[36px] inline-flex items-center"
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

  function renderExpandedRow(row) {
    const item = row.original;
    const fees = item.fees ?? [];

    const sortByMonthDesc = (a, b) => {
      if (a.type === "monthly" && b.type === "monthly") {
        return (b.month ?? "").localeCompare(a.month ?? "");
      }
      if (a.type === "monthly") return -1;
      if (b.type === "monthly") return 1;
      return 0;
    };

    // Map-over-divisions (Stage B): one section per distinct division across
    // the student's fees. Each fee already carries its resolved division from
    // the backend; a third class gets its own column instead of collapsing
    // into the Gurmukhi one.
    const divisions = [...new Set(fees.map((fee) => fee.class_type).filter(Boolean))].sort();

    return (
      <div className="overflow-x-auto min-w-full px-2 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {divisions.map((divisionKey) => {
            const divFees = fees.filter((fee) => fee.class_type === divisionKey);
            const divUnpaid = divFees.filter((fee) => !fee.is_paid).sort(sortByMonthDesc);
            const divPaid = divFees.filter((fee) => fee.is_paid).sort(sortByMonthDesc);

            if (divUnpaid.length + divPaid.length === 0) return null;

            const meta = divisionMeta(divisionKey);
            return (
              <FeeGroupColumn
                key={divisionKey}
                title={meta.title}
                titleClassName={meta.text}
                unpaidFees={divUnpaid}
                paidFees={divPaid}
                onCollect={openCollectModal}
                onDeCollect={deCollectFee}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="Fees">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-gray-800">Fees</h1>
        <button
          type="button"
          onClick={generateMonthlyFees}
          disabled={isGeneratingMonthlyFees}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 min-h-[40px] sm:min-h-[36px]"
        >
          {isGeneratingMonthlyFees ? "Generating..." : "Generate Monthly Fees"}
        </button>
      </div>

      <div className="mb-4 rounded-xl border bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-800">Filters</h2>
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {activeFilterCount} active
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Use an exact month for one billing month, or a month range to inspect pending fees across several months.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useCurrentMonth}
              className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[40px] sm:min-h-[36px]"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[40px] sm:min-h-[36px]"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <FilterSection
            title="Basic Filters"
            description="Use these first to narrow the list by session, payment state, and class."
            isOpen={openSections.basics}
            onToggle={() => toggleSection("basics")}
            badge={hasBasicFilters ? "In use" : null}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Year
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={filters?.year ?? ""}
                  onChange={(e) => applyFilter("year", e.target.value)}
                >
                  <option value="">All Years</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Status
                </label>
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                  {statusPills.map((pill) => {
                    const active = (filters?.status ?? "") === pill.value;

                    return (
                      <button
                        key={pill.value || "all"}
                        type="button"
                        onClick={() => applyFilter("status", pill.value)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                          active
                            ? "bg-white font-medium text-blue-600 shadow"
                            : "text-gray-600 hover:text-black"
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Collection-date filters work best when status is set to paid or all.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Class
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={filters?.class_id ?? ""}
                  onChange={(e) => applyFilter("class_id", e.target.value)}
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Section
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  value={filters?.section_id ?? ""}
                  disabled={!filters?.class_id}
                  onChange={(e) => applyFilter("section_id", e.target.value)}
                >
                  <option value="">All Sections</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  Choose a class first to narrow the section list.
                </p>
              </div>
            </div>
          </FilterSection>

          <FilterSection
            title="Billing Month"
            description="Check one billing month or a month range to find pending fees across several months."
            isOpen={openSections.billingMonth}
            onToggle={() => toggleSection("billingMonth")}
            badge={filters?.month ? "Exact month" : hasMonthRangeValues ? "Range" : null}
          >
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Exact Billing Month
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={monthFilter}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMonthFilter(value);
                    setMonthFromFilter("");
                    setMonthToFilter("");
                    applyFilters(
                      {
                        month: value,
                        month_from: "",
                        month_to: "",
                      },
                      { preserveState: true }
                    );
                  }}
                >
                  <option value="">Any Month</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  Best when you want one clean monthly snapshot.
                </p>
              </div>

              <div className="xl:col-span-2 rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Month Range From
                    </label>
                    <input
                      type="month"
                      value={monthFromFilter}
                      onChange={(e) => {
                        setMonthFromFilter(e.target.value);
                        if (e.target.value) {
                          setMonthFilter("");
                        }
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Month Range To
                    </label>
                    <input
                      type="month"
                      value={monthToFilter}
                      onChange={(e) => {
                        setMonthToFilter(e.target.value);
                        if (e.target.value) {
                          setMonthFilter("");
                        }
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={applyMonthFilters}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[40px] sm:min-h-[36px]"
                  >
                    Apply Months
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Leave exact month empty to use a month range. Range checks stay inclusive, and reversed ranges are corrected automatically.
                </p>
                {hasMonthRangeValues && normalizedMonthRange.swapped ? (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Month range order will be corrected automatically when applied.
                  </p>
                ) : null}
              </div>
            </div>
          </FilterSection>

          <FilterSection
            title="Collection Date"
            description="Use this only when you want fees that were actually collected inside a date range."
            isOpen={openSections.collectionDate}
            onToggle={() => toggleSection("collectionDate")}
            badge={hasCollectionRangeValues ? "Range" : null}
          >
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Collected From
                  </label>
                  <input
                    type="date"
                    value={paidFromFilter}
                    onChange={(e) => setPaidFromFilter(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Collected To
                  </label>
                  <input
                    type="date"
                    value={paidToFilter}
                    onChange={(e) => setPaidToFilter(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={applyCollectionRangeFilters}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[40px] sm:min-h-[36px]"
                >
                  Apply Collection Range
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                This checks paid fees only, using the saved collection date. Unpaid fees will naturally stay out of these results.
              </p>
              {hasCollectionRangeValues && normalizedCollectionRange.swapped ? (
                <p className="mt-1 text-[11px] text-amber-600">
                  Collection date range order will be corrected automatically when applied.
                </p>
              ) : null}
            </div>
          </FilterSection>

          <FilterSection
            title="Student Search"
            description="Search is placed last so you can first narrow the list by filters, then quickly find a student or father name."
            isOpen={openSections.search}
            onToggle={() => toggleSection("search")}
            badge={filters?.search ? "Searching" : null}
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Search Student
                </label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Search by student or father name"
                  value={searchInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchInput(value);
                    applySearchLive(value);
                  }}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Helpful after selecting class, section, or month so the result list stays focused.
                </p>
              </div>

              {searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    applySearchLive("");
                  }}
                  className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[40px] sm:min-h-[36px]"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
          </FilterSection>
        </div>

        {/* Summary tiles — Phase 2 / Change C */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Total Unpaid
            </div>
            <div className="mt-0.5 text-base font-semibold text-red-600">
              Rs {summary.totalUnpaid.toLocaleString("en-PK")}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Total Paid
            </div>
            <div className="mt-0.5 text-base font-semibold text-green-600">
              Rs {summary.totalPaid.toLocaleString("en-PK")}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Students Shown
            </div>
            <div className="mt-0.5 text-base font-semibold text-gray-800">
              {summary.studentCount}
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={data}
        columns={columns}
        renderExpandedRow={renderExpandedRow}
        expandedId={expandedId}
        emptyMessage="No fees match the current filters."
        containerClassName="bg-white border rounded-lg overflow-x-auto"
        tableClassName="min-w-[1000px] text-sm"
        theadClassName="bg-gray-50 border-b"
      />

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
