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
    section.school_class.name.toLowerCase() === "kirtan";

  /* -------------------------------------------------
   | Normalize helpers (STATE LIVES HERE)
   ------------------------------------------------- */

  const normalizeRecord = (r) => ({
  student_id: r.student_id,
  name: r.name,
  status: r.status,                // ✅ RESPECT DB
  lesson_learned: !!r.lesson_learned,
});


  const normalizeChange = (changes) => {
    if (
      changes.status === "absent" ||
      changes.status === "leave"
    ) {
      return { ...changes, lesson_learned: false };
    }
    return changes;
  };

  /* -------------------------------------------------
   | State
   ------------------------------------------------- */

  const [records, setRecords] = useState(() =>
    hasAttendanceToday
      ? existingAttendance.map(normalizeRecord)
      : section.student_sections.map((ss) => ({
          student_id: ss.student.id,
          name: ss.student.name,
          status: "present",       // ✅ default
          lesson_learned: false,
        }))
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
    console.log("SENDING ATTENDANCE", records);
    router.post(
      "/attendance",
      {

        section_id: section.id,
        attendance: records,
      },
      {
        onSuccess: () => {
          router.visit("/attendance/sections"); // ✅ BACK TO LIST
        },
      }
    );
  };

  /* -------------------------------------------------
   | Render
   ------------------------------------------------- */

  return (
    <SimpleLayout title="Mark Attendance">
      <h2 className="font-semibold text-gray-800 mb-4 text-center">
        {section.school_class.name} · {section.name}
      </h2>

      {/* ================= MARK MODE ================= */}
      {mode === "mark" && (
        <AttendanceMarkPage
          records={records}
          index={index}
          setIndex={setIndex}
          isKirtan={isKirtan}
          updateCurrent={updateCurrent}
          onFinish={() => setMode("summary")}
        />
      )}

      {/* ================= SUMMARY MODE ================= */}
      {mode === "summary" && (
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
