import { useMemo } from "react";

/**
 * StudentCard — mobile primary affordance for the redesigned Fees list.
 *
 * Replaces the per-row expanded-row pattern: the card summarises who the
 * student is and how much they owe, and the whole card is a tap target that
 * opens the Student Fee Sheet for fee management.
 *
 * Concise class representation (per spec §13):
 *   - 1 enrollment  → "Class 2 · Section A"
 *   - 2 enrollments → "Class 2 · Section A + Music · Section B"
 *   - 3+ enrollments → "Class 2 · Section A + 2 more"
 *
 * The count is derived from distinct `student_section_id` values in the
 * per-fee array. That is the same primitive the backend uses to bucket
 * enrollments, so the count is accurate even when a student moved classes.
 *
 * Props:
 *   student — the per-student row from the FeesController::index mapper
 *             (id, student_name, father_name, unpaid_amount, paid_amount,
 *              unpaid_count, paid_count, fees[] — each fee has
 *              student_section_id, class_name, section_name, class_type, ...)
 *   onOpen  — (student) => void, fired when the card / View fees button is
 *             tapped. The parent opens the Student Fee Sheet.
 */
export default function StudentCard({ student, onOpen }) {
  const fmt = (n) => Number(n || 0).toLocaleString("en-PK");
  const unpaid = Number(student.unpaid_amount) || 0;
  const paid = Number(student.paid_amount) || 0;
  const fees = student.fees ?? [];

  // Derive a per-enrollment list. The map key is the enrollment ID; the
  // value carries the first non-null section/class label we found for it.
  // We tolerate missing fields because some historical fees only carry the
  // class/section they were originally created for.
  const enrollments = useMemo(() => {
    const map = new Map();
    for (const fee of fees) {
      const key = fee.student_section_id;
      if (key == null) continue;
      if (!map.has(key)) {
        map.set(key, {
          studentSectionId: key,
          className: fee.class_name ?? null,
          sectionName: fee.section_name ?? null,
          classType: fee.class_type ?? null,
        });
      }
    }
    return [...map.values()];
  }, [fees]);

  const enrollmentCount = enrollments.length;

  // Concise class label per spec §13. Returns a plain string ready to drop
  // into the card — no separate "primary / detail" split, just the right
  // text for the count.
  const classesLabel = useMemo(() => {
    if (enrollmentCount === 0) return "No classes";

    const labelFor = (e) =>
      [e.className, e.sectionName].filter(Boolean).join(" · ") || "Class";

    if (enrollmentCount === 1) return labelFor(enrollments[0]);
    if (enrollmentCount === 2) {
      return `${labelFor(enrollments[0])} + ${labelFor(enrollments[1])}`;
    }
    return `${labelFor(enrollments[0])} + ${enrollmentCount - 1} more`;
  }, [enrollments, enrollmentCount]);

  const handleClick = () => onOpen?.(student);
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      aria-label={`Open fees for ${student.student_name}`}
      className="group block w-full cursor-pointer rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">
            {student.student_name}
          </div>
          {student.father_name ? (
            <div className="mt-0.5 truncate text-xs text-gray-500">
              S/o {student.father_name}
            </div>
          ) : null}
          <div className="mt-1 truncate text-xs text-gray-600">
            {enrollmentCount > 1 ? (
              <>
                <span className="font-medium text-gray-700">
                  {enrollmentCount}
                </span>{" "}
                classes ·{" "}
              </>
            ) : null}
            <span>{classesLabel}</span>
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:text-blue-600"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.25a.75.75 0 010 1.08l-4.25 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Unpaid
          </div>
          {unpaid > 0 ? (
            <div className="mt-0.5 text-lg font-semibold text-red-700">
              Rs {fmt(unpaid)}
            </div>
          ) : (
            <div className="mt-0.5 text-sm font-medium text-green-700">
              All paid
            </div>
          )}
          {paid > 0 ? (
            <div className="mt-1 text-xs text-gray-500">
              Paid Rs {fmt(paid)}
            </div>
          ) : null}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white group-hover:bg-blue-700 min-h-[44px]">
          View fees
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.25a.75.75 0 010 1.08l-4.25 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}