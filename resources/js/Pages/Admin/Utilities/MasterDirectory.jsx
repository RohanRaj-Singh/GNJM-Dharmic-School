import AdminLayout from "@/Layouts/AdminLayout";
import { useState, useMemo, useCallback } from "react";
import { Link } from "@inertiajs/react";
import StatusBadge from "@/Components/StatusBadge";
import Modal from "@/Components/Modal";

/* ── mock data ── */
const MOCK_STUDENTS = [
  { id: 1, name: "Amardeep Singh", fatherName: "Gurpreet Singh", status: "promoted", lastClass: "Gurmukhi Class 2", lastSection: "Pehli", outstandings: 0 },
  { id: 2, name: "Balwinder Kaur", fatherName: "Jaswant Singh", status: "passed_out", lastClass: "Gurmukhi Class 3", lastSection: "Doosri", outstandings: 0 },
  { id: 3, name: "Harpreet Singh", fatherName: "Sukhdev Singh", status: "inactive", lastClass: "Gurmukhi Class 1", lastSection: "Pehli", outstandings: 120 },
  { id: 4, name: "Jaspal Singh", fatherName: "Dalbir Singh", status: "left", lastClass: "Gurmukhi Class 2", lastSection: "Doosri", outstandings: 150 },
  { id: 5, name: "Kulwinder Kaur", fatherName: "Dalbir Singh", status: "promoted", lastClass: "Gurmukhi Class 1", lastSection: "Doosri", outstandings: 0 },
  { id: 6, name: "Manpreet Singh", fatherName: "Amarjit Singh", status: "passed_out", lastClass: "Kirtan (Tabla Advanced)", lastSection: "Tabla", outstandings: 0 },
  { id: 7, name: "Navjot Kaur", fatherName: "Ranbir Singh", status: "inactive", lastClass: "Gurmukhi Class 2", lastSection: "Pehli", outstandings: 300 },
  { id: 8, name: "Simranjit Singh", fatherName: "Kuldeep Singh", status: "left", lastClass: "Gurmukhi Class 3", lastSection: "Pehli", outstandings: 75 },
  { id: 9, name: "Rajveer Kaur", fatherName: "Manjit Singh", status: "promoted", lastClass: "Gurmukhi Class 1", lastSection: "Pehli", outstandings: 0 },
  { id: 10, name: "Harmandeep Singh", fatherName: "Sukhwinder Singh", status: "inactive", lastClass: "Kirtan (Tabla Basic)", lastSection: "Dil Rubab", outstandings: 500 },
];

