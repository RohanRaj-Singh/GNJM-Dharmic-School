import SimpleLayout from "@/Layouts/SimpleLayout";
import { router } from "@inertiajs/react";
import { useState } from "react";

import AttendanceMarkPage from "./AttendanceMarkPage";
import AttendanceSummaryPage from "./AttendanceSummaryPage";

export default function Mark({
  section,
  hasAttendanceToday,
  existingAttendance = [],
}) {
  const isKirtan =
    section.school_class.type === "kirtan";

  /* -------------------------------------------------
   | Normalize helpers
   ------------------------------------------------- */

  const normalizeExisting = (r) => ({
  student_id: r.student_section?.student?.id,
  name: r.student_section?.student?.name ?? "Unknown",
  status: r.status ?? "present",
  lesson_learned: !!r.lesson_learned,
});

  const normalizeFresh = (ss) => ({
    student_id: ss.student.id,
    name: ss.student.name,
    status: "present",
    lesson_learned: false,
  });

  const normalizeChange = (changes) => {
    if (changes.status === "absent" || changes.status === "leave") {
      return { ...changes, lesson_learned: false };
    }
    return changes;
  };

  /* -------------------------------------------------
   | State (SINGLE SOURCE OF TRUTH)
   ------------------------------------------------- */

  const [records, setRecords] = useState(() =>
  hasAttendanceToday
    ? existingAttendance
        .map(normalizeExisting)
        .filter(r => r.student_id)   // 🛡 GUARANTEE UNIQUE ID
    : section.student_sections.map(normalizeFresh)
);


  const [mode, setMode] = useState(
    hasAttendanceToday ? "summary" : "mark"
  );

  const [index, setIndex] = useState(0);

  /* -------------------------------------------------
   | Update handlers
   ------------------------------------------------- */

  const updateCurrent = (changes) => {
    setRecords((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, ...normalizeChange(changes) }
          : r
      )
    );
  };

  const updateRecord = (studentId, changes) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.student_id === studentId
          ? { ...r, ...normalizeChange(changes) }
          : r
      )
    );
  };

  /* -------------------------------------------------
   | Save
   ------------------------------------------------- */

  const saveAttendance = () => {
    router.post(
      "/attendance",
      {
        section_id: section.id,
        attendance: records,
      },
      {
        onSuccess: () => {
          router.visit("/attendance/sections");
        },
      }
    );
  };

  /* -------------------------------------------------
   | Render
   ------------------------------------------------- */
  console.log("RECORDS DEBUG", records);

  return (
    <SimpleLayout title="Mark Attendance">
      <h2 className="font-semibold text-gray-800 mb-4 text-center">
        {section.school_class.name} · {section.name}
      </h2>

      {records.length === 0 && (
        <p className="text-center text-gray-500">
          No students found in this section
        </p>
      )}

      {mode === "mark" && records.length > 0 && (
        <AttendanceMarkPage
          records={records}
          index={index}
          setIndex={setIndex}
          isKirtan={isKirtan}
          updateCurrent={updateCurrent}
          onFinish={() => setMode("summary")}
        />
      )}

      {mode === "summary" && records.length > 0 && (
        <AttendanceSummaryPage
          records={records}
          isKirtan={isKirtan}
          updateRecord={updateRecord}
          onSave={saveAttendance}
        />
      )}
    </SimpleLayout>
  );
}
