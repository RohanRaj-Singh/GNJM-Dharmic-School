import { formatMonthLabel } from "./feesFormatters";

/**
 * CollectFeeModal — date-picker modal for marking a fee as collected.
 * Returns null when `fee` is null (closed state).
 *
 * Extracted verbatim (Phase 0 — pure extraction, no behavior change) from
 * resources/js/Pages/Admin/Fees/Index.jsx:189-242.
 *
 * Props:
 *   fee                      — Fee|null, the fee being collected; null = closed
 *   collectionDate           — string (YYYY-MM-DD), current date input value
 *   onCollectionDateChange   — (value: string) => void
 *   onClose                  — () => void
 *   onConfirm                — () => void, fires router.post on the parent
 */
export default function CollectFeeModal({
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
            className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[40px] sm:min-h-[36px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!collectionDate}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 min-h-[40px] sm:min-h-[36px]"
          >
            Confirm Collection
          </button>
        </div>
      </div>
    </div>
  );
}
