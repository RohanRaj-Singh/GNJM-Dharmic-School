import { statusBgClass, statusShort } from "../utils";
import { useState } from "react";

/*
 * Calendar grid for one division. Renders the months passed in
 * (one per month in the selected range, not a fixed 12).
 *
 * Pagination: 3 months per page on screen; the PDF renders them all.
 */
const PER_PAGE = 3;

export default function CalendarSection({ title, months, enrolled = true, showLesson = false }) {
  if (!enrolled) {
    return (
      <Wrapper title={`${title} Calendar`}>
        <div className="text-sm text-gray-400">
          Student is not enrolled in {title}.
        </div>
      </Wrapper>
    );
  }

  if (!months || months.length === 0) {
    return (
      <Wrapper title={`${title} Calendar`}>
        <div className="text-sm text-gray-400">No calendar months in range.</div>
      </Wrapper>
    );
  }

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(months.length / PER_PAGE));
  const visible = months.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <Wrapper title={`${title} Calendar`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">
          {months.length} month{months.length === 1 ? "" : "s"} in range
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              ← Prev
            </button>
            <span className="text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visible.map((m) => (
          <MonthCard key={`${m.year}-${m.month}`} month={m} showLesson={showLesson} />
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-3">
        <span><b>P</b> = Present</span>
        <span><b>A</b> = Absent</span>
        <span><b>L</b> = Leave</span>
        <span><b>—</b> = Not marked</span>
        {showLesson && <span><b>✓</b> = Lesson learned</span>}
      </div>
    </Wrapper>
  );
}

function MonthCard({ month, showLesson }) {
  // Build a 5- or 6-row mini calendar starting from the first weekday of the month.
  const firstOfMonth = new Date(month.year, month.month - 1, 1);
  // Sunday=0, convert to Monday=0..Sunday=6
  const firstDow = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border rounded p-2 bg-white">
      <div className="text-center font-semibold text-xs text-gray-700 mb-1">
        {month.label}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] mb-0.5 text-gray-500">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-9" />;
          const cell = month.days?.[String(d)];
          const status = cell?.status;
          const lesson = cell?.lesson_learned;
          return (
            <div
              key={i}
              className={`relative h-9 rounded flex items-center justify-center ${statusBgClass(status)}`}
              title={status ? `Day ${d}: ${status}${lesson ? " (lesson)" : ""}` : `Day ${d}: not marked`}
            >
              <div className="absolute top-0.5 right-1 text-[9px] opacity-60">{d}</div>
              <div className="font-semibold">{statusShort(status)}</div>
              {showLesson && lesson && (
                <div className="absolute bottom-0.5 left-1 text-blue-700 font-bold text-[10px]">✓</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-500 mt-1 text-center">
        P {month.present_count} · A {month.absent_count} · L {month.leave_count}
      </div>
    </div>
  );
}

function Wrapper({ title, children }) {
  return (
    <div className="bg-white border rounded mb-4">
      <div className="px-4 py-2 border-b">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
