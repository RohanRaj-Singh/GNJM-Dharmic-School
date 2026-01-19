import SimpleLayout from "@/Layouts/SimpleLayout";
import { router } from "@inertiajs/react";
import { useState } from "react";

import AttendanceStudentCard from "@/Components/AttendanceStudentCard";
import AttendanceRecordCard from "@/Components/AttendanceRecordCard";

export default function Mark({ section }) {
  const isKirtan =
    section.school_class.name.toLowerCase() === "kirtan";

  // 🔹 Present by default
  const [records, setRecords] = useState(() =>
    section.student_sections.map((ss) => ({
      student_id: ss.student.id,
      name: ss.student.name,
      status: "present", // present | absent | leave
      lesson_learned: false,
    }))
  );

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("mark"); // mark | summary

  const current = records[index];

  /* ---------------- Helpers ---------------- */

  const normalize = (changes) => {
    // If absent or leave → lesson learned must be false
    if (
      changes.status === "absent" ||
      changes.status === "leave"
    ) {
      return { ...changes, lesson_learned: false };
    }
    return changes;
  };

  const updateCurrent = (changes) => {
    setRecords((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, ...normalize(changes) } : r
      )
    );
  };

  const updateFromSummary = (studentId, changes) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.student_id === studentId
          ? { ...r, ...normalize(changes) }
          : r
      )
    );
  };

  /* ---------------- Navigation ---------------- */

  const next = () => {
    if (index < records.length - 1) {
      setIndex((i) => i + 1);
    } else {
      setMode("summary");
    }
  };

  const prev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  /* ---------------- Submit ---------------- */

  const submitAttendance = () => {
  router.post(
    "/attendance",
    {
      section_id: section.id,
      attendance: records,
    },
    {
      preserveScroll: true,
      onSuccess: () => {
        router.visit("/attendance/sections");
      },
    }
  );
};


  return (
    <SimpleLayout title="Mark Attendance">
      {/* Section Header */}
      <h2 className="font-semibold text-gray-800 mb-4 text-center">
        {section.school_class.name} · {section.name}
      </h2>

      {/* ================= MARK MODE ================= */}
      {mode === "mark" && (
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
              onClick={prev}
              disabled={index === 0}
              className="flex-1 py-3 rounded-lg bg-gray-200 text-gray-700 disabled:opacity-50"
            >
              Previous
            </button>

            <button
              onClick={next}
              className="flex-1 py-3 rounded-lg bg-blue-600 text-white"
            >
              {index === records.length - 1
                ? "Review Summary"
                : "Next"}
            </button>
          </div>
        </>
      )}

      {/* ================= SUMMARY MODE ================= */}
      {mode === "summary" && (
        <>
          <div className="space-y-3">
            {records.map((r) => (
              <AttendanceRecordCard
                key={r.student_id}
                name={r.name}
                status={r.status}
                lessonLearned={r.lesson_learned}
                showLesson={isKirtan}
                onStatusChange={(status) =>
                  updateFromSummary(r.student_id, {
                    status,
                  })
                }
                onLessonChange={(value) =>
                  updateFromSummary(r.student_id, {
                    lesson_learned: value,
                  })
                }
              />
            ))}
          </div>

          <button
            onClick={submitAttendance}
            className="w-full bg-green-600 text-white py-3 rounded-lg mt-6"
          >
            Save Attendance
          </button>
        </>
      )}
    </SimpleLayout>
  );
}
