import { useEffect, useMemo, useState } from "react";

export default function EditorEnrollments({
  enrollments,
  classes,
  sectionsCache,
  loadSections,
  onChange,
  onRemove,
  onAdd,
}) {
  /* ----------------------------------------
   | Preload sections for existing classes
   ---------------------------------------- */
  useEffect(() => {
    enrollments.forEach((e) => {
      if (e.class_id) loadSections(e.class_id);
    });
  }, [enrollments, loadSections]);

  /* ----------------------------------------
   | Determine which class IDs are already
   | taken so we don't show duplicates.
   ---------------------------------------- */
  const selectedClassIds = useMemo(
    () =>
      enrollments
        .map((e) => String(e.class_id))
        .filter(Boolean),
    [enrollments]
  );

  /* ----------------------------------------
   | Render
   ---------------------------------------- */
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-700">Enrollments</h3>

      {enrollments.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          No enrollments yet. Add one below.
        </p>
      )}

      {enrollments.map((e) => {
        const classOptions = classes.filter(
          (cls) =>
            !selectedClassIds.includes(String(cls.id)) ||
            String(cls.id) === String(e.class_id)
        );

        const sections =
          sectionsCache[String(e.class_id)] || [];

        const isFree = e.student_type === "free";
        const isInactive = e.status === "inactive";

        return (
          <div
            key={e.id}
            className="flex flex-wrap items-center gap-2 p-3 rounded border bg-white"
          >
            {/* Class */}
            <select
              value={String(e.class_id || "")}
              onChange={(ev) => {
                const classId = ev.target.value;
                onChange(e.id, "class_id", classId);
                onChange(e.id, "section_id", "");
                if (classId) loadSections(classId);
              }}
              className="border px-2 py-1.5 rounded text-sm min-w-[140px]"
            >
              <option value="">Select Class</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name}
                </option>
              ))}
            </select>

            {/* Section */}
            <select
              value={String(e.section_id || "")}
              onChange={(ev) =>
                onChange(e.id, "section_id", ev.target.value)
              }
              disabled={!e.class_id}
              className="border px-2 py-1.5 rounded text-sm min-w-[140px] disabled:bg-gray-100"
            >
              <option value="">
                {e.class_id ? "Select Section" : "Select class first"}
              </option>
              {sections.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Paid / Free pill toggle */}
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => onChange(e.id, "student_type", "paid")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  !isFree
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => onChange(e.id, "student_type", "free")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  isFree
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                Free
              </button>
            </div>

            {/* Remove */}
            {!isInactive && (
              <button
                type="button"
                onClick={() => onRemove(e.id)}
                className="ml-auto text-red-500 hover:text-red-700 p-1"
                title="Remove enrollment"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Status indicator */}
            {isInactive && (
              <span className="text-xs text-amber-600 font-medium ml-auto">
                Inactive
              </span>
            )}
          </div>
        );
      })}

      {/* Add Enrollment */}
      <button
        type="button"
        onClick={onAdd}
        className="text-blue-600 text-sm font-medium hover:text-blue-800 transition-colors"
      >
        + Add Enrollment
      </button>
    </div>
  );
}
