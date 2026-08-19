import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/Components/ConfirmDialog";
import Dropdown from "@/Components/Dropdown";
import toast from "react-hot-toast";

import ActiveFilterChips from "./components/ActiveFilterChips";
import FiltersModal from "./components/FiltersModal";
import FeesSummaryTiles from "./components/FeesSummaryTiles";
import StudentCard from "./components/StudentCard";
import StudentTable from "./components/StudentTable";
import StudentFeeSheet from "./components/StudentFeeSheet";

/**
 * FeesIndex — the redesigned admin Fees page.
 *
 * Layout (top → bottom, mobile + desktop):
 *   1. Header (title + admin action)
 *   2. Search (full-width, prominent)
 *   3. Status pills (All / Paid / Unpaid)
 *   4. Filters button + reset affordance
 *   5. Active filter chips
 *   6. Summary tiles (Total Unpaid / Total Paid / Students Shown)
 *   7. Student list — StudentCard on mobile, StudentTable on desktop
 *
 * The sheet for managing a single student's fees (StudentFeeSheet) renders
 * inside a Headless UI Modal — it covers the list rather than nesting a
 * second modal on top, so the admin never loses context.
 *
 * This page is the production surface.
 */

export default function FeesIndex() {
  const { fees, filters } = usePage().props;
  const data = fees ?? [];

  // -------- State --------
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [searchInput, setSearchInput] = useState(filters?.search ?? "");
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isGeneratingMonthlyFees, setIsGeneratingMonthlyFees] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Re-sync local search input when the URL changes externally (back/forward,
  // chip removal, etc).
  useEffect(() => {
    setSearchInput(filters?.search ?? "");
  }, [filters?.search]);

  // -------- Filters options fetched once --------
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

  // -------- URL navigation helpers --------
  const applyFilter = useCallback(
    (key, value, options = {}) => {
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
    },
    [filters]
  );

  const applyFilters = useCallback(
    (nextFilters, options = {}) => {
      router.get(
        route("admin.fees.index"),
        { ...filters, ...nextFilters },
        {
          preserveState: options.preserveState ?? false,
          replace: true,
        }
      );
    },
    [filters]
  );

  const applySearchLive = useCallback(
    (value) => {
      if ((filters?.search ?? "") !== value) {
        applyFilter("search", value, { preserveState: true });
      }
    },
    [applyFilter, filters?.search]
  );

  const resetFilters = () => {
    setSearchInput("");
    router.get(
      route("admin.fees.index"),
      {},
      { preserveState: false, replace: true }
    );
  };

  // -------- Computed --------
  const summary = useMemo(() => {
    let totalUnpaid = 0;
    let totalPaid = 0;
    for (const row of data) {
      totalUnpaid += Number(row.unpaid_amount) || 0;
      totalPaid += Number(row.paid_amount) || 0;
    }
    return { totalUnpaid, totalPaid, studentCount: data.length };
  }, [data]);

  const statusPills = [
    { label: "All", value: "" },
    { label: "Paid", value: "paid" },
    { label: "Unpaid", value: "unpaid" },
  ];

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
    ].filter((value) => value !== undefined && value !== null && value !== "")
      .length;
  }, [filters]);

  const currentYear = new Date().getFullYear();

  // -------- Admin actions --------
  function generateMonthlyFees() {
    setConfirmDialog({
      title: "Generate monthly fees?",
      description:
        "Existing fees for the same month will not be duplicated.",
      confirmLabel: "Generate",
      confirmVariant: "primary",
      onConfirm: () => {
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
      },
    });
  }

  // -------- Sheet open/close --------
  // Index rows carry the id under `student_id` and the names under
  // `student_name` / `father_name`. The Student Fee Sheet (and the spec's
  // contract) expect a `{ id, name, father_name }` shape, so we normalise
  // here once instead of asking every child to know about both spellings.
  const openStudentSheet = (row) =>
    setSelectedStudent({
      id: row.student_id ?? row.id,
      name: row.student_name ?? row.name,
      father_name: row.father_name ?? "",
    });
  const closeStudentSheet = () => setSelectedStudent(null);

  // -------- Render --------
  return (
    <AdminLayout title="Fees">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-gray-800">Fees</h1>

          {/* Desktop: tertiary Generate button. Mobile: ⋯ menu that opens the same action. */}
          <div className="hidden sm:block">
            <button
              type="button"
              onClick={generateMonthlyFees}
              disabled={isGeneratingMonthlyFees}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 min-h-[40px]"
            >
              {isGeneratingMonthlyFees ? "Generating…" : "Generate Monthly Fees"}
            </button>
          </div>
          <div className="block sm:hidden">
            <Dropdown>
              <Dropdown.Trigger>
                <button
                  type="button"
                  aria-label="More admin actions"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className="h-5 w-5"
                  >
                    <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM11.5 15a1.5 1.5 0 11-3 0 1.5 1.5 0 010 3z" />
                  </svg>
                </button>
              </Dropdown.Trigger>
              <Dropdown.Content align="right" width="56">
                <button
                  type="button"
                  onClick={generateMonthlyFees}
                  disabled={isGeneratingMonthlyFees}
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 min-h-[44px]"
                >
                  {isGeneratingMonthlyFees
                    ? "Generating…"
                    : "Generate Monthly Fees"}
                </button>
              </Dropdown.Content>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Search + Status + Filters row */}
      <div className="mb-3 space-y-3">
        <div className="relative">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              applySearchLive(value);
            }}
            placeholder="Search by student or father name"
            aria-label="Search students"
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            {statusPills.map((pill) => {
              const active = (filters?.status ?? "") === pill.value;
              return (
                <button
                  key={pill.value || "all"}
                  type="button"
                  onClick={() => applyFilter("status", pill.value)}
                  className={`rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? "bg-white font-medium text-blue-700 shadow"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setFiltersModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[40px]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M2.628 1.601C5.028 1.601 8 3.9 8 6.5 8 9.099 5.028 11.4 2.628 11.4 1.572 11.4.66 11.1 0 10.6V2.4C.66 1.9 1.572 1.601 2.628 1.601zM17.372 8.601C14.972 8.601 12 10.9 12 13.5c0 2.599 2.972 4.9 5.372 4.9 1.056 0 1.968-.3 2.628-.8V9.4c-.66-.5-1.572-.799-2.628-.799z"
                clipRule="evenodd"
              />
            </svg>
            Filters
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline min-h-[40px] inline-flex items-center"
            >
              Reset
            </button>
          ) : null}
        </div>

        <ActiveFilterChips
          filters={filters}
          classes={classes}
          sections={sections}
          onRemove={(key) => applyFilter(key, "", { preserveState: true })}
          onClearAll={resetFilters}
        />
      </div>

      {/* Summary */}
      <div className="mb-4">
        <FeesSummaryTiles
          totalUnpaid={summary.totalUnpaid}
          totalPaid={summary.totalPaid}
          studentCount={summary.studentCount}
        />
      </div>

      {/* Student list — cards on mobile, table on desktop. Both render in
          the DOM for layout stability; Tailwind's responsive classes hide
          the inactive one. */}
      <div className="block space-y-2 md:hidden">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          data.map((student) => (
            <StudentCard
              key={student.student_id ?? student.id}
              student={student}
              onOpen={openStudentSheet}
            />
          ))
        )}
      </div>

      <div className="hidden md:block">
        <StudentTable data={data} onOpen={openStudentSheet} />
      </div>

      {/* Modals */}
      <FiltersModal
        show={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        onApply={(next) => {
          setFiltersModalOpen(false);
          applyFilters(next, { preserveState: true });
        }}
        filters={filters}
        classes={classes}
        sections={sections}
        currentYear={currentYear}
      />

      <StudentFeeSheet
        student={selectedStudent}
        onClose={closeStudentSheet}
      />

      <ConfirmDialog
        show={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? null}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        confirmVariant={confirmDialog?.confirmVariant ?? "primary"}
        onConfirm={() => {
          const cb = confirmDialog?.onConfirm;
          setConfirmDialog(null);
          if (cb) cb();
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </AdminLayout>
  );
}

/**
 * EmptyState — concise, copy-led empty message used when filters return no
 * students. Lives inline because it's only one short paragraph and adding
 * a separate component file would be over-organisation.
 */
function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
      <p className="text-sm font-medium text-gray-700">
        No students match the current filters
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Try clearing a chip above, or use Reset to start fresh.
      </p>
    </div>
  );
}
