import SearchInput from "@/Components/SearchInput";
import { divisionMeta } from "@/utils/divisionType";

/**
 * Data-driven division filter (B12).
 *
 * The bar is sourced from the `divisions` prop — one button per division the
 * resolver returns, in the order the backend supplies them. A leading "All"
 * button is rendered as the no-filter sentinel. Adding a third+ class
 * (Music, Tabla, …) needs no change here; the backend route that hands
 * `divisions` to the page is the only seam.
 *
 * Each division button picks its palette from `divisionMeta(key)` so a
 * newly-resolved division (Gurmukhi/Kirtan stay on legacy colors, anything
 * else falls through to the deterministic palette).
 */
export default function StudentsFilterBar({
  classFilter,
  search,
  divisions = [],
  onClassFilterChange,
  onSearchChange,
}) {
  // Stable list view: backend may hand us [{key, title}] or raw strings;
  // normalise to {key, title} so the rest of the component is shape-agnostic.
  const normalizedDivisions = (divisions ?? [])
    .map((d) =>
      typeof d === "string"
        ? { key: d, title: divisionMeta(d).title }
        : { key: d.key, title: d.title ?? divisionMeta(d.key).title }
    )
    .filter((d) => d.key);

  const activeFilter = String(classFilter ?? "all").trim().toLowerCase();
  const isAll = activeFilter === "" || activeFilter === "all";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onClassFilterChange("all")}
          className={`px-3 py-1 rounded-full text-sm font-medium border ${
            isAll
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          All
        </button>

        {normalizedDivisions.map((d) => {
          const meta = divisionMeta(d.key);
          const isActive = activeFilter === d.key.toLowerCase();
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onClassFilterChange(d.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? `${meta.pillBg} ${meta.pillText} border-transparent`
                  : `${meta.bg} ${meta.text} border-gray-300 hover:${meta.bgHover}`
              }`}
            >
              {d.title}
            </button>
          );
        })}
      </div>

      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search by student or father"
        className="w-full border rounded-lg px-3 py-2"
      />
    </>
  );
}
