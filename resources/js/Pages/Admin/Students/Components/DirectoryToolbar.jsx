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
  statusFilter,
  onStatusFilterChange,
  onReset,
  onAddStudent,
  classes,
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search name or father..."
          className="px-3 py-2 border rounded text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />

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

        <select
          value={sectionFilter}
          onChange={(e) => onSectionFilterChange(e.target.value)}
          disabled={classFilter === "all"}
          className="px-3 py-2 border rounded text-sm disabled:bg-gray-100"
        >
          <option value="all">All Sections</option>
          {sectionOptions.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={feeFilter}
          onChange={(e) => onFeeFilterChange(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="all">All Types</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="active">Active Students</option>
          <option value="all">All Statuses</option>
        </select>

        <button
          onClick={onReset}
          className="px-3 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
      </div>

      <button
        onClick={onAddStudent}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        + Add Student
      </button>
    </div>
  );
}
