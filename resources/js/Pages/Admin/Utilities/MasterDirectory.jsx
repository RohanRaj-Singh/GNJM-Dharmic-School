import AdminLayout from "@/Layouts/AdminLayout";
import { useState, useCallback, useEffect } from "react";
import { Link } from "@inertiajs/react";
import StatusBadge from "@/Components/StatusBadge";
import Modal from "@/Components/Modal";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "promoted", label: "Completed" },
  { value: "passed_out", label: "Passed Out" },
  { value: "left", label: "Left" },
];

export default function MasterDirectory() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [viewingStudent, setViewingStudent] = useState(null);

  useEffect(() => {
    window.axios.get("/admin/classes/options").then((r) => setClasses(r.data)).catch(() => {});
  }, []);

  const fetchStudents = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (statusFilter) params.append("status", statusFilter);
    if (classFilter) params.append("class_id", classFilter);

    window.axios.get(`/admin/utilities/master-directory/data?${params}`)
      .then((r) => setStudents(r.data))
      .catch((e) => { console.error("MasterDirectory fetch failed:", e.response?.status, e.response?.data); setStudents([]); })
      .finally(() => setLoading(false));
  }, [search, statusFilter, classFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const openProfile = useCallback((student) => setViewingStudent(student), []);
  const closeProfile = useCallback(() => setViewingStudent(null), []);

  return (
    <AdminLayout title="Master Directory">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Master Directory</h1>
            <p className="text-sm text-gray-500 mt-1">
              Complete student directory — all statuses, all enrollments.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {loading ? "..." : `${students.length} student(s)`}
          </span>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Student or father name..."
              className="border rounded px-3 py-1.5 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm min-w-[140px]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm min-w-[160px]"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No students match the current filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">#</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Student Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Father Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Last Class / Section</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Outstanding</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-blue-50">
                    <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium">{student.name}</td>
                    <td className="px-4 py-2 text-gray-600">{student.fatherName || "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={student.status} /></td>
                    <td className="px-4 py-2 text-gray-600 text-xs">
                      {student.lastEnrollment
                        ? `${student.lastEnrollment.className} — ${student.lastEnrollment.sectionName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {student.outstandings > 0 ? (
                        <span className="text-red-600 font-medium text-xs">Rs. {student.outstandings.toLocaleString()}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1.5 justify-center">
                        <button
                          onClick={() => openProfile(student)}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                        >
                          View Profile
                        </button>
                        <Link
                          href="/admin/student-report-center"
                          className="px-2 py-1 rounded text-[11px] font-medium bg-green-50 text-green-700 hover:bg-green-100 transition"
                        >
                          View Report
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {viewingStudent && (
        <StudentProfileModal
          student={viewingStudent}
          onClose={closeProfile}
        />
      )}
    </AdminLayout>
  );
}

function StudentProfileModal({ student, onClose }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!student?.id) return;
    setLoading(true);
    setError(null);
    window.axios
      .get(`/admin/students/${student.id}/enrollment-history`)
      .then((r) => setEnrollments(r.data))
      .catch(() => setError("Could not load enrollment history."))
      .finally(() => setLoading(false));
  }, [student?.id]);

  // ── Derived totals across all enrollments ──
  const totals = enrollments.reduce(
    (acc, e) => {
      acc.present += e.attendance.present;
      acc.absent += e.attendance.absent;
      acc.leave += e.attendance.leave;
      acc.charged += e.fees.charged;
      acc.paid += e.fees.paid;
      return acc;
    },
    { present: 0, absent: 0, leave: 0, charged: 0, paid: 0 }
  );
  const totalDays = totals.present + totals.absent + totals.leave;
  const attendancePct = totalDays > 0 ? Math.round((totals.present / totalDays) * 100) : 0;
  const pendingFees = totals.charged - totals.paid;

  const isCurrent = (e) => !e.transferredAt;

  const formatDuration = (start, end) => {
    if (!start) return "—";
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    let months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
    if (months < 0) months = 0;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years > 0) return rem > 0 ? `${years}y ${rem}m` : `${years} yr`;
    return `${months} mo`;
  };

  return (
    <Modal show maxWidth="2xl" onClose={onClose}>
      <div className="max-h-[85vh] min-h-0 flex flex-col">
        {/* ── Fixed Header ── */}
        <div className="shrink-0 flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800 truncate">{student.name}</h2>
              <StatusBadge status={student.status} size="md" />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Father: {student.fatherName || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-gray-500">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Loading enrollment history…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  window.axios
                    .get(`/admin/students/${student.id}/enrollment-history`)
                    .then((r) => setEnrollments(r.data))
                    .catch(() => setError("Could not load enrollment history."))
                    .finally(() => setLoading(false));
                }}
                className="px-3 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 font-medium transition shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Data loaded */}
          {!loading && !error && (
            <>
              {/* ── Summary Cards ── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Overall Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Attendance % */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-800">
                        {totalDays > 0 ? attendancePct : "—"}
                      </span>
                      {totalDays > 0 && <span className="text-sm text-gray-500">%</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Attendance</p>
                    {totalDays > 0 && (
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 mt-2">
                        <div className="bg-green-500 transition-all" style={{ width: `${attendancePct}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Days Attended */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-gray-800">{totals.present}</div>
                    <p className="text-xs text-gray-500 mt-1">Days Attended</p>
                  </div>

                  {/* Fees Paid */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-green-700">
                      Rs. {totals.paid.toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Fees Paid</p>
                  </div>

                  {/* Pending */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className={`text-2xl font-bold ${pendingFees > 0 ? "text-red-600" : "text-gray-800"}`}>
                      {pendingFees > 0 ? `Rs. ${pendingFees.toLocaleString()}` : "—"}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Pending Fees</p>
                  </div>
                </div>
              </div>

              {/* ── Enrollment Timeline ── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Enrollment History</h3>

                {enrollments.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-500">
                    No enrollment records found for this student.
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-gray-100" aria-hidden="true" />

                    <div className="space-y-5">
                      {enrollments.map((e) => {
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
                                      {e.className}
                                    </span>
                                    <span className="text-gray-400">—</span>
                                    <span className="text-gray-600 text-sm">{e.sectionName}</span>
                                    {current && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {e.startedAt || "?"}
                                    <span className="mx-1">→</span>
                                    {e.transferredAt || "Present"}
                                    <span className="mx-1.5 text-gray-300">·</span>
                                    <span className="text-gray-400">
                                      {formatDuration(e.startedAt, e.transferredAt)}
                                    </span>
                                  </p>
                                </div>

                                {/* Outcome */}
                                <div className="shrink-0">
                                  {e.outcome === "promoted" ? (
                                    <span className="text-xs font-semibold text-blue-600 flex items-center gap-0.5 whitespace-nowrap">
                                      <span aria-hidden="true">↑</span> Promoted
                                    </span>
                                  ) : e.outcome === "passed_out" ? (
                                    <StatusBadge status="passed_out" size="sm" />
                                  ) : e.outcome === "left" ? (
                                    <StatusBadge status="left" size="sm" />
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
                )}
              </div>
            </>
          )}

          {/* ── Quick Links ── */}
          {!loading && !error && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Links</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/student-report-center"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                >
                  Full Report
                </Link>
                <Link
                  href={`/students/${student.id}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                >
                  Fees Report
                </Link>
                <Link
                  href={`/students/${student.id}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
                >
                  Attendance Report
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
