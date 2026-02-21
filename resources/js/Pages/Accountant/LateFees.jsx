import SimpleLayout from "@/Layouts/SimpleLayout";
import { useMemo, useState } from "react";

/**
 * Late Fees - Accountant View
 * - Groups fees per student + section
 * - Deduplicates months
 * - Provides Collect Fee action
 */
export default function LateFees({
  dueThisMonth = [],
  dueOlder = [],
  totalPending = 0,
}) {
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allItems = useMemo(
    () => [...(dueThisMonth ?? []), ...(dueOlder ?? [])],
    [dueThisMonth, dueOlder]
  );

  const classOptions = useMemo(() => {
    return Array.from(
      new Set(
        allItems
          .map((item) => normalizeText(item?.class))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  const sectionOptions = useMemo(() => {
    const source =
      classFilter === "all"
        ? allItems
        : allItems.filter(
            (item) => normalizeText(item?.class) === classFilter
          );

    return Array.from(
      new Set(
        source
          .map((item) => normalizeText(item?.section))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [allItems, classFilter]);

  const filters = useMemo(
    () => ({
      classFilter,
      sectionFilter,
      search,
    }),
    [classFilter, sectionFilter, search]
  );

  const filteredDueThisMonth = useMemo(
    () => applyFilters(dueThisMonth, filters),
    [dueThisMonth, filters]
  );

  const filteredDueOlder = useMemo(
    () => applyFilters(dueOlder, filters),
    [dueOlder, filters]
  );

  const filteredTotalPending = useMemo(() => {
    return [...filteredDueThisMonth, ...filteredDueOlder].reduce(
      (sum, item) => sum + Number(item?.amount ?? 0),
      0
    );
  }, [filteredDueThisMonth, filteredDueOlder]);

  return (
    <SimpleLayout title="Late Fees">
      <div className="space-y-4">

        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={classFilter}
              onChange={(e) => {
                const nextClass = e.target.value;
                setClassFilter(nextClass);
                setSectionFilter("all");
              }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Classes</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Sections</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student"
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Due This Month */}
        <FeeCard
          emoji="[This Month]"
          title="Due This Month"
          description="Students whose monthly fee is pending for the current month"
          items={filteredDueThisMonth}
        />

        {/* Due Older */}
        <FeeCard
          emoji="[Older]"
          title="Pending From Previous Months"
          description="Fees pending from earlier months"
          items={filteredDueOlder}
        />

        {/* Total Pending */}
        <div className="bg-gray-50 border rounded-xl p-6 text-center">
          <h3 className="text-base font-medium text-gray-700">
            Total Pending Amount
          </h3>

          <p className="text-3xl font-semibold text-gray-800 mt-2">
            Rs. {filteredTotalPending}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            {hasActiveFilters(filters)
              ? "Combined unpaid monthly fees (filtered)"
              : "Combined unpaid monthly fees"}
          </p>

          {!hasActiveFilters(filters) && Number(totalPending) !== filteredTotalPending ? (
            <p className="text-xs text-gray-400 mt-1">Overall total: Rs. {totalPending}</p>
          ) : null}
        </div>

      </div>
    </SimpleLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Fee Card                                                                    */
/* -------------------------------------------------------------------------- */

function FeeCard({ emoji, title, description, items }) {
  const grouped = groupByStudent(items);
  const students = Object.values(grouped);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-800">
            {emoji} {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {description}
          </p>
        </div>

        <span className="text-sm text-gray-600">
          {students.length}
        </span>
      </div>

      {students.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 text-center">
          No pending fees
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {students.map((student) => (
            <div
              key={`${student.student_id}-${student.section}`}
              className="border rounded-xl p-4"
            >
              {/* Student Header */}
              <div className="flex justify-between items-center mb-2 gap-2">
                <div>
                  <p className="text-base font-semibold text-gray-800">
                    {student.student}
                  </p>
                  <p className="text-sm text-gray-500">
                    {student.class} - {student.section}
                  </p>
                </div>

                <button
                  onClick={() =>
                    (window.location.href =
                      `/accountant/receive-fee?student_id=${student.student_id}`)
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
                >
                  Collect Fee
                </button>
              </div>

              {/* Fee List (deduped by month) */}
              <ul className="space-y-1 text-sm">
                {dedupeFeesByMonth(student.fees).map((fee, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between text-gray-600"
                  >
                    <span>- {fee.month}</span>
                    <span>Rs. {fee.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeText(value) {
  return String(value ?? "").trim();
}

function hasActiveFilters({ classFilter, sectionFilter, search }) {
  return (
    classFilter !== "all" ||
    sectionFilter !== "all" ||
    String(search ?? "").trim() !== ""
  );
}

function applyFilters(items, { classFilter, sectionFilter, search }) {
  const term = String(search ?? "").trim().toLowerCase();

  return (items ?? []).filter((item) => {
    const cls = normalizeText(item?.class);
    const sec = normalizeText(item?.section);
    const student = normalizeText(item?.student).toLowerCase();

    if (classFilter !== "all" && cls !== classFilter) return false;
    if (sectionFilter !== "all" && sec !== sectionFilter) return false;

    if (term === "") return true;

    return (
      student.includes(term) ||
      cls.toLowerCase().includes(term) ||
      sec.toLowerCase().includes(term)
    );
  });
}

/**
 * Group fees by student + section
 * This prevents merging when a student has multiple enrollments
 */
function groupByStudent(items) {
  return items.reduce((acc, item) => {
    const key = `${item.student_id}-${item.section}`;

    if (!acc[key]) {
      acc[key] = {
        student_id: item.student_id,
        student: item.student,
        class: item.class,
        section: item.section,
        fees: [],
      };
    }

    acc[key].fees.push({
      month: item.month,
      amount: item.amount,
    });

    return acc;
  }, {});
}

/**
 * Deduplicate fees by month (safety for test data)
 */
function dedupeFeesByMonth(fees) {
  return Object.values(
    fees.reduce((acc, fee) => {
      acc[fee.month] = fee;
      return acc;
    }, {})
  );
}

