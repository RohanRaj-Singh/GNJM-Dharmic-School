/**
 * FilterSection — accordion-style filter card used by the admin fees page.
 *
 * Each `FilterSection` renders a clickable header (title + optional badge +
 * description + Show/Hide affordance) and an optional body. Used to group
 * filters (Basic / Billing Month / Collection Date / Student Search) inside
 * the filter card.
 *
 * Extracted verbatim (Phase 0 — pure extraction, no behavior change) from
 * resources/js/Pages/Admin/Fees/Index.jsx:51-87.
 *
 * Props:
 *   title        — string, section heading
 *   description  — string|null, sub-caption beneath the title
 *   isOpen       — boolean, controls whether the body is rendered
 *   onToggle     — () => void, fired when the header is clicked
 *   badge        — string|null, e.g. "In use" / "Exact month" / "Range"
 *   children     — body content (rendered only when isOpen)
 */
export default function FilterSection({
  title,
  description,
  isOpen,
  onToggle,
  badge,
  children,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            {badge ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                {badge}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs font-medium text-gray-500">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>

      {isOpen ? <div className="border-t bg-white px-4 py-4">{children}</div> : null}
    </div>
  );
}
