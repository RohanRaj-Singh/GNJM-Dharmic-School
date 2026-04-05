import SearchInput from "@/Components/SearchInput";

function StudentRecordItem({
  student,
  isExpanded,
  onToggle,
  getDayName,
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50"
      >
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">{student.name}</p>
          <p className="text-xs text-gray-500">Father: {student.father_name || "-"}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 min-w-8 text-center">
            {student.absentCount}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 min-w-8 text-center">
            {student.leaveCount}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <ul className="border-t bg-gray-50 divide-y">
          {student.allDates.map((item, index) => (
            <li
              key={`${student.recordKey}-${item.date}-${item.type}-${index}`}
              className="px-4 py-2 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-gray-700">{item.date}</p>
                <p className="text-xs text-gray-500">{getDayName(item.date) || "-"}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  item.type === "Absent" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {item.type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AbsenteesStudentList({
  records,
  searchTerm,
  sortBy,
  hideZeroAbsentees,
  hideZeroLeaves,
  expandedStudents,
  onSearchChange,
  onSortChange,
  onHideZeroAbsenteesChange,
  onHideZeroLeavesChange,
  onToggleStudent,
  getDayName,
}) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-800">Student Attendance List</p>
          <p className="text-xs text-gray-500">Each student shows absent and leave totals</p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          {records.length}
        </span>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <SearchInput
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Search student, father, or section"
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full md:w-56"
            >
              <option value="days_desc">Sort: Total Days High to Low</option>
              <option value="days_asc">Sort: Total Days Low to High</option>
              <option value="name_asc">Sort: Name A to Z</option>
              <option value="name_desc">Sort: Name Z to A</option>
              <option value="absent_desc">Sort: Most Absents</option>
              <option value="leave_desc">Sort: Most Leaves</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={hideZeroAbsentees}
                onChange={(e) => onHideZeroAbsenteesChange(e.target.checked)}
                className="w-4 h-4"
              />
              Hide 0 Absentees
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={hideZeroLeaves}
                onChange={(e) => onHideZeroLeavesChange(e.target.checked)}
                className="w-4 h-4"
              />
              Hide 0 Leaves
            </label>
          </div>

          {records.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No students match the current search and sort.
            </p>
          ) : (
            <div className="space-y-2">
              {records.map((student) => (
                <StudentRecordItem
                  key={student.recordKey}
                  student={student}
                  isExpanded={expandedStudents[student.recordKey] === true}
                  onToggle={() => onToggleStudent(student.recordKey)}
                  getDayName={getDayName}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
