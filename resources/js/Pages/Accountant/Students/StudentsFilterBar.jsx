import SearchInput from "@/Components/SearchInput";

export default function StudentsFilterBar({
  classFilter,
  search,
  onClassFilterChange,
  onSearchChange,
}) {
  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onClassFilterChange("gurmukhi")}
          className={`px-3 py-1 rounded-full text-sm font-medium border ${
            classFilter === "gurmukhi"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700"
          }`}
        >
          Gurmukhi
        </button>
        <button
          type="button"
          onClick={() => onClassFilterChange("kirtan")}
          className={`px-3 py-1 rounded-full text-sm font-medium border ${
            classFilter === "kirtan"
              ? "bg-purple-600 text-white"
              : "bg-white text-gray-700"
          }`}
        >
          Kirtan
        </button>
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
