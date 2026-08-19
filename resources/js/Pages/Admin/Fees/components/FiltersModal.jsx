import { useEffect, useState } from "react";
import Modal from "@/Components/Modal";
import { generateMonthOptions } from "@/utils/helper";
import { formatMonthLabel } from "./feesFormatters";

/**
 * FiltersModal — the post-redesign home for fee-list filters.
 *
 * The pre-redesign page had a four-section accordion (Basic, Billing Month,
 * Collection Date, Search) permanently visible. The new design hides those
 * behind a single "Filters" button; clicking it opens this modal.
 *
 * State strategy:
 *   - Initial state is seeded from the URL filters (current Inertia props).
 *   - The modal owns an internal copy of each field so the admin can iterate
 *     without round-tripping the server on every keystroke.
 *   - "Apply" sends one `router.get` with the merged result and closes the
 *     modal. "Cancel" closes without dispatching. "Reset" clears all fields
 *     and applies the empty filter (preserves the pre-redesign behaviour).
 *
 * The month and paid-date ranges are normalized to ascending order before
 * being sent, matching the pre-redesign semantics (a reversed range is
 * flipped automatically). Empty exact-month clears the range and vice versa,
 * so the two inputs don't disagree in the URL.
 *
 * Props:
 *   show             — boolean, controlled by the parent
 *   onClose          — () => void, fired on Cancel / backdrop click / ESC
 *   onApply          — (nextFilters) => void, parent dispatches the Inertia
 *                       request. The modal calls this AND onClose in one step.
 *   filters          — current URL filters (year, class_id, section_id,
 *                       status, month, month_from, month_to, paid_from,
 *                       paid_to, search)
 *   classes          — [{id, name}] from /admin/classes/options
 *   sections         — [{id, name, class_id}] from /admin/sections/options
 *   currentYear      — number, the year used to pivot month options + "This Month"
 */
