import { divisionMeta } from "@/utils/divisionType";

/**
 * Color legend for divisions (Sprint 6.4 / L-3).
 *
 * Renders one swatch + label per division. Each swatch uses the same
 * `divisionMeta(key)` palette the filter bars and badges use, so the
 * legend matches what an admin actually sees on screen. A third+ division
 * inherits the same deterministic palette without any code change here.
 *
 * Props:
 *   - divisions: array of division keys (strings) OR {key, title} objects.
 *                Strings are passed straight to divisionMeta() for the title.
 *   - label: optional heading text (default: "Division Color Legend").
 *   - className: optional wrapper className passthrough.
 */
export default function DivisionLegend({
  divisions = [],
  label = "Division Color Legend",
  className = "",
}) {
  // Normalize to {key, title}; same shape `divisionMeta()` consumers expect.
  const items = (divisions ?? [])
    .map((d) =>
      typeof d === "string"
        ? { key: d, title: divisionMeta(d).title }
        : { key: d.key, title: d.title ?? divisionMeta(d.key).title }
    )
    .filter((d) => d.key);

  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs text-slate-600 ${className}`}
    >
      <span className="uppercase tracking-wide text-slate-500 mr-1">
        {label}:
      </span>
      {items.map((d) => {
        const meta = divisionMeta(d.key);
        return (
          <span
            key={d.key}
            data-testid={`division-legend-${d.key}`}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-transparent ${meta.pillBg} ${meta.pillText}`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-2.5 w-2.5 rounded-full ${meta.accent.replace("text-", "bg-")}`}
            />
            {d.title}
          </span>
        );
      })}
    </div>
  );
}