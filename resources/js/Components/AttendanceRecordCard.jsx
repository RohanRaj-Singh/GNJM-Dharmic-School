import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { divisionMeta } from "@/utils/divisionType";

/**
 * Per-student attendance summary card.
 *
 * `showLesson` was a boolean prop the caller computed (`isKirtan`). It's now
 * derived from `divisionMeta(key).hasLessonNotes` — see
 * docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §7.2.
 */
export default function AttendanceRecordCard({
  name,
  fatherName,
  status,
  lessonLearned,
  lessonNote,
  onStatusChange,
  onLessonChange,
  onLessonNoteChange,
  divisionKey = "",
  studentSectionId,
}) {
  const meta = divisionMeta(divisionKey);
  const showLesson = Boolean(meta.hasLessonNotes);
  const lessonDisabled = status === "absent" || status === "leave";

  const [historyNotes, setHistoryNotes] = useState([]);

  useEffect(() => {
    if (!showLesson || !studentSectionId) return;
    let cancelled = false;
    fetch(`/attendance/lesson-notes/${studentSectionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setHistoryNotes(data || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showLesson, studentSectionId]);

  const formatDate = (d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-2">
      {/* Attendance Record Card */}
      <div className="bg-white border-2 rounded-xl p-4 space-y-3">
        <p className="font-medium text-gray-800">{name}</p>
        <p className="text-xs text-gray-500">Father: {fatherName || "-"}</p>

        {/* Status Buttons */}
        <div className="flex gap-2">
          {["present", "absent", "leave"].map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatusChange(s)}
                className={`px-3 py-1 rounded-full text-sm font-medium border-2 transition
                  ${
                    active
                      ? s === "present"
                        ? "bg-green-600 border-green-700 text-white shadow-inner"
                        : s === "absent"
                        ? "bg-red-600 border-red-700 text-white shadow-inner"
                        : "bg-yellow-500 border-yellow-600 text-white shadow-inner"
                      : "bg-white border-gray-300 text-gray-700"
                  }
                `}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Lesson Learned checkbox (only for divisions with lesson notes) */}
        {showLesson && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!lessonDisabled && lessonLearned}
              disabled={lessonDisabled}
              onChange={(e) => onLessonChange(e.target.checked)}
              className="h-4 w-4"
            />
            <span className={lessonDisabled ? "text-gray-400" : "text-gray-600"}>
              Lesson learned
            </span>
          </div>
        )}
      </div>

      {/* Lesson Note + History (only for divisions with lesson notes) */}
      {showLesson && (
        <div className="space-y-2 pl-2">
          {/* Note textarea */}
          <textarea
            value={lessonNote || ""}
            onChange={(e) => onLessonNoteChange(e.target.value)}
            placeholder="How did the student perform today?"
            rows={1}
            className={`w-full border rounded-lg px-2.5 py-1.5 text-sm resize-none outline-none ${meta.bg} ${meta.text}`}
            style={{ borderColor: "currentColor" }}
          />

          {/* History */}
          {historyNotes.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                <BookOpen className="w-3 h-3" />
                <span>Recent Notes</span>
              </div>
              {historyNotes.map((note, i) => (
                <div
                  key={i}
                  className={`${meta.bg} border rounded-lg px-2.5 py-2`}
                  style={{ borderColor: "currentColor" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs ${meta.text} leading-relaxed whitespace-pre-wrap`}>
                      {note.lesson_note}
                    </p>
                    <span className="shrink-0 mt-0.5">
                      {note.lesson_learned ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-200 text-green-700 text-[10px] font-bold">✓</span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-400 text-[10px]">—</span>
                      )}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 font-medium ${meta.accent}`}>
                    {formatDate(note.date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}