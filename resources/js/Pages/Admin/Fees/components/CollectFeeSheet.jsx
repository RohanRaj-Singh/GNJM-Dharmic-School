import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import toast from "react-hot-toast";
import Modal from "@/Components/Modal";
import { formatMonthLabel, formatCollectionDate } from "./feesFormatters";

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * CollectFeeSheet — focused modal for marking a single fee as collected.
 *
 * Replaces the pre-redesign CollectFeeModal with a sheet-style modal that:
 *   - Uses the shared Headless UI Modal (focus trap, ESC, backdrop click)
 *   - Surfaces the full context the spec calls for: student, enrollment,
 *     class/section, fee period, fee type, amount, collection date
 *   - Reuses the existing /admin/fees/{fee}/collect endpoint with the
 *     pre-redesign call signature (no behavioural change to the wire)
 *
 * Props:
 *   fee              — Fee|null, the fee being collected; null = closed
 *   enrollment       — { className, sectionName, divisionKey } | null,
 *                       optional context shown in the header. Pass null when
 *                       the caller can't supply it (e.g. from outside the
 *                       Student Fee Sheet); the sheet still works.
 *   student          — { id, name, father_name } | null, optional header
 *                       context. Same fallback behaviour as enrollment.
 *   onClose          — () => void, fires on Cancel / backdrop / ESC
 *   onCollected      — (feeId) => void, fires after a successful collect.
 *                       Parent uses this to refresh the detail payload.
 */
export default function CollectFeeSheet({
  fee,
  enrollment,
  student,
  onClose,
  onCollected,
}) {
  const [collectionDate, setCollectionDate] = useState(getTodayDateInput());
  const [submitting, setSubmitting] = useState(false);

  // Reset the date whenever the sheet opens; otherwise the previously typed
  // date would survive into the next collect attempt.
  useEffect(() => {
    if (fee) {
      setCollectionDate(getTodayDateInput());
      setSubmitting(false);
    }
  }, [fee?.id]);

  if (!fee) return null;

  const handleConfirm = () => {
    if (!collectionDate || submitting) return;
    setSubmitting(true);

    router.post(
      route("admin.fees.collect", fee.id),
      { collection_date: collectionDate },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
          toast.success("Fee collected");
          setSubmitting(false);
          onCollected?.(fee.id);
        },
        onError: () => {
          setSubmitting(false);
          toast.error("Could not collect fee. Please try again.");
        },
        onFinish: () => setSubmitting(false),
      }
    );
  };

  const feePeriod =
    fee.type === "monthly"
      ? formatMonthLabel(fee.month)
      : fee.title || "Fee";
  const feeTypeLabel = fee.type === "monthly" ? "Monthly Fee" : fee.title || "Custom Fee";
  const enrollmentLabel =
    enrollment
      ? [enrollment.className, enrollment.sectionName].filter(Boolean).join(" · ") ||
        "Enrollment"
      : null;

  return (
    <Modal show={!!fee} onClose={onClose} maxWidth="md">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold text-gray-800">Collect Fee</h2>
        {student ? (
          <p className="mt-1 truncate text-sm text-gray-700">
            <span className="font-medium">{student.name}</span>
            {enrollmentLabel ? (
              <span className="text-gray-500"> · {enrollmentLabel}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Period
            </div>
            <div className="mt-0.5 font-medium text-gray-900">
              {feePeriod}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Type
            </div>
            <div className="mt-0.5 font-medium text-gray-900">
              {feeTypeLabel}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Amount
          </div>
          <div className="mt-0.5 text-2xl font-semibold text-gray-900">
            Rs {Number(fee.amount || 0).toLocaleString("en-PK")}
          </div>
        </div>

        <div>
          <label
            htmlFor="collect-fee-date"
            className="block text-sm font-medium text-gray-700"
          >
            Collection Date
          </label>
          <input
            id="collect-fee-date"
            type="date"
            value={collectionDate}
            onChange={(e) => setCollectionDate(e.target.value)}
            disabled={submitting}
            className="mt-1.5 w-full rounded-lg border px-3 py-3 text-sm disabled:bg-gray-50"
          />
          {collectionDate ? (
            <p className="mt-1 text-xs text-gray-500">
              {formatCollectionDate(collectionDate)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-white disabled:opacity-60 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!collectionDate || submitting}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
        >
          {submitting ? "Collecting…" : "Collect"}
        </button>
      </div>
    </Modal>
  );
}