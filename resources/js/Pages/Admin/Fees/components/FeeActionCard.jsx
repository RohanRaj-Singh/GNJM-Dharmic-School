import { formatMonthLabel, formatCollectionDate } from "./feesFormatters";

/**
 * FeeActionCard — single fee row inside a division column of the expanded
 * student row. Renders Collect / Un-collect based on `isPaid`.
 *
 * Extracted verbatim (Phase 0 — pure extraction, no behavior change) from
 * resources/js/Pages/Admin/Fees/Index.jsx:89-128.
 *
 * Props:
 *   fee         — { id, type, month?, title?, amount, paid_at? }
 *   isPaid      — boolean, drives which action button is shown
 *   onCollect   — (fee) => void, fired when Collect is clicked
 *   onDeCollect — (feeId) => void, fired when Un-collect is clicked
 */
export default function FeeActionCard({ fee, isPaid, onCollect, onDeCollect }) {
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
