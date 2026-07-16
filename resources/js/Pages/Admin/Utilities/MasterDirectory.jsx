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
  return (
    <Modal show maxWidth="sm" onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{student.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Father: {student.fatherName || "—"}</p>
          </div>
          <StatusBadge status={student.status} size="md" />
        </div>

        {student.outstandings > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
            <span className="text-lg">💰</span>
            <p><strong>Outstanding fees:</strong> Rs. {student.outstandings.toLocaleString()}</p>
          </div>
        )}

        {student.lastEnrollment && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <p className="text-xs text-gray-500">Last Enrollment</p>
            <p className="font-medium text-gray-800">{student.lastEnrollment.className}</p>
            <p className="text-gray-500">{student.lastEnrollment.sectionName}</p>
            {student.lastEnrollment.outcome && (
              <p className="text-xs text-gray-400">Outcome: {student.lastEnrollment.outcome}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link
            href="/admin/student-report-center"
            className="flex-1 text-center px-3 py-2 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
          >
            Full Report
          </Link>
          <Link
            href={`/students/${student.id}`}
            className="flex-1 text-center px-3 py-2 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
          >
            Profile
          </Link>
        </div>
      </div>
    </Modal>
  );
}
