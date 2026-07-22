/*
 * History Timeline — shows all past enrollments with rolled-up stats,
 * independent of the selected date range.
 *
 * Mirrors the Master Directory's enrollment-history timeline, but receives
 * data from the report response rather than making a separate API call.
 */

function formatDuration(start, end) {
  if (!start) return "—";
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  let months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0) return rem > 0 ? `${years}y ${rem}m` : `${years} yr`;
  return `${months} mo`;
}

export default function HistoryTimeline({ history = [] }) {
  if (history.length === 0) return null;

  const isCurrent = (e) => e.status === "active" && !e.transferred_at;

  return (
    <div className="bg-white border rounded-lg p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Enrollment History
      </h3>

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-gray-100" aria-hidden="true" />

        <div className="space-y-5">
          {history.map((e) => {
            const current = isCurrent(e);
            const totalE = e.attendance.present + e.attendance.absent + e.attendance.leave;
            const pct = totalE > 0 ? Math.round((e.attendance.present / totalE) * 100) : 0;
            const pPct = totalE > 0 ? (e.attendance.present / totalE) * 100 : 0;
            const aPct = totalE > 0 ? (e.attendance.absent / totalE) * 100 : 0;
            const lPct = totalE > 0 ? (e.attendance.leave / totalE) * 100 : 0;
            const pending = e.fees.charged - e.fees.paid;

            return (
              <div key={e.id} className="relative pl-12">
                {/* Timeline dot */}
                <div
                  className={`absolute left-[11px] top-[5px] w-[18px] h-[18px] rounded-full border-2 bg-white flex items-center justify-center z-10 ${
                    current ? "border-green-500" : "border-gray-300"
                  }`}
                >
                  {current && <div className="w-[8px] h-[8px] rounded-full bg-green-500" />}
                </div>

                {/* Card */}
                <div
                  className={`rounded-lg border p-4 ${
                    current
                      ? "border-green-300 bg-green-50/30"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 text-sm">
                          {e.class_name}
                        </span>
                        <span className="text-gray-400">—</span>
                        <span className="text-gray-600 text-sm">{e.section_name}</span>
                        {current && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {e.started_at || "?"}
                        <span className="mx-1">→</span>
                        {e.transferred_at || "Present"}
                        <span className="mx-1.5 text-gray-300">·</span>
                        <span className="text-gray-400">
                          {formatDuration(e.started_at, e.transferred_at)}
                        </span>
                      </p>
                    </div>

                    {/* Outcome badge */}
                    <div className="shrink-0">
                      {e.outcome === "promoted" ? (
                        <span className="text-xs font-semibold text-blue-600 flex items-center gap-0.5 whitespace-nowrap">
                          <span aria-hidden="true">↑</span> Promoted
                        </span>
                      ) : e.outcome === "passed_out" ? (
                        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          Passed Out
                        </span>
                      ) : e.outcome === "left" ? (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Left
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Attendance breakdown */}
                  {totalE > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Attendance</span>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                        {pPct > 0 && (
                          <div className="bg-green-500 transition-all" style={{ width: `${pPct}%` }} />
                        )}
                        {aPct > 0 && (
                          <div className="bg-red-500 transition-all" style={{ width: `${aPct}%` }} />
                        )}
                        {lPct > 0 && (
                          <div className="bg-yellow-500 transition-all" style={{ width: `${lPct}%` }} />
                        )}
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[11px] text-green-700 font-medium">
                          P: {e.attendance.present}
                        </span>
                        <span className="text-[11px] text-red-600 font-medium">
                          A: {e.attendance.absent}
                        </span>
                        <span className="text-[11px] text-yellow-600 font-medium">
                          L: {e.attendance.leave}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Fees breakdown */}
                  {e.fees.charged > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-600">Fees</span>
                        <span className="font-semibold text-gray-800">
                          Rs. {e.fees.paid.toLocaleString()} / Rs. {e.fees.charged.toLocaleString()}
                        </span>
                      </div>
                      {pending > 0 ? (
                        <p className="text-[11px] text-red-600 font-medium mt-0.5">
                          Pending: Rs. {pending.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-[11px] text-green-600 font-medium mt-0.5">
                          Cleared
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
