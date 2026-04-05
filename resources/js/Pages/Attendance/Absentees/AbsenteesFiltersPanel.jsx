export default function AbsenteesFiltersPanel({
  filterOpen,
  onToggleOpen,
  hasActiveFilters,
  startDate,
  endDate,
  classId,
  sectionId,
  includeToday,
  classes,
  filteredSections,
  daysCount,
  dateRangeError,
  onStartDateChange,
  onEndDateChange,
  onClassChange,
  onSectionChange,
  onIncludeTodayChange,
  onApply,
  onReset,
}) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Filters</span>
          {hasActiveFilters && (
            <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${filterOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {filterOpen && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Class</label>
              <select
                value={classId}
                onChange={(e) => onClassChange(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Section</label>
              <select
                value={sectionId}
                onChange={(e) => onSectionChange(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              >
                <option value="">All Sections</option>
                {filteredSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeToday"
                checked={includeToday}
                onChange={(e) => onIncludeTodayChange(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="includeToday" className="text-sm text-gray-600">
                Include Today
              </label>
            </div>

            <button
              type="button"
              onClick={onApply}
              disabled={!!dateRangeError}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              Apply Filter
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
              >
                Reset
              </button>
            )}
          </div>

          {dateRangeError ? (
            <p className="text-xs text-red-600 mt-2">{dateRangeError}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-2">
              Showing students absent in {daysCount} day{daysCount !== 1 ? "s" : ""} ({startDate} to {endDate})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
