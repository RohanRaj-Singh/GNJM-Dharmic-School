import SearchInput from "@/Components/SearchInput";
import { FilterSelect } from "@/Components/FilterBar";
import { ALL_FILTER } from "./utils";

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
        <FilterSelect
          value={classFilter}
          onChange={onClassFilterChange}
          options={[
            { value: ALL_FILTER, label: "All Classes" },
            ...classOptions.map((cls) => ({ value: String(cls.id), label: cls.name })),
          ]}
          placeholder="All Classes"
          className="border rounded-lg px-3 py-2 text-sm"
        />

        <FilterSelect
          value={sectionFilter}
          onChange={onSectionFilterChange}
          options={[
            { value: ALL_FILTER, label: "All Sections" },
            ...sectionOptions.map((section) => ({
              value: String(section.id),
              label: section.name,
            })),
          ]}
          placeholder="All Sections"
          className="border rounded-lg px-3 py-2 text-sm"
        />

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
