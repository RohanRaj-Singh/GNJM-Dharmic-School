import AttendanceRecordCard from "@/Components/AttendanceRecordCard";

export default function AttendanceSummaryPage({
  records = [],
  isKirtan,
  updateRecord,
  onSave,
}) {
  // 🛡 HARD GUARD
  if (!Array.isArray(records) || records.length === 0) {
    return (
      <p className="text-center text-sm text-gray-500">
        No students found
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {records.map((r) => (
  <AttendanceRecordCard
    key={`attendance-${r.student_id}`}   // ✅ STABLE & UNIQUE
    name={r.name}
    fatherName={r.father_name}
    status={r.status}
    lessonLearned={r.lesson_learned}
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
