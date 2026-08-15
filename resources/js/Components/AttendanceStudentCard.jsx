import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { divisionMeta } from "@/utils/divisionType";

/**
 * Per-student attendance card.
 *
 * The "show lesson notes?" decision used to be a boolean `isKirtan` prop
 * the caller had to compute. That's now driven by `divisionMeta(key).hasLessonNotes`
 * — see docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §7.2.
 * Kirtan alone has `hasLessonNotes=true` today; a future Music/Tabla division
 * opts in by adding to LEGACY_META (no JSX change here).
 */
export default function AttendanceStudentCard({
  student,
  divisionKey = "",
  onStatusChange,
  onLessonChange,
  onLessonNoteChange,
}) {
  const meta = divisionMeta(divisionKey);
  const hasLessonNotes = Boolean(meta.hasLessonNotes);
  const isDisabledLesson =
    student.status === "absent" || student.status === "leave";

  const [historyNotes, setHistoryNotes] = useState([]);

  useEffect(() => {
    if (!hasLessonNotes || !student.student_section_id) return;
    let cancelled = false;
    fetch(`/attendance/lesson-notes/${student.student_section_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setHistoryNotes(data || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [hasLessonNotes, student.student_section_id]);

  const formatDate = (d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-4">
      {/* Attendance Mark Card */}
      <div className="bg-white border-2 rounded-2xl p-6 space-y-6">

        {/* Student Name */}
        <h3 className="text-xl font-semibold text-gray-800 text-center">
          {student.name}
        </h3>
        <p className="text-sm text-gray-500 text-center -mt-4">
          Father: {student.father_name || "-"}
        </p>

        {/* Attendance Buttons */}
        <div className="grid grid-cols-3 gap-3">
          {["present", "absent", "leave"].map((status) => {
            const active = student.status === status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                className={`py-4 rounded-xl text-base font-semibold border-2 transition
                  ${
                    active
                      ? status === "present"
                        ? "bg-green-600 border-green-700 text-white shadow-inner"
                        : status === "absent"
                        ? "bg-red-600 border-red-700 text-white shadow-inner"
                        : "bg-yellow-500 border-yellow-600 text-white shadow-inner"
                      : "bg-white border-gray-300 text-gray-700"
                  }
                `}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Lesson Learned (only for divisions with lesson notes) */}
        {hasLessonNotes && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <input
              type="checkbox"
              checked={!isDisabledLesson && student.lesson_learned}
              disabled={isDisabledLesson}
              onChange={(e) => onLessonChange(e.target.checked)}
              className="h-5 w-5"
            />
            <span
              className={`text-sm ${
                isDisabledLesson ? "text-gray-400" : "text-gray-700"
              }`}
            >
              Lesson learned
            </span>
          </div>
        )}
      </div>

      {/* Lesson Note Section (only for divisions with lesson notes) */}
      {hasLessonNotes && (
        <div className="space-y-3">
          {/* Lesson Note Textarea */}
          <div className="bg-white border-2 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Lesson Note
            </label>
            <textarea
              value={student.lesson_note || ""}
              onChange={(e) => onLessonNoteChange(e.target.value)}
              placeholder="How did the student perform today?"
              rows={2}
              className={`w-full border rounded-lg px-3 py-2 text-sm resize-none outline-none ${meta.bg} ${meta.text} focus:ring-2 focus:border-transparent`}
              style={{ borderColor: "currentColor" }}
            />
          </div>

          {/* Lesson Note History (last 3 classes) */}
          {historyNotes.length > 0 && (
            <div className="bg-white border-2 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Recent Lesson Notes</span>
              </div>
              <div className="space-y-2">
                {historyNotes.map((note, i) => (
                  <div
                    key={i}
                    className={`${meta.bg} border rounded-lg px-3 py-2.5`}
                    style={{ borderColor: "currentColor" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${meta.text} leading-relaxed whitespace-pre-wrap`}>
                        {note.lesson_note}
                      </p>
                      <span className="shrink-0 mt-0.5">
                        {note.lesson_learned ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-200 text-green-700 text-xs font-bold">✓</span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-xs">—</span>
                        )}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-1 font-medium ${meta.accent}`}>
                      {formatDate(note.date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}