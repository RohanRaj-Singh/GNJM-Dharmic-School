export default function TodayAbsenteesPanel({
  students,
  isOpen,
  onToggle,
}) {
  if (!students?.length) {
    return null;
  }

  return (
    <div className="bg-white border-2 border-red-500 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-red-100 hover:bg-red-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-red-700 font-medium">Absent Today</span>
          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
            {students.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-red-700 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul className="divide-y">
          {students.map((student) => (
            <li key={student.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">{student.name}</p>
                <p className="text-xs text-gray-500">Father: {student.father_name || "-"}</p>
              </div>
              <span className="text-xs bg-red-200 text-red-700 px-2 py-1 rounded">Today</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
