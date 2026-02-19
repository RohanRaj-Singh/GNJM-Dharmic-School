export default function AttendanceStudentCard({
  student,
  isKirtan,
  onStatusChange,
  onLessonChange,
}) {
  const isDisabledLesson =
    student.status === "absent" || student.status === "leave";

  return (
    <div className="bg-white border-2 rounded-2xl p-6 space-y-6">

      {/* Student Name */}
      <h3 className="text-xl font-semibold text-gray-800 text-center">
        {student.name}
      </h3>
      <p className="text-sm text-gray-500 text-center -mt-4">
        Father: {student.father_name || "-"}
      </p>

      {/* Attendance Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {["present", "absent", "leave"].map((status) => {
          const active = student.status === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(status)}
              className={`py-4 rounded-xl text-base font-semibold border-2 transition
                ${
                  active
                    ? status === "present"
                      ? "bg-green-600 border-green-700 text-white shadow-inner"
                      : status === "absent"
                      ? "bg-red-600 border-red-700 text-white shadow-inner"
                      : "bg-yellow-500 border-yellow-600 text-white shadow-inner"
                    : "bg-white border-gray-300 text-gray-700"
                }
              `}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Lesson Learned (Kirtan only) */}
      {isKirtan && (
        <div className="flex items-center justify-center gap-3">
          <input
            type="checkbox"
            checked={!isDisabledLesson && student.lesson_learned}
            disabled={isDisabledLesson}
            onChange={(e) => onLessonChange(e.target.checked)}
            className="h-5 w-5"
          />
          <span
            className={`text-sm ${
              isDisabledLesson ? "text-gray-400" : "text-gray-700"
            }`}
          >
            Lesson learned
          </span>
        </div>
      )}
    </div>
  );
}
