import { useEffect, useMemo } from "react";

export default function EnrollmentsCell({
  row,
  classes,
  sectionsByClass,
  loadSections,
  setData,
  setIsDirty,
}) {
  const enrollments = row.original.enrollments ?? [];

  /* ----------------------------------------
   | Preload sections when class exists
   ---------------------------------------- */
  useEffect(() => {
    enrollments.forEach((e) => {
      if (e.class_id) loadSections(e.class_id);
    });
  }, [enrollments, loadSections]);

  /* ----------------------------------------
   | Selected class ids (STRING SAFE)
   ---------------------------------------- */
  const selectedClassIds = useMemo(
    () =>
      enrollments
        .map((e) => String(e.class_id))
        .filter(Boolean),
    [enrollments]
  );

  /* ----------------------------------------
   | Helpers
   ---------------------------------------- */
  function updateEnrollment(enrollmentId, key, value) {
    setData((prev) =>
      prev.map((r, rIdx) =>
        rIdx !== row.index
          ? r
          : {
              ...r,
              enrollments: r.enrollments.map((e) =>
                e.id === enrollmentId ? { ...e, [key]: value } : e
              ),
            }
      )
    );
    setIsDirty(true);
  }

  function addEnrollment() {
    setData((prev) =>
      prev.map((r, rIdx) =>
        rIdx !== row.index
          ? r
          : {
              ...r,
              enrollments: [
                ...enrollments,
                {
                  id: crypto.randomUUID(),
                  class_id: "",
                  section_id: "",
                },
              ],
            }
      )
    );
    setIsDirty(true);
  }

  function removeEnrollment(enrollmentId) {
    setData((prev) =>
      prev.map((r, rIdx) =>
        rIdx !== row.index
          ? r
          : {
              ...r,
              enrollments: r.enrollments.filter(
                (e) => e.id !== enrollmentId
              ),
            }
      )
    );
    setIsDirty(true);
  }

  /* ----------------------------------------
   | Render
   ---------------------------------------- */
  return (
    <div className="flex flex-col gap-2 min-w-[260px]">
      {enrollments.map((e) => {
        const classesReady = classes.length > 0;

        const classOptions = classes.filter(
          (cls) =>
            !selectedClassIds.includes(String(cls.id)) ||
            String(cls.id) === String(e.class_id)
        );

        const sectionsReady =
          !!e.class_id &&
          Array.isArray(sectionsByClass[String(e.class_id)]);

        const sectionOptions =
          sectionsByClass[String(e.class_id)] || [];

        return (
          <div key={e.id} className="flex gap-2 items-center">
            {/* ---------- Class ---------- */}
            <select
              key={`class-${e.id}-${classes.length}`}
              disabled={!classesReady}
              value={classesReady ? String(e.class_id ?? "") : ""}
              onChange={(ev) => {
                const classId = ev.target.value;
                updateEnrollment(e.id, "class_id", classId);
                updateEnrollment(e.id, "section_id", "");
                loadSections(classId);
              }}
              className="border px-2 py-1 rounded text-sm disabled:bg-gray-100"
            >
              <option value="">
                {classesReady ? "Class" : "Loading…"}
              </option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name}
                </option>
              ))}
            </select>

            {/* ---------- Section ---------- */}
            <select
              key={`section-${e.id}-${sectionsReady ? "ready" : "wait"}`}
              disabled={!sectionsReady}
              value={sectionsReady ? String(e.section_id ?? "") : ""}
              onChange={(ev) =>
                updateEnrollment(
                  e.id,
                  "section_id",
                  ev.target.value
                )
              }
              className="border px-2 py-1 rounded text-sm disabled:bg-gray-100"
            >
              <option value="">
                {sectionsReady ? "Section" : "Loading…"}
              </option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* ---------- Remove ---------- */}
            <button
              type="button"
              onClick={() => removeEnrollment(e.id)}
              className="text-red-600 text-sm"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* ---------- Add ---------- */}
      <button
        type="button"
        onClick={addEnrollment}
        className="text-blue-600 text-xs self-start mt-1"
      >
        + Add Enrollment
      </button>
    </div>
  );
}
