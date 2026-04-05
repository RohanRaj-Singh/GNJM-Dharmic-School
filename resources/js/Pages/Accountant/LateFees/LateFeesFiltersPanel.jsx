import SearchInput from "@/Components/SearchInput";

export default function LateFeesFiltersPanel({
  classFilter,
  sectionFilter,
  search,
  classOptions,
  sectionOptions,
  onClassFilterChange,
  onSectionFilterChange,
  onSearchChange,
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={classFilter}
          onChange={(e) => onClassFilterChange(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Classes</option>
          {classOptions.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>

        <select
          value={sectionFilter}
          onChange={(e) => onSectionFilterChange(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Sections</option>
          {sectionOptions.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>

        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search by student, class, or section"
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
