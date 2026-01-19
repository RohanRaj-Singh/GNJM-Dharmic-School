import AttendanceStudentCard from "@/Components/AttendanceStudentCard";

export default function AttendanceMarkPage({
  records,
  isKirtan,
  index,
  setIndex,
  updateCurrent,
  onFinish,
}) {
  const current = records[index];

  return (
    <>
      <p className="text-sm text-gray-500 text-center mb-4">
        Student {index + 1} of {records.length}
      </p>

      <AttendanceStudentCard
        student={current}
        isKirtan={isKirtan}
        onStatusChange={(status) =>
          updateCurrent({ status })
        }
        onLessonChange={(value) =>
          updateCurrent({ lesson_learned: value })
        }
      />

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="flex-1 py-3 rounded-lg bg-gray-200 text-gray-700 disabled:opacity-50"
        >
          Previous
        </button>

        <button
          onClick={() =>
            index === records.length - 1
              ? onFinish()
              : setIndex((i) => i + 1)
          }
          className="flex-1 py-3 rounded-lg bg-blue-600 text-white"
        >
          {index === records.length - 1
            ? "Review Summary"
            : "Next"}
        </button>
      </div>
    </>
  );
}
