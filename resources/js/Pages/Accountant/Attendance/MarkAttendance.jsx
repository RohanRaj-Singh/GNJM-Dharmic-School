import { useState } from "react";
import SimpleLayout from "@/Layouts/SimpleLayout";
import { router } from "@inertiajs/react";

export default function MarkAttendance({ enrollments }) {
  const [index, setIndex] = useState(0);
  const [attendance, setAttendance] = useState({});
  const [lessonLearned, setLessonLearned] = useState({});

  if (enrollments.length === 0) {
    return (
      <SimpleLayout title="Attendance">
        <p className="text-center text-gray-500">
          No students found for attendance.
        </p>
      </SimpleLayout>
    );
  }

  const enrollment = enrollments[index];
  const student = enrollment.student;
  const classType = enrollment.school_class.type;

  const markAttendance = (status) => {
    const payload = {
      student_section_id: enrollment.id,
      date: new Date().toISOString().slice(0, 10),
      present: status === "present",
      lesson_learned:
        classType === "kirtan" && status === "present"
          ? lessonLearned[enrollment.id] ?? true
          : null,
    };

    // Save locally for summary
    setAttendance({
      ...attendance,
      [enrollment.id]: payload,
    });

    // Fire & forget API call
    fetch("/attendance", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-TOKEN": document
      .querySelector('meta[name="csrf-token"]')
      .getAttribute("content"),
  },
  body: JSON.stringify(payload),
});


    if (index < enrollments.length - 1) {
      setIndex(index + 1);
    }
  };

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  const isFinished = index >= enrollments.length;

  return (
    <SimpleLayout title="Attendance">
      {!isFinished ? (
        <div
          key={enrollment.id}
          className="bg-white rounded-xl shadow p-6 text-center
                     transition-all duration-300 ease-in-out"
        >
          {/* Progress */}
          <p className="text-sm text-gray-500 mb-2">
            Student {index + 1} of {enrollments.length}
          </p>

          <div className="mb-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{
                  width: `${((index + 1) / enrollments.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Student Info */}
          <h2 className="text-2xl font-semibold text-gray-800">
            {student.name}
          </h2>

          <p className="text-gray-500 mb-6">
            Father: {student.father_name}
          </p>

          {/* Lesson Learned (Kirtan only) */}
          {classType === "kirtan" && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Lesson Learned?
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() =>
                    setLessonLearned({
                      ...lessonLearned,
                      [enrollment.id]: true,
                    })
                  }
                  className={`px-4 py-2 rounded-lg border ${
                    lessonLearned[enrollment.id] !== false
                      ? "bg-green-600 text-white"
                      : "bg-white"
                  }`}
                >
                  Yes
                </button>

                <button
                  onClick={() =>
                    setLessonLearned({
                      ...lessonLearned,
                      [enrollment.id]: false,
                    })
                  }
                  className={`px-4 py-2 rounded-lg border ${
                    lessonLearned[enrollment.id] === false
                      ? "bg-red-600 text-white"
                      : "bg-white"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
                type="button"
              onClick={() => markAttendance("present")}
              className="w-full bg-green-600 text-white py-3 rounded-lg text-lg"
            >
              Present
            </button>

            <button
                type="button"
              onClick={() => markAttendance("absent")}
              className="w-full bg-red-600 text-white py-3 rounded-lg text-lg"
            >
              Absent
            </button>

            <button
                type="button"
              onClick={() => markAttendance("leave")}
              className="w-full bg-yellow-500 text-white py-3 rounded-lg text-lg"
            >
              Leave
            </button>
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="text-sm text-gray-600 disabled:opacity-40"
            >
              ← Previous
            </button>
          </div>
        </div>
      ) : (
        <AttendanceSummary attendance={attendance} />
      )}
    </SimpleLayout>
  );
}

function AttendanceSummary({ attendance }) {
  const values = Object.values(attendance);

  const present = values.filter(v => v.present).length;
  const absent = values.filter(v => v.present === false).length;

  return (
    <div className="bg-white rounded-xl shadow p-6 text-center">
      <h2 className="text-2xl font-semibold mb-4">
        Attendance Completed
      </h2>

      <div className="space-y-2 text-lg">
        <p className="text-green-600">Present: {present}</p>
        <p className="text-red-600">Absent: {absent}</p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-6 bg-blue-600 text-white py-3 px-6 rounded-lg"
      >
        Done
      </button>
    </div>
  );
}
