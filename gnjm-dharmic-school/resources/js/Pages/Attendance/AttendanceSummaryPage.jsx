import AttendanceRecordCard from "@/Components/AttendanceRecordCard";

export default function AttendanceSummaryPage({
  records,
  isKirtan,
  updateRecord,
  onSave,
}) {
  return (
    <>
      <div className="space-y-3">
        {records.map((r) => (
          <AttendanceRecordCard
            key={r.student_id}
            name={r.name}

            /* 👇 UI-only fallback */
            status={r.status ?? "present"}

            lessonLearned={!!r.lesson_learned}
            showLesson={isKirtan}
            onStatusChange={(status) =>
              updateRecord(r.student_id, { status })
            }
            onLessonChange={(value) =>
              updateRecord(r.student_id, {
                lesson_learned: value,
              })
            }
          />
        ))}
      </div>

      <button
        onClick={onSave}
        className="w-full bg-green-600 text-white py-3 rounded-lg mt-6"
      >
        Save Attendance
      </button>
    </>
  );
}
