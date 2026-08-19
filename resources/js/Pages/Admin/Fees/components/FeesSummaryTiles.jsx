/**
 * FeesSummaryTiles — three compact tiles summarising the currently visible rows.
 *
 * Recomputed from `rows` via a `useMemo` upstream; here we just render. The
 * numbers reflect what is actually filtered (not the all-time totals), so
 * changing a filter narrows the summary.
 *
 * Pure presentational. The parent owns the data and recomputation.
 */
export default function FeesSummaryTiles({ totalUnpaid, totalPaid, studentCount }) {
  const fmt = (n) => Number(n || 0).toLocaleString("en-PK");

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="rounded-lg bg-red-50 px-3 py-2 ring-1 ring-red-100">
        <div className="text-[11px] font-medium uppercase tracking-wide text-red-700">
          Total Unpaid
        </div>
        <div className="mt-0.5 text-base font-semibold text-red-700">
          Rs {fmt(totalUnpaid)}
        </div>
      </div>
      <div className="rounded-lg bg-green-50 px-3 py-2 ring-1 ring-green-100">
        <div className="text-[11px] font-medium uppercase tracking-wide text-green-700">
          Total Paid
        </div>
        <div className="mt-0.5 text-base font-semibold text-green-700">
          Rs {fmt(totalPaid)}
        </div>
      </div>
      <div className="rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-600">
          Students Shown
        </div>
        <div className="mt-0.5 text-base font-semibold text-gray-800">
          {studentCount}
        </div>
      </div>
    </div>
  );
}