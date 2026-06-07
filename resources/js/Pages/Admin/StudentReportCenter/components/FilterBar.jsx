import MultiSelect from "@/Components/MultiSelect";
import { useMemo } from "react";

/*
 * Filter bar for the Student Report Center.
 *
 * Three sequential steps, each clearly labelled. Designed so a
 * non-technical admin can fill them top-to-bottom without
 * understanding "range modes" or "from/to" couplings.
 *
 *   STEP 1 — Pick a student.
 *   STEP 2 — Pick a date range. Two native month pickers + 6
 *            presets + a live "this will include N months" preview.
 *   STEP 3 — Pick a division.
 *
 * The date inputs are native <input type="month"> which every
 * modern browser renders with a built-in month picker. No custom
 * JS date picker is needed. The min/max attributes bound the
 * picker to the year range exposed by the controller.
 */
const MONTHS_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

const fmtYM = (s) => {
  if (!s) return "";
  const [y, m] = s.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
};

export default function FilterBar({
  students,
  earliestYear,
  latestYear,
  studentId,
  rangeStart,
  rangeEnd,
  rangeMonths,
  division,
  loading,
  canExport,
  setStudentId,
  setRangeStart,
  setRangeEnd,
  setDivision,
  applyPreset,
  buildReport,
  exportPdf,
  pdfLoading,
  resetFilter,
}) {
  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: s.label })),
    [students]
  );

  const divisionOptions = [
    { value: "all",      label: "Gurmukhi + Kirtan" },
    { value: "gurmukhi", label: "Gurmukhi only"      },
    { value: "kirtan",   label: "Kirtan only"        },
  ];

  const presets = [
    { key: "this_month",     label: "This Month"      },
    { key: "last_3_months",  label: "Last 3 Months"   },
    { key: "last_6_months",  label: "Last 6 Months"   },
    { key: "this_year",      label: "This Year"       },
    { key: "last_12_months", label: "Last 12 Months"  },
    { key: "all_time",       label: "All Time"        },
  ];

  // The friendly range label and the can-build predicate.
  const hasRange = !!rangeStart && !!rangeEnd;
  const rangeInOrder = hasRange && rangeStart <= rangeEnd;
  const canBuild = !!studentId && rangeInOrder && !loading;

  const previewLabel = !hasRange
    ? "Pick a From and To month."
    : !rangeInOrder
      ? "To must be on or after From."
      : rangeStart === rangeEnd
        ? `Single month: ${fmtYM(rangeStart)}`
        : `Includes ${rangeMonths} month${rangeMonths === 1 ? "" : "s"}: ${fmtYM(rangeStart)} → ${fmtYM(rangeEnd)}`;

  return (
    <div className="bg-white border rounded p-4 mb-4 space-y-5">
      <Step step={1} title="Pick a student">
        <MultiSelect
          options={studentOptions}
          value={studentId ? [studentId] : []}
          onChange={(ids) => setStudentId(ids[0] ?? null)}
          single
          placeholder="Choose a student…"
          clearable={false}
        />
      </Step>

      <Step step={2} title="Pick a date range">
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="month"
                value={rangeStart || ""}
                min={earliestYear != null ? `${earliestYear}-01` : undefined}
                max={latestYear   != null ? `${latestYear}-12`   : undefined}
                onChange={(e) => setRangeStart(e.target.value || null)}
                className="w-full px-3 py-2 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="month"
                value={rangeEnd || ""}
                min={earliestYear != null ? `${earliestYear}-01` : undefined}
                max={latestYear   != null ? `${latestYear}-12`   : undefined}
                onChange={(e) => setRangeEnd(e.target.value || null)}
                className="w-full px-3 py-2 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Or pick a quick range</div>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={[
              "rounded px-3 py-2 text-sm border",
              !hasRange
                ? "bg-gray-50 text-gray-500 border-gray-200"
                : !rangeInOrder
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-blue-50 text-blue-800 border-blue-200",
            ].join(" ")}
          >
            <span className="font-medium">Preview:</span> {previewLabel}
          </div>
        </div>
      </Step>

      <Step step={3} title="Pick a division">
        <MultiSelect
          options={divisionOptions}
          value={[division]}
          onChange={(ids) => setDivision(ids[0] ?? "all")}
          single
          clearable={false}
        />
      </Step>

      <div className="pt-2 border-t flex flex-wrap items-center gap-3">
        <button
          onClick={buildReport}
          disabled={!canBuild}
          className="px-5 py-2.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? "Building…" : "Build Report"}
        </button>
        <button
          type="button"
          disabled={!canExport}
          onClick={exportPdf}
          className={`px-4 py-2.5 rounded text-sm font-medium border ${
            canExport && !pdfLoading
              ? "bg-white hover:bg-gray-50 text-gray-800 cursor-pointer"
              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          }`}
        >
          {pdfLoading ? "Generating…" : "Export PDF"}
        </button>
        <button
          onClick={resetFilter}
          className="px-4 py-2.5 rounded text-sm font-medium border bg-white hover:bg-gray-50 text-gray-700"
        >
          Reset
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          Available years: {earliestYear} – {latestYear}.
        </span>
      </div>
    </div>
  );
}

function Step({ step, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="ml-8">{children}</div>
    </div>
  );
}
