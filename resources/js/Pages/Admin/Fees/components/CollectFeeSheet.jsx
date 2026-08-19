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
    <Modal show={!!fee} onClose={onClose} maxWidth="5xl">
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
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-white p-4 ring-1 ring-blue-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                {feeTypeLabel}
              </div>
              <div className="mt-0.5 text-lg font-semibold text-gray-900">
                {feePeriod}
              </div>
              {enrollmentLabel ? (
                <div className="mt-0.5 truncate text-xs text-gray-600">
                  {enrollmentLabel}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Amount
              </div>
              <div className="mt-0.5 text-xl font-bold text-gray-900">
                <span className="text-sm font-medium text-gray-500">Rs </span>
                {Number(fee.amount || 0).toLocaleString("en-PK")}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="collect-fee-date"
            className="block text-sm font-medium text-gray-700"
          >
            Collection Date
          </label>
          <div className="relative mt-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            >
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zM3.5 8.5v6.75c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V8.5h-13z"
                clipRule="evenodd"
              />
            </svg>
            <input
              id="collect-fee-date"
              type="date"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>
          {collectionDate ? (
            <p className="mt-1.5 text-xs text-gray-500">
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
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-60 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!collectionDate || submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px]"
        >
          {submitting ? (
            "Collecting…"
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
              Collect
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}