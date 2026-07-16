import SearchInput from "@/Components/SearchInput";

export default function DirectoryToolbar({
  search,
  onSearchChange,
  classFilter,
  onClassFilterChange,
  sectionFilter,
  onSectionFilterChange,
  sectionOptions,
  feeFilter,
  onFeeFilterChange,
  includeInactive,
  onIncludeInactiveToggle,
  onReset,
  onAddStudent,
  classes,
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-between">
      {/* LEFT: Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search name or father..."
          className="px-3 py-2 border rounded text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />

        {/* Class */}
        <select
          value={classFilter}
          onChange={(e) => {
            onClassFilterChange(e.target.value);
            onSectionFilterChange("all");
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="all">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Section */}
        <select
          value={sectionFilter}
          onChange={(e) => onSectionFilterChange(e.target.value)}
          disabled={classFilter === "all"}
          className="px-3 py-2 border rounded text-sm disabled:bg-gray-100"
        >
          <option value="all">
            {classFilter === "all"
              ? "All Sections"
              : "All Sections"}
          </option>
          {sectionOptions.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Fee type */}
        <select
          value={feeFilter}
          onChange={(e) => onFeeFilterChange(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="all">All Types</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
        </select>

        {/* Include Inactive */}
        <label className="flex items-center gap-2 px-3 py-2 border rounded text-sm cursor-pointer select-none hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => onIncludeInactiveToggle(e.target.checked)}
            className="w-4 h-4"
          />
          Include Inactive
        </label>

        {/* Reset */}
        <button
          onClick={onReset}
          className="px-3 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* RIGHT: Add */}
      <button
        onClick={onAddStudent}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        + Add Student
      </button>
    </div>
  );
}
