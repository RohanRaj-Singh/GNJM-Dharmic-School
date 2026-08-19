import { useMemo } from "react";

/**
 * EnrollmentsList — the Level 1 content inside the Student Fee Sheet.
 *
 * Splits the student's per-enrollment rollup into:
 *   - Current Enrollments   (1 row per distinct student_section_id where
 *                            at least one fee has is_current_enrollment=true)
 *   - Previous Enrollments  (everything else — visually muted)
 *
 * Each row is a tappable card showing the class · section, the unpaid
 * balance, and a status hint ("All paid" when the unpaid balance is zero).
 * Tapping the row opens the Level 2 drill-down for that enrollment.
 *
 * Concise class naming: just the class and section text — no aggregate of
 * sibling enrollments (the parent already showed the count on the
 * StudentCard). If the class name is missing for a historical row, we fall
 * back to "Class" + the enrollment ID so the row is never empty.
 *
 * Props:
 *   fees        — Fee[] (the detail endpoint payload for this student)
 *   onSelect    — (enrollment) => void, fired when a row is tapped
 *   loading     — boolean, renders skeleton rows
 */
export default function EnrollmentsList({ fees, onSelect, loading = false }) {
  const fmt = (n) => Number(n || 0).toLocaleString("en-PK");

  // Group fees by enrollment. Capture representative labels (first non-null
  // wins) so a historical fee with stripped class info still has *some*
  // class name to render.
  const { current, previous } = useMemo(() => {
    const map = new Map();
    for (const fee of fees ?? []) {
      const key = fee.student_section_id;
      if (key == null) continue;
      if (!map.has(key)) {
        map.set(key, {
          studentSectionId: key,
          className: fee.class_name ?? null,
          sectionName: fee.section_name ?? null,
          divisionKey: fee.division_key ?? null,
          fees: [],
          isCurrent: false,
        });
      }
      const e = map.get(key);
      e.fees.push(fee);
      if (fee.is_current_enrollment) e.isCurrent = true;
      // Fill in any missing labels as we go.
      if (!e.className && fee.class_name) e.className = fee.class_name;
      if (!e.sectionName && fee.section_name) e.sectionName = fee.section_name;
      if (!e.divisionKey && fee.division_key) e.divisionKey = fee.division_key;
    }

    const all = [...map.values()].map((e) => {
      const unpaid = e.fees
        .filter((f) => !f.is_paid)
        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
      const paid = e.fees
        .filter((f) => f.is_paid)
        .reduce((sum, f) => sum + (Number(f.payment_amount ?? f.amount) || 0), 0);
      const unpaidCount = e.fees.filter((f) => !f.is_paid).length;
      const paidCount = e.fees.filter((f) => f.is_paid).length;
      return { ...e, unpaid, paid, unpaidCount, paidCount };
    });

    return {
      current: all.filter((e) => e.isCurrent),
      previous: all.filter((e) => !e.isCurrent),
    };
  }, [fees]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (current.length === 0 && previous.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M2 4.75A2.75 2.75 0 014.75 2h10.5A2.75 2.75 0 0118 4.75v10.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75zM4.75 3.5c-.69 0-1.25.56-1.25 1.25v.318l6 3.27 6-3.27V4.75c0-.69-.56-1.25-1.25-1.25H4.75zM3.5 6.957l5.61 3.06a.75.75 0 00.78 0L16.5 6.957v8.293c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25V6.957z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="mt-3 text-sm font-medium text-gray-700">No fees found</p>
        <p className="mt-1 text-xs text-gray-500">
          This student has no fees recorded yet.
        </p>
      </div>
    );
  }

  const renderRow = (enrollment, variant) => {
    const classText = enrollment.className ?? `Class #${enrollment.studentSectionId}`;
    const sectionText = enrollment.sectionName ?? null;
    const muted = variant === "previous";
    return (
      <button
        key={enrollment.studentSectionId}
        type="button"
        onClick={() => onSelect?.(enrollment)}
        className={`group block w-full rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[44px] ${
          muted
            ? "border-gray-200 bg-gray-50 hover:border-gray-300"
            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`truncate text-sm font-semibold ${
                  muted ? "text-gray-700" : "text-gray-900"
                }`}
              >
                {classText}
              </span>
              {muted ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  Previous
                </span>
              ) : null}
            </div>
            {sectionText ? (
              <div className="mt-0.5 truncate text-xs text-gray-500">
                {sectionText}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                enrollment.unpaid > 0
                  ? muted
                    ? "bg-gray-200 text-gray-600"
                    : "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
              aria-hidden="true"
            >
              {enrollment.unpaid > 0 ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06L10.75 9.69V5z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div>
              {enrollment.unpaid > 0 ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Unpaid
                  </div>
                  <div
                    className={`mt-0.5 text-lg font-semibold leading-none ${
                      muted ? "text-gray-700" : "text-red-700"
                    }`}
                  >
                    Rs {fmt(enrollment.unpaid)}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {enrollment.unpaidCount} fee{enrollment.unpaidCount === 1 ? "" : "s"} due
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Balance
                  </div>
                  <div className="mt-0.5 text-lg font-semibold leading-none text-green-700">
                    All paid
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {enrollment.paidCount} collected
                  </div>
                </>
              )}
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L10.94 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.25a.75.75 0 010 1.08l-4.25 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {current.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Current Enrollments
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {current.map((e) => renderRow(e, "current"))}
          </div>
        </section>
      ) : null}

      {previous.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            Previous Enrollments
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {previous.map((e) => renderRow(e, "previous"))}
          </div>
        </section>
      ) : null}
    </div>
  );
}