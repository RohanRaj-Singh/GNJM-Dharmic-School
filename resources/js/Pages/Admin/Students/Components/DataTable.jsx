import StatusBadge from "@/Components/StatusBadge";

export default function DataTable({
  students,
  sortConfig,
  onSort,
  onEdit,
  effectiveStatus,
  selectedIds,
  onToggleOne,
  onToggleAll,
}) {
  function SortIcon({ column }) {
    if (sortConfig.key !== column) {
      return <span className="ml-1 text-gray-300">⇅</span>;
    }
    return <span className="ml-1 text-gray-600">{sortConfig.dir === "asc" ? "↑" : "↓"}</span>;
  }

  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 w-12">#</th>
            <th
              className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => onSort("name")}
            >
              Name <SortIcon column="name" />
            </th>
            <th
              className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors"
              onClick={() => onSort("father_name")}
            >
              Father <SortIcon column="father_name" />
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Class / Section</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Type</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Outstanding</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {students.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                No students found
              </td>
            </tr>
          ) : (
            students.map((student, idx) => (
              <tr
                key={student.id || idx}
                className={`hover:bg-blue-50 transition-colors ${selectedIds.has(student.id) ? "bg-blue-50/50" : ""}`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(student.id)}
                    onChange={() => onToggleOne(student.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>

                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{student.name}</div>
                </td>

                <td className="px-4 py-3 text-gray-500">{student.father_name || "—"}</td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(student.enrollments || []).length === 0 ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      (student.enrollments || []).map((e) => (
                        <span
                          key={e.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200"
                        >
                          {e.class_name || "?"}
                          {e.section_name && <span className="opacity-60">·</span>}
                          {e.section_name || ""}
                        </span>
                      ))
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {(student.enrollments || []).length === 0 ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      (student.enrollments || []).map((e) => (
                        <span
                          key={e.id}
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                            e.student_type === "free"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {e.student_type === "free" ? "Free" : "Paid"}
                        </span>
                      ))
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <StatusBadge status={effectiveStatus ? effectiveStatus(student) : student.status} />
                </td>

                <td className="px-4 py-3 text-right text-xs text-gray-300">—</td>

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(student)}
                    className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
