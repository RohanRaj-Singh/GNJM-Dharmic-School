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
  const classTypeToken = (cls) => {
    const typeText = String(cls?.type ?? "").trim().toLowerCase();
    const nameText = String(cls?.name ?? "").trim().toLowerCase();
    const hay = `${typeText} ${nameText}`.trim();
    if (hay.includes("kirtan")) return "kirtan";
    if (hay.includes("gurmukhi")) return "gurmukhi";
    return "";
  };

  const isKirtan = classTypeToken(section.school_class) === "kirtan";
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, { weekday: "long" });
  const dateLabel = now.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const normalizeExisting = (r) => ({
    student_id: r.student_section?.student?.id,
    name: r.student_section?.student?.name ?? "Unknown",
    father_name: r.student_section?.student?.father_name ?? null,
    status: r.status ?? "present",
    lesson_learned: !!r.lesson_learned,
  });

  const normalizeFresh = (ss) => ({
    student_id: ss.student.id,
    name: ss.student.name,
    father_name: ss.student.father_name ?? null,
    status: "present",
    lesson_learned: false,
  });

  const normalizeChange = (changes) => {
    if (changes.status === "absent" || changes.status === "leave") {
      return { ...changes, lesson_learned: false };
    }
    return changes;
  };

  const [records, setRecords] = useState(() =>
    hasAttendanceToday
      ? existingAttendance
          .map(normalizeExisting)
          .filter((r) => r.student_id)
      : section.student_sections.map(normalizeFresh)
  );

  const [mode, setMode] = useState(
    hasAttendanceToday ? "summary" : "mark"
  );

  const [index, setIndex] = useState(0);

  const updateCurrent = (changes) => {
    setRecords((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...normalizeChange(changes) } : r))
    );
  };

  const updateRecord = (studentId, changes) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.student_id === studentId ? { ...r, ...normalizeChange(changes) } : r
      )
    );
  };

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

  return (
    <SimpleLayout title="Mark Attendance">
      <h2 className="font-semibold text-gray-800 mb-2 text-center">
        {section.school_class.name} - {section.name}
      </h2>
      <p className="text-center text-xs text-gray-500 mb-4">
        {dayLabel}, {dateLabel}
      </p>

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
