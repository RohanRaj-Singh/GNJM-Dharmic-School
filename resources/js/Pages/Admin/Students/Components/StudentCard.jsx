import StatusBadge from "@/Components/StatusBadge";

export default function StudentCard({ students, onEdit, effectiveStatus, selectedIds, onToggleOne }) {
  if (students.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-12 text-center text-sm text-gray-400">
        No students found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {students.map((student, idx) => {
        const isSelected = selectedIds && selectedIds.has(student.id);

        return (
          <div
            key={student.id || idx}
            className={`bg-white border rounded-lg p-4 space-y-3 ${isSelected ? "ring-2 ring-blue-400 bg-blue-50/30" : ""}`}
          >
            {/* Header: checkbox + name + status */}
            <div className="flex items-start gap-3">
              {onToggleOne && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleOne(student.id)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                />
              )}
              <div className="flex-1 flex items-start justify-between min-w-0">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{student.name}</h3>
                  {student.father_name && (
                    <p className="text-xs text-gray-500 mt-0.5">{student.father_name}</p>
                  )}
                </div>
                <StatusBadge status={effectiveStatus ? effectiveStatus(student) : student.status} />
              </div>
            </div>

            {/* Enrollments as badges */}
            <div className="flex flex-wrap gap-1 ml-7">
              {(student.enrollments || []).length === 0 ? (
                <span className="text-xs text-gray-400">No enrollments</span>
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

            {/* Meta row: type + actions */}
            <div className="flex items-center justify-between ml-7">
              <div className="flex items-center gap-2">
                {(student.enrollments || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(student.enrollments || []).map((e) => (
                      <span
                        key={e.id}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          e.student_type === "free"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {e.student_type === "free" ? "Free" : "Paid"}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>

              <button
                onClick={() => onEdit(student)}
                className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
