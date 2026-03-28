import SimpleLayout from "@/Layouts/SimpleLayout";
import { router } from "@inertiajs/react";
import { useRef, useState } from "react";

import AttendanceMarkPage from "./AttendanceMarkPage";
import AttendanceSummaryPage from "./AttendanceSummaryPage";

export default function Mark({
  section,
  hasAttendanceToday,
  existingAttendance = [],
}) {
  const parseLessonLearned = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      return v === "1" || v === "true";
    }
    return false;
  };

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
    lesson_learned: parseLessonLearned(r.lesson_learned),
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

  const sortRecordsByName = (rows) =>
    [...rows].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
        sensitivity: "base",
      })
    );

  const serializeRecords = (rows) =>
    JSON.stringify(
      rows.map((row) => ({
        student_id: row.student_id,
        status: row.status,
        lesson_learned: !!row.lesson_learned,
      }))
    );

  const initialRecords = hasAttendanceToday
    ? sortRecordsByName(
        existingAttendance
        .map(normalizeExisting)
        .filter((r) => r.student_id)
      )
    : sortRecordsByName(section.student_sections.map(normalizeFresh));

  const [records, setRecords] = useState(() =>
    initialRecords
  );
  const initialSnapshotRef = useRef(serializeRecords(initialRecords));

const [mode, setMode] = useState(
    hasAttendanceToday ? "summary" : "mark"
  );

  const hasUnsavedChanges =
    serializeRecords(records) !== initialSnapshotRef.current;

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
    <SimpleLayout
      title="Mark Attendance"
      hasUnsavedChanges={hasUnsavedChanges}
      alwaysConfirmLeave={true}
      homeRoute="/attendance/sections"
    >
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
