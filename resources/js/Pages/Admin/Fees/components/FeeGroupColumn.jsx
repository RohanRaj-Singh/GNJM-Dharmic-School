import FeeActionCard from "./FeeActionCard";

/**
 * FeeGroupColumn — one division's column inside the expanded student row.
 * Renders Unpaid Fees + Paid Fees sub-grids of FeeActionCards.
 *
 * Extracted verbatim (Phase 0 — pure extraction, no behavior change) from
 * resources/js/Pages/Admin/Fees/Index.jsx:130-187.
 *
 * Props:
 *   title          — string, division name (e.g. "Gurmukhi")
 *   titleClassName — string, tailwind class for the title color (from divisionMeta)
 *   unpaidFees     — Fee[] (sorted by month desc by caller)
 *   paidFees       — Fee[] (sorted by month desc by caller)
 *   onCollect      — (fee) => void
 *   onDeCollect    — (feeId) => void
 */
export default function FeeGroupColumn({
  title,
  titleClassName,
  unpaidFees,
  paidFees,
  onCollect,
  onDeCollect,
}) {
  return (
    <div className="border rounded-lg p-2 sm:p-3 bg-white">
      <div className={`text-xs font-bold mb-2 uppercase tracking-wide ${titleClassName}`}>
        {title}
      </div>

      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">
          Unpaid Fees
        </div>
        {unpaidFees.length === 0 ? (
          <div className="text-xs text-gray-500">No unpaid fees.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {unpaidFees.map((fee) => (
              <FeeActionCard
                key={fee.id}
                fee={fee}
                isPaid={false}
                onCollect={onCollect}
                onDeCollect={onDeCollect}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-600 mb-2">
          Paid Fees
        </div>
        {paidFees.length === 0 ? (
          <div className="text-xs text-gray-500">No paid fees.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {paidFees.map((fee) => (
              <FeeActionCard
                key={fee.id}
                fee={fee}
                isPaid={true}
                onCollect={onCollect}
                onDeCollect={onDeCollect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
