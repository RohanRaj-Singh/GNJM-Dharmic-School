import { formatPercent } from "../utils";

/*
 * Attendance summary for one division.
 * Mirrors `AttendanceSummary::toArray()`.
 */
export default function AttendanceSection({ title, attendance, enrolled = true, monthCount = 0 }) {
  if (!enrolled) {
    return (
      <Section title={`${title} Attendance`}>
        <div className="text-sm text-gray-400">
          Student is not enrolled in {title}. No attendance to show.
        </div>
      </Section>
    );
  }

  const a = attendance;
  const hasData = a.marked_days > 0;

  return (
    <Section title={`${title} Attendance`}>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Stat label="Present" value={a.present}                tone="green" />
        <Stat label="Absent"  value={a.absent}                 tone="red" />
        <Stat label="Leave"   value={a.leave}                  tone="amber" />
        <Stat label="Marked"  value={a.marked_days} />
        <Stat
          label="Attendance %"
          value={hasData ? formatPercent(a.percentage, 2) : "—"}
          tone={hasData && a.percentage >= 85 ? "green"
              : hasData && a.percentage >= 70 ? "blue"
              : hasData && a.percentage >= 50 ? "amber"
              : hasData ? "red" : null}
        />
      </div>

      {a.current_streak_length > 0 && a.current_streak_status && (
        <p className="text-sm text-gray-600">
          Current streak:{" "}
          <span className="font-medium text-gray-800">
            {a.current_streak_length} day{a.current_streak_length === 1 ? "" : "s"} of {a.current_streak_status}
          </span>
        </p>
      )}

      {monthCount > 0 && !hasData && (
        <p className="text-sm text-gray-400 mt-1">
          No attendance marked in the {monthCount}-month range.
        </p>
      )}
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border rounded mb-4">
      <div className="px-4 py-2 border-b">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    red:   "text-red-700",
    green: "text-green-700",
    blue:  "text-blue-700",
    amber: "text-amber-700",
  };
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${tones[tone] || "text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}