export default function FiltersModal({
  show,
  onClose,
  onApply,
  filters,
  classes,
  sections,
  currentYear,
}) {
  const START_YEAR = 2025;
  const years = Array.from(
    { length: currentYear - START_YEAR + 1 },
    (_, i) => START_YEAR + i
  );

  const monthOptions = generateMonthOptions(
    Number(filters?.year) || currentYear
  );

  // Local form state. Seeded from props on open so closing the modal without
  // applying doesn't lose pending edits mid-session.
  const [year, setYear] = useState(filters?.year ?? "");
  const [status, setStatus] = useState(filters?.status ?? "");
  const [classId, setClassId] = useState(filters?.class_id ?? "");
  const [sectionId, setSectionId] = useState(filters?.section_id ?? "");
  const [month, setMonth] = useState(filters?.month ?? "");
  const [monthFrom, setMonthFrom] = useState(filters?.month_from ?? "");
  const [monthTo, setMonthTo] = useState(filters?.month_to ?? "");
  const [paidFrom, setPaidFrom] = useState(filters?.paid_from ?? "");
  const [paidTo, setPaidTo] = useState(filters?.paid_to ?? "");
  const [search, setSearch] = useState(filters?.search ?? "");

  // Re-seed the local state whenever the modal opens or the URL filters
  // change underneath. This keeps the modal in sync with clicks on the
  // active-filter chips or with browser back/forward navigation.
  useEffect(() => {
    if (!show) return;
    setYear(filters?.year ?? "");
    setStatus(filters?.status ?? "");
    setClassId(filters?.class_id ?? "");
    setSectionId(filters?.section_id ?? "");
    setMonth(filters?.month ?? "");
    setMonthFrom(filters?.month_from ?? "");
    setMonthTo(filters?.month_to ?? "");
    setPaidFrom(filters?.paid_from ?? "");
    setPaidTo(filters?.paid_to ?? "");
    setSearch(filters?.search ?? "");
  }, [show, filters]);

  const handleMonthChange = (value) => {
    setMonth(value);
    if (value) {
      setMonthFrom("");
      setMonthTo("");
    }
  };

  const handleMonthRangeChange = (setter) => (value) => {
    setter(value);
    if (value) setMonth("");
  };

  const handleThisMonth = () => {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(m);
    setMonthFrom("");
    setMonthTo("");
  };

  const normalizeOrdered = (a, b) => {
    if (!a || !b) return { a, b };
    if (a <= b) return { a, b };
    return { a: b, b: a };
  };

  const handleApply = () => {
    const monthRange = normalizeOrdered(monthFrom, monthTo);
    const paidRange = normalizeOrdered(paidFrom, paidTo);

    onApply({
      year: year || "",
      status: status || "",
      class_id: classId || "",
      section_id: classId && sectionId ? sectionId : "",
      month: month || "",
      month_from: month ? "" : monthRange.a,
      month_to: month ? "" : monthRange.b,
      paid_from: paidRange.a,
      paid_to: paidRange.b,
      search: search.trim(),
    });
  };

  const handleReset = () => {
    onApply({
      year: "",
      status: "",
      class_id: "",
      section_id: "",
      month: "",
      month_from: "",
      month_to: "",
      paid_from: "",
      paid_to: "",
      search: "",
    });
  };

  const statusPills = [
    { label: "All", value: "" },
    { label: "Paid", value: "paid" },
    { label: "Unpaid", value: "unpaid" },
  ];

  // Sections inside the class dropdown are filtered by the selected class
  // so the admin can't pick a (class, section) tuple that doesn't exist.
  const sectionOptions = classId
    ? sections.filter((s) => String(s.class_id) === String(classId))
    : sections;

  return (
    <Modal show={show} onClose={onClose} maxWidth="lg">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-gray-800">Filters</h2>
        <p className="mt-1 text-xs text-gray-500">
          Narrow the list by year, class, status, month, or collection date.
          Changes apply when you press Apply.
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {/* Basic Filters */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Basic
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Year
              </label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Status
              </label>
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                {statusPills.map((pill) => {
                  const active = status === pill.value;
                  return (
                    <button
                      key={pill.value || "all"}
                      type="button"
                      onClick={() => setStatus(pill.value)}
                      className={`flex-1 rounded-md px-3 py-2 text-sm transition ${
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
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Class
              </label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                }}
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
                value={sectionId}
                disabled={!classId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value="">All Sections</option>
                {sectionOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Billing Month */}
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Billing Month
            </h3>
            <button
              type="button"
              onClick={handleThisMonth}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline min-h-[40px] sm:min-h-[36px] inline-flex items-center"
            >
              This month
            </button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Exact Month
              </label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
              >
                <option value="">Any Month</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                From
              </label>
              <input
                type="month"
                value={monthFrom}
                onChange={(e) => handleMonthRangeChange(setMonthFrom)(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                To
              </label>
              <input
                type="month"
                value={monthTo}
                onChange={(e) => handleMonthRangeChange(setMonthTo)(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          {monthFrom && monthTo && monthFrom > monthTo ? (
            <p className="mt-2 text-[11px] text-amber-600">
              Reversed range — will be corrected automatically when applied.
              {monthFrom && monthTo ? ` (${formatMonthLabel(monthTo)} → ${formatMonthLabel(monthFrom)})` : null}
            </p>
          ) : null}
        </section>

        {/* Collection Date */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Collection Date
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Paid fees only. Use this to find what was actually collected in a
            date window.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                From
              </label>
              <input
                type="date"
                value={paidFrom}
                onChange={(e) => setPaidFrom(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                To
              </label>
              <input
                type="date"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Search */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Search
          </h3>
          <div className="mt-2">
            <input
              type="search"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Search by student or father name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-gray-50 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white min-h-[40px] sm:min-h-[36px]"
        >
          Reset
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-white min-h-[40px] sm:min-h-[36px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[40px] sm:min-h-[36px]"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}