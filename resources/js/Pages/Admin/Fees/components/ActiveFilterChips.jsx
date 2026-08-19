import { formatMonthLabel, formatCollectionDate } from "./feesFormatters";

/**
 * ActiveFilterChips — compact removable chips, one per active URL filter.
 *
 * Each chip is a single source-of-truth piece of state — clicking its `×`
 * clears only that filter and leaves the rest intact. This avoids forcing
 * the admin to reopen the Filters modal just to drop one filter.
 *
 * The chip list is derived entirely from `filters`, `classes`, and `sections`
 * — no separate state. Whatever is in the URL is what shows.
 *
 * Props:
 *   filters      — the Inertia `filters` prop from the FeesController::index
 *                  response (year, class_id, section_id, search, status,
 *                  month, month_from, month_to, paid_from, paid_to)
 *   classes      — [{id, name}] fetched from /admin/classes/options
 *   sections     — [{id, name, class_id}] fetched from /admin/sections/options
 *   onRemove     — (key: string) => void, fired when the chip's × is clicked.
 *                  The parent maps the key back to the appropriate filter
 *                  clear behaviour (single key, ordered pair, etc).
 *   onClearAll   — () => void, fired when the bulk "Clear all" pill is
 *                  clicked (shown only when there are 2+ chips).
 */
export default function ActiveFilterChips({
  filters,
  classes,
  sections,
  onRemove,
  onClearAll,
}) {
  if (!filters) return null;

  const className = (id) =>
    classes.find((c) => String(c.id) === String(id))?.name ?? `Class #${id}`;
  const sectionName = (id) =>
    sections.find((s) => String(s.id) === String(id))?.name ?? `Section #${id}`;

  const chips = [];

  if (filters.year) {
    chips.push({
      key: "year",
      label: `Year ${filters.year}`,
    });
  }

  if (filters.class_id) {
    chips.push({
      key: "class_id",
      label: className(filters.class_id),
      // Removing the class must also drop section_id (server-side enforcement
      // already does this, but dropping it from the URL keeps the chip list
      // honest if the admin pastes a copy of the URL).
      onRemove: () => {
        onRemove("class_id");
      },
    });
  }

  if (filters.section_id) {
    chips.push({
      key: "section_id",
      label: sectionName(filters.section_id),
    });
  }

  if (filters.status) {
    const label = filters.status.charAt(0).toUpperCase() + filters.status.slice(1);
    chips.push({
      key: "status",
      label,
    });
  }

  if (filters.month) {
    chips.push({
      key: "month",
      label: formatMonthLabel(filters.month),
    });
  } else if (filters.month_from || filters.month_to) {
    const from = filters.month_from ? formatMonthLabel(filters.month_from) : "…";
    const to = filters.month_to ? formatMonthLabel(filters.month_to) : "…";
    chips.push({
      key: "month_range",
      label: `${from} → ${to}`,
      // Single chip covers two URL params; removing it clears both.
      onRemove: () => {
        onRemove("month_from");
        onRemove("month_to");
      },
    });
  }

  if (filters.paid_from || filters.paid_to) {
    const from = filters.paid_from ? formatCollectionDate(filters.paid_from) : "…";
    const to = filters.paid_to ? formatCollectionDate(filters.paid_to) : "…";
    chips.push({
      key: "paid_range",
      label: `Paid ${from} → ${to}`,
      onRemove: () => {
        onRemove("paid_from");
        onRemove("paid_to");
      },
    });
  }

  if (filters.search) {
    chips.push({
      key: "search",
      label: `“${filters.search}”`,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100"
        >
          <span className="truncate max-w-[180px]">{chip.label}</span>
          <button
            type="button"
            onClick={() => (chip.onRemove ? chip.onRemove() : onRemove(chip.key))}
            aria-label={`Clear filter ${chip.label}`}
            className="-mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-blue-700 hover:bg-blue-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </span>
      ))}
      {chips.length >= 2 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline min-h-[40px] sm:min-h-[36px] inline-flex items-center"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}