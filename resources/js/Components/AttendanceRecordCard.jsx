export default function AttendanceRecordCard({
  name,
  fatherName,
  status,
  lessonLearned,
  onStatusChange,
  onLessonChange,
  showLesson = true, // allow conditional usage (e.g. only Kirtan)
}) {
  const lessonDisabled =
    status === "absent" || status === "leave";

  return (
    <div className="bg-white border-2 rounded-xl p-4 space-y-3">

      {/* Student Name */}
      <p className="font-medium text-gray-800">
        {name}
      </p>
      <p className="text-xs text-gray-500">
        Father: {fatherName || "-"}
      </p>

      {/* Status Buttons (Selected Feel) */}
      <div className="flex gap-2">
        {["present", "absent", "leave"].map((s) => {
          const active = status === s;

          return (
            <button
              key={s}
              type="button"
              onClick={() => onStatusChange(s)}
              className={`px-3 py-1 rounded-full text-sm font-medium border-2 transition
                ${
                  active
                    ? s === "present"
                      ? "bg-green-600 border-green-700 text-white shadow-inner"
                      : s === "absent"
                      ? "bg-red-600 border-red-700 text-white shadow-inner"
                      : "bg-yellow-500 border-yellow-600 text-white shadow-inner"
                    : "bg-white border-gray-300 text-gray-700"
                }
              `}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Lesson Learned (Editable, Disabled if Absent/Leave) */}
      {showLesson && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!lessonDisabled && lessonLearned}
            disabled={lessonDisabled}
            onChange={(e) =>
              onLessonChange(e.target.checked)
            }
            className="h-4 w-4"
          />
          <span
            className={
              lessonDisabled
                ? "text-gray-400"
                : "text-gray-600"
            }
          >
            Lesson learned
          </span>
        </div>
      )}

    </div>
  );
}
