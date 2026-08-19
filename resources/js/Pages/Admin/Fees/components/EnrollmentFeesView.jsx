import { useMemo, useState } from "react";
import { formatMonthLabel, formatCollectionDate } from "./feesFormatters";

const RECENT_LIMIT = 6;

/**
 * EnrollmentFeesView — the Level 2 content inside the Student Fee Sheet.
 *
 * Shows the fee history for exactly one enrollment — never mixed with fees
 * from a different class / section / previous enrollment / division. This is
 * the "fee ownership follows the original enrollment" rule expressed in the
 * UI: the only place a fee is ever rendered is inside the Sheet for its
 * own enrollment.
 *
 * The view shows the recent N fees by default and a "View older fees"
 * affordance to expand the rest. The expand is purely client-side — no
 * extra server call — because the Sheet already fetched every fee for the
 * student in a single detail request.
 *
 * Props:
 *   enrollment   — the enrollment record from EnrollmentsList. We re-derive
 *                   its fees from this prop so we never need a second fetch.
 *   onBack       — () => void, fired on the Back button
 *   onCollect    — (fee) => void, fired when Collect is tapped on a fee
 *   onDeCollect  — (feeId) => void, fired when Un-collect is tapped
 *   onClose      — () => void, fired when the X button is tapped (top-right)
 */
export default function EnrollmentFeesView({
  enrollment,
  onBack,
  onCollect,
  onDeCollect,
}) {
  const [showOlder, setShowOlder] = useState(false);

  // Sort by recency — monthly fees by month desc, custom by created_at desc,
  // monthly always before custom (matches the pre-redesign ordering).
  const sortedFees = useMemo(() => {
    const fees = [...(enrollment?.fees ?? [])];
    fees.sort((a, b) => {
      if (a.type === "monthly" && b.type === "monthly") {
        return (b.month ?? "").localeCompare(a.month ?? "");
      }
      if (a.type === "monthly") return -1;
      if (b.type === "monthly") return 1;
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bT - aT;
    });
    return fees;
  }, [enrollment]);

  if (!enrollment) return null;

  const recentFees = sortedFees.slice(0, RECENT_LIMIT);
  const olderFees = sortedFees.slice(RECENT_LIMIT);
  const visibleFees = showOlder ? sortedFees : recentFees;
  const fmt = (n) => Number(n || 0).toLocaleString("en-PK");

  const enrollmentLabel = [
    enrollment.className ?? "Class",
    enrollment.sectionName ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <div className="-mx-5 sticky top-0 z-10 -mt-5 border-b border-gray-200 bg-white px-5 pb-3 pt-1 sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline min-h-[44px]"
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
              d="M12.79 5.23a.75.75 0 01-.02 1.06L9.06 10l3.71 3.71a.75.75 0 11-1.04 1.08l-4.25-4.25a.75.75 0 010-1.08l4.25-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </button>

        <header className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {enrollmentLabel}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
              <span>
                {enrollment.unpaidCount + enrollment.paidCount} fee
                {enrollment.unpaidCount + enrollment.paidCount === 1 ? "" : "s"}
              </span>
              {enrollment.fees?.length > 0 && enrollment.fees[0]?.division_key ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="capitalize">
                    {enrollment.fees[0].division_key}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {enrollment.isCurrent ? (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              Current
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              Previous
            </span>
          )}
        </header>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3.5 ring-1 ring-gray-200">
        <SummaryTile
          label="Unpaid"
          value={`Rs ${fmt(enrollment.unpaid)}`}
          sub={`${enrollment.unpaidCount} due`}
          tone={enrollment.unpaid > 0 ? "red" : "green"}
          icon="clock"
        />
        <SummaryTile
          label="Paid"
          value={`Rs ${fmt(enrollment.paid)}`}
          sub={`${enrollment.paidCount} collected`}
          tone="green"
          icon="check"
        />
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          {showOlder ? "All Fees" : "Recent Fees"}
        </h3>
        {visibleFees.length === 0 ? (
          <div className="rounded-lg bg-gray-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              No fees on record
            </p>
            <p className="mt-1 text-xs text-gray-500">
              This enrollment has no fees yet.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleFees.map((fee) => (
              <FeeRow
                key={fee.id}
                fee={fee}
                onCollect={onCollect}
                onDeCollect={onDeCollect}
              />
            ))}
          </ul>
        )}

        {olderFees.length > 0 ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowOlder((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-200 min-h-[36px]"
            >
              {showOlder ? "Hide older fees" : `View older fees (${olderFees.length})`}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className={`h-3.5 w-3.5 transition-transform ${showOlder ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * SummaryTile — a single tile in the Unpaid/Paid grid. Renders a tone-tinted
 * icon chip on the left and the label/value/sub stack on the right.
 *
 * Tones: "red" (unpaid, attention), "green" (paid, settled).
 */
function SummaryTile({ label, value, sub, tone, icon }) {
  const toneClass =
    tone === "red"
      ? "bg-red-100 text-red-700"
      : "bg-green-100 text-green-700";
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
        aria-hidden="true"
      >
        {icon === "clock" ? (
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
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div
          className={`mt-0.5 text-lg font-semibold leading-none ${
            tone === "red" ? "text-red-700" : "text-green-700"
          }`}
        >
          {value}
        </div>
        <div className="mt-1 text-xs text-gray-500">{sub}</div>
      </div>
    </div>
  );
}

/**
 * FeeRow — one fee inside the drill-down. Shows the period, the type, the
 * amount, and the appropriate action button (Collect or Un-collect).
 *
 * The action callbacks go through the parent so the parent owns the
 * "open Collect sheet" vs "fire Un-collect" decision — the row doesn't
 * need to know about either.
 */
function FeeRow({ fee, onCollect, onDeCollect }) {
  const period =
    fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title || "Fee";
  const typeLabel = fee.type === "monthly" ? "Monthly" : fee.title || "Custom";

  return (
    <li className="flex h-full flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3.5 transition hover:border-gray-300">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            fee.is_paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
          aria-hidden="true"
        >
          {fee.is_paid ? (
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
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <circle cx="10" cy="10" r="3" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">
              {period}
            </span>
            {fee.is_paid ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                Paid
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                Unpaid
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {typeLabel} · Rs {Number(fee.amount || 0).toLocaleString("en-PK")}
          </div>
          {fee.is_paid && fee.paid_at ? (
            <div className="mt-0.5 truncate text-[11px] text-gray-400">
              Collected {formatCollectionDate(fee.paid_at)}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-auto">
        {fee.is_paid ? (
          <button
            type="button"
            onClick={() => onDeCollect?.(fee.id)}
            className="w-full rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-800 hover:bg-yellow-100 min-h-[44px]"
          >
            Un-collect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onCollect?.(fee)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 min-h-[44px]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Collect
          </button>
        )}
      </div>
    </li>
  );
}