const MOCK_HISTORY = {
  1: [
    { className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2024-04-01", transferredAt: "2025-03-31", outcome: "promoted", attendance: { present: 280, absent: 12, leave: 5, percentage: 94 }, fees: { charged: 6000, paid: 6000, pending: 0 } },
    { className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2025-04-01", transferredAt: null, outcome: null, attendance: { present: 160, absent: 8, leave: 3, percentage: 93 }, fees: { charged: 3600, paid: 2400, pending: 1200 } },
  ],
  2: [
    { className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2022-04-01", transferredAt: "2023-03-31", outcome: "promoted", attendance: { present: 265, absent: 18, leave: 7, percentage: 91 }, fees: { charged: 4800, paid: 4800, pending: 0 } },
    { className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted", attendance: { present: 272, absent: 10, leave: 4, percentage: 95 }, fees: { charged: 6000, paid: 6000, pending: 0 } },
    { className: "Gurmukhi Class 3", sectionName: "Doosri", startedAt: "2024-04-01", transferredAt: "2026-06-01", outcome: "passed_out", attendance: { present: 410, absent: 22, leave: 10, percentage: 92 }, fees: { charged: 9600, paid: 9600, pending: 0 } },
  ],
  3: [
    { className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2025-04-01", transferredAt: null, outcome: null, attendance: { present: 140, absent: 20, leave: 8, percentage: 83 }, fees: { charged: 2400, paid: 2280, pending: 120 } },
  ],
  4: [
    { className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted", attendance: { present: 258, absent: 15, leave: 6, percentage: 92 }, fees: { charged: 4800, paid: 4800, pending: 0 } },
    { className: "Gurmukhi Class 2", sectionName: "Doosri", startedAt: "2024-04-01", transferredAt: "2026-01-15", outcome: "left", attendance: { present: 320, absent: 35, leave: 12, percentage: 87 }, fees: { charged: 7200, paid: 7050, pending: 150 } },
  ],
  5: [
    { className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2025-04-01", transferredAt: null, outcome: null, attendance: { present: 168, absent: 4, leave: 2, percentage: 96 }, fees: { charged: 2400, paid: 2400, pending: 0 } },
  ],
  6: [
    { className: "Kirtan (Sawal Jawab)", sectionName: "Tabla", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted", attendance: { present: 42, absent: 3, leave: 1, percentage: 91 }, fees: { charged: 0, paid: 0, pending: 0 } },
    { className: "Kirtan (Tabla Basic)", sectionName: "Tabla", startedAt: "2024-04-01", transferredAt: "2025-03-31", outcome: "promoted", attendance: { present: 44, absent: 2, leave: 0, percentage: 95 }, fees: { charged: 0, paid: 0, pending: 0 } },
    { className: "Kirtan (Tabla Advanced)", sectionName: "Tabla", startedAt: "2025-04-01", transferredAt: "2026-06-01", outcome: "passed_out", attendance: { present: 48, absent: 1, leave: 1, percentage: 96 }, fees: { charged: 0, paid: 0, pending: 0 } },
  ],
  7: [
    { className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2024-04-01", transferredAt: "2025-03-31", outcome: "promoted", attendance: { present: 270, absent: 14, leave: 6, percentage: 93 }, fees: { charged: 4800, paid: 4800, pending: 0 } },
    { className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2025-04-01", transferredAt: null, outcome: null, attendance: { present: 150, absent: 18, leave: 5, percentage: 86 }, fees: { charged: 3600, paid: 3300, pending: 300 } },
  ],
  8: [
    { className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2022-04-01", transferredAt: "2023-03-31", outcome: "promoted", attendance: { present: 260, absent: 16, leave: 8, percentage: 91 }, fees: { charged: 4800, paid: 4800, pending: 0 } },
    { className: "Gurmukhi Class 2", sectionName: "Doosri", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted", attendance: { present: 268, absent: 12, leave: 4, percentage: 94 }, fees: { charged: 6000, paid: 6000, pending: 0 } },
    { className: "Gurmukhi Class 3", sectionName: "Pehli", startedAt: "2024-04-01", transferredAt: "2026-02-28", outcome: "left", attendance: { present: 360, absent: 28, leave: 15, percentage: 89 }, fees: { charged: 8400, paid: 8325, pending: 75 } },
  ],
  9: [
    { className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2025-04-01", transferredAt: null, outcome: null, attendance: { present: 172, absent: 2, leave: 1, percentage: 98 }, fees: { charged: 2400, paid: 2400, pending: 0 } },
  ],
  10: [
    { className: "Kirtan (Sawal Jawab)", sectionName: "Dil Rubab", startedAt: "2024-04-01", transferredAt: "2025-03-31", outcome: "promoted", attendance: { present: 38, absent: 4, leave: 2, percentage: 86 }, fees: { charged: 0, paid: 0, pending: 0 } },
    { className: "Kirtan (Tabla Basic)", sectionName: "Dil Rubab", startedAt: "2025-04-01", transferredAt: null, outcome: null, attendance: { present: 40, absent: 5, leave: 1, percentage: 87 }, fees: { charged: 0, paid: 0, pending: 0 } },
  ],
};

const MOCK_CLASSES = [
  { id: 1, name: "Gurmukhi Class 1" },
  { id: 2, name: "Gurmukhi Class 2" },
  { id: 3, name: "Gurmukhi Class 3" },
  { id: 4, name: "Kirtan (Tabla Basic)" },
  { id: 5, name: "Kirtan (Tabla Advanced)" },
];

const MOCK_SECTIONS = {
  1: [{ id: 101, name: "Pehli" }, { id: 102, name: "Doosri" }],
  2: [{ id: 201, name: "Pehli" }, { id: 202, name: "Doosri" }],
  3: [{ id: 301, name: "Pehli" }, { id: 302, name: "Doosri" }],
  4: [{ id: 401, name: "Tabla" }, { id: 402, name: "Dil Rubab" }],
  5: [{ id: 501, name: "Tabla" }],
};
/* ── end mock ── */

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "promoted", label: "Completed" },
  { value: "passed_out", label: "Passed Out" },
  { value: "inactive", label: "Inactive" },
  { value: "left", label: "Left" },
];

const OUTCOME_LABELS = {
  promoted:   { label: "Promoted",   color: "bg-blue-100 text-blue-700 border-blue-200" }, // rendered as text, not badge
  passed_out: { label: "Passed Out", color: "bg-purple-100 text-purple-700 border-purple-200" },
  left:       { label: "Left School", color: "bg-gray-200 text-gray-700 border-gray-300" },
};

export default function MasterDirectory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [viewingStudent, setViewingStudent] = useState(null);

  const sectionOptions = useMemo(
    () => (classFilter ? MOCK_SECTIONS[classFilter] || [] : []),
    [classFilter]
  );

  const filtered = useMemo(() => {
    let list = MOCK_STUDENTS;
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    if (classFilter) {
      const cls = MOCK_CLASSES.find((c) => c.id === Number(classFilter));
      if (cls) list = list.filter((s) => s.lastClass === cls.name);
    }
    if (sectionFilter) {
      const sec = (MOCK_SECTIONS[classFilter] || []).find((s) => s.id === Number(sectionFilter));
      if (sec) list = list.filter((s) => s.lastSection === sec.name);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || (s.fatherName && s.fatherName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [search, statusFilter, classFilter, sectionFilter]);

  const openProfile = useCallback((student) => setViewingStudent(student), []);
  const closeProfile = useCallback(() => setViewingStudent(null), []);

  return (
    <AdminLayout title="Master Directory">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Master Directory</h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse all students by lifecycle status — passed out, inactive, left, completed
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {filtered.length} student(s)
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
              onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); }}
              className="border rounded px-3 py-1.5 text-sm min-w-[160px]"
            >
              <option value="">All Classes</option>
              {MOCK_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              disabled={!classFilter}
              className="border rounded px-3 py-1.5 text-sm min-w-[160px] disabled:bg-gray-100"
            >
              <option value="">All Sections</option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filtered.length === 0 ? (
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
                {filtered.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-blue-50">
                    <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium">{student.name}</td>
                    <td className="px-4 py-2 text-gray-600">{student.fatherName || "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={student.status} /></td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{student.lastClass} — {student.lastSection}</td>
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
                        <span className="px-2 py-1 rounded text-[11px] font-medium bg-amber-50 text-amber-700 cursor-default" title="Fees page coming soon">
                          View Fees
                        </span>
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
          history={MOCK_HISTORY[viewingStudent.id] || []}
          onClose={closeProfile}
        />
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${colors[color] || colors.gray}`}>
      <div className="text-xs uppercase tracking-wider opacity-75">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function AttendanceBar({ percentage }) {
  const color = percentage >= 90 ? "bg-green-500" : percentage >= 75 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 min-w-[36px] text-right">{percentage}%</span>
    </div>
  );
}

function StudentProfileModal({ student, history, onClose }) {
  const current = history.find((e) => e.transferredAt === null) || null;
  const previous = history.filter((e) => e.transferredAt !== null);

  const totals = useMemo(() => {
    let totalPresent = 0, totalAbsent = 0, totalLeave = 0, totalCharged = 0, totalPaid = 0, totalPending = 0;
    let totalMonths = 0;
    history.forEach((e) => {
      if (e.attendance) {
        totalPresent += e.attendance.present || 0;
        totalAbsent += e.attendance.absent || 0;
        totalLeave += e.attendance.leave || 0;
      }
      if (e.fees) {
        totalCharged += e.fees.charged || 0;
        totalPaid += e.fees.paid || 0;
      }
      if (e.startedAt) {
        const s = new Date(e.startedAt);
        const end = e.transferredAt ? new Date(e.transferredAt) : new Date();
        totalMonths += (end.getFullYear() - s.getFullYear()) * 12 + (end.getMonth() - s.getMonth()) + 1;
      }
    });
    totalPending = totalCharged - totalPaid;
    const totalDays = totalPresent + totalAbsent + totalLeave;
    const overallAttendance = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;
    return { totalPresent, totalAbsent, totalLeave, totalDays, overallAttendance, totalCharged, totalPaid, totalPending, totalMonths, totalEnrollments: history.length };
  }, [history]);

  const formatDate = (d) => {
    if (!d) return "Present";
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const duration = (start, end) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (months < 1) return "< 1 month";
    if (months < 12) return `${months} mo`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years} yr ${rem} mo` : `${years} yr`;
  };

  return (
    <Modal show maxWidth="2xl" onClose={onClose}>
      <div className="max-h-[90vh] min-h-0 flex flex-col">
        <div className="p-6 pb-0 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* ── Header ── */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-800">{student.name}</h2>
                <StatusBadge status={student.status} size="md" />
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Father: {student.fatherName || "—"} · {totals.totalEnrollments} enrollment(s) · {totals.totalMonths} month(s) total
              </p>
            </div>
          </div>

          {/* ── Overall Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Attendance" value={`${totals.overallAttendance}%`} color={totals.overallAttendance >= 90 ? "green" : totals.overallAttendance >= 75 ? "amber" : "red"} />
            <StatCard label="Days Attended" value={totals.totalDays} color="blue" />
            <StatCard label="Fees Paid" value={`Rs. ${totals.totalPaid.toLocaleString()}`} color={totals.totalPending === 0 ? "green" : "amber"} />
            <StatCard label="Pending" value={`Rs. ${totals.totalPending.toLocaleString()}`} color={totals.totalPending === 0 ? "green" : "red"} />
          </div>

          {/* ── Outstanding Fees Warning ── */}
          {student.outstandings > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <span className="text-lg">💰</span>
              <p><strong>Outstanding fees:</strong> Rs. {student.outstandings.toLocaleString()}. These remain collectible.</p>
            </div>
          )}

          {/* ── Enrollment Timeline ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📋</span> Enrollment History
            </h3>

            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No enrollment records found.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gray-200" />

                <div className="space-y-4">
                  {history.map((enr, i) => {
                    const isCurrent = enr.transferredAt === null;
                    const outcome = enr.outcome ? OUTCOME_LABELS[enr.outcome] : null;
                    const attPct = enr.attendance ? enr.attendance.percentage : null;
                    const feePending = enr.fees ? enr.fees.charged - enr.fees.paid : 0;

                    return (
                      <div key={i} className="relative pl-10">
                        <div
                          className={`absolute left-[13px] w-3 h-3 rounded-full border-2 mt-1.5 ${
                            isCurrent ? "bg-green-400 border-green-500" : "bg-white border-gray-400"
                          }`}
                        />

                        <div className={`border rounded-lg p-3 ${isCurrent ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {enr.className}
                                {isCurrent && (
                                  <span className="ml-2 text-[10px] bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded">
                                    Current
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {enr.sectionName} · {formatDate(enr.startedAt)} → {formatDate(enr.transferredAt)} · ⏱ {duration(enr.startedAt, enr.transferredAt)}
                              </p>
                            </div>
                            {enr.outcome === "promoted" ? (
                              <span className="text-xs text-blue-600 font-medium">↑ Promoted</span>
                            ) : outcome && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${outcome.color}`}>
                                {outcome.label}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-gray-100">
                            {/* Attendance */}
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Attendance</p>
                              {attPct !== null ? (
                                <div className="space-y-1">
                                  <AttendanceBar percentage={attPct} />
                                  <div className="flex gap-2 text-[10px] text-gray-500">
                                    <span className="text-green-600">P: {enr.attendance.present}</span>
                                    <span className="text-red-600">A: {enr.attendance.absent}</span>
                                    <span className="text-amber-600">L: {enr.attendance.leave}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">No data</p>
                              )}
                            </div>

                            {/* Fees */}
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Fees</p>
                              {enr.fees ? (
                                <div className="space-y-0.5 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Charged:</span>
                                    <span className="font-medium">Rs. {enr.fees.charged.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Paid:</span>
                                    <span className="font-medium text-green-600">Rs. {enr.fees.paid.toLocaleString()}</span>
                                  </div>
                                  {feePending > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Pending:</span>
                                      <span className="font-medium text-red-600">Rs. {feePending.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">No data</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Quick Links ── */}
          <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-gray-600">Quick Links</span>
            <div className="flex gap-2">
              <Link
                href="/admin/student-report-center"
                className="px-2.5 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition text-xs font-medium"
              >
                Full Student Report
              </Link>
              <Link
                href="/admin/reports"
                className="px-2.5 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition text-xs font-medium"
              >
                Fees Report
              </Link>
              <Link
                href="/admin/reports/attendance"
                className="px-2.5 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition text-xs font-medium"
              >
                Attendance Report
              </Link>
            </div>
          </div>

          <div className="h-2" />
        </div>
      </div>
    </Modal>
  );
}
