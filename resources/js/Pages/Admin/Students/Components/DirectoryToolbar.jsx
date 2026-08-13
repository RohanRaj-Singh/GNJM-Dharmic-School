import SearchInput from "@/Components/SearchInput";
import { FilterSelect } from "@/Components/FilterBar";

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

        <FilterSelect
          value={classFilter}
          onChange={(v) => {
            onClassFilterChange(v);
            onSectionFilterChange("all");
          }}
          options={classes.map((c) => ({
            value: String(c.id),
            label: c.name,
          }))}
          placeholder="All Classes"
          className="px-3 py-2 border rounded text-sm"
        />

        <FilterSelect
          value={sectionFilter}
          onChange={onSectionFilterChange}
          options={sectionOptions.map((s) => ({
            value: String(s.id),
            label: s.name,
          }))}
          placeholder="All Sections"
          disabled={classFilter === "all"}
          className="px-3 py-2 border rounded text-sm disabled:bg-gray-100"
        />

        <FilterSelect
          value={feeFilter}
          onChange={onFeeFilterChange}
          options={[
            { value: "paid", label: "Paid" },
            { value: "free", label: "Free" },
          ]}
          placeholder="All Types"
          className="px-3 py-2 border rounded text-sm"
        />

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
