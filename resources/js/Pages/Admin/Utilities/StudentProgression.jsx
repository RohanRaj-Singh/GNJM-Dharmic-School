import AdminLayout from "@/Layouts/AdminLayout";
import { useState, useMemo, useCallback, useEffect } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import toast from "react-hot-toast";
import PromoteFlow from "./StudentProgression/PromoteFlow";
import PassOutFlow from "./StudentProgression/PassOutFlow";
import StatusBadge from "@/Components/StatusBadge";

export default function StudentProgression() {
  const { flash } = usePage().props;
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  const fetchStudents = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (classFilter) params.append("class_id", classFilter);
    if (sectionFilter) params.append("section_id", sectionFilter);
    setLoading(true);
    axios.get(`/admin/utilities/student-progression/data?${params}`)
      .then((r) => setStudents(r.data))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [search, classFilter, sectionFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    axios.get("/admin/classes/options").then((r) => setClasses(r.data)).catch(() => {});
    axios.get("/admin/sections/options").then((r) => setSections(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (flash?.success) toast.success(flash.success);
    if (flash?.error) toast.error(flash.error);
  }, [flash]);

  const sectionOptions = useMemo(
    () => sections.filter((s) => String(s.class_id) === classFilter),
    [sections, classFilter]
  );

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = students.map((s) => s.id);
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [students]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const openFlow = useCallback((student, action) => {
    setSelectedStudent(student);
    setActiveModal(action);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setSelectedStudent(null);
    fetchStudents();
  }, [fetchStudents]);

  const classLabel = (student) =>
    student.enrollments?.map((e) => e.className).join(", ") || "—";

  return (
    <AdminLayout title="Student Progression">
      <div className="max-w-6xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Student Progression</h1>
          <p className="text-sm text-gray-500 mt-1">Promote or pass out active students.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Search Student</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or father name..."
              className="border rounded px-3 py-1.5 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class</label>
            <select
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(""); }}
              className="border rounded px-3 py-1.5 text-sm min-w-[160px]"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
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
          <div className="text-xs text-gray-400 self-center pb-1">
            {!loading && `${students.length} student(s)`}
            {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
            <span className="text-sm text-blue-800">
              <strong>{selectedIds.size}</strong> student(s) selected
            </span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => {
                  const first = students.find((s) => selectedIds.has(s.id));
                  if (first) openFlow(first, "promote");
                }}
                className="px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Promote Selected
              </button>
              <button
                onClick={() => {
                  const first = students.find((s) => selectedIds.has(s.id));
                  if (first) openFlow(first, "passOut");
                }}
                className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
              >
                Pass Out Selected
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 rounded text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              {search || classFilter || sectionFilter
                ? "No students match the current filters."
                : "No active students found."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && students.every((s) => selectedIds.has(s.id))}
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Student Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Father Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Current Class</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Type</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Outstanding</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleOne(student.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">{student.name}</td>
                    <td className="px-4 py-2 text-gray-500">{student.fatherName || "—"}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{classLabel(student)}</td>
                    <td className="px-4 py-2 text-center"><StatusBadge status={student.status} /></td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        student.studentType === "free"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-green-100 text-green-700"
                      }`}>{student.studentType}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {student.outstandings > 0 ? (
                        <span className="text-red-600 font-medium text-xs">Rs. {student.outstandings.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => openFlow(student, "promote")}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                        >
                          Promote
                        </button>
                        <button
                          onClick={() => openFlow(student, "passOut")}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-green-50 text-green-700 hover:bg-green-100 transition"
                        >
                          Pass Out
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {activeModal === "promote" && selectedStudent && (
        <PromoteFlow
          student={selectedStudent}
          students={students}
          classes={classes}
          sections={sections}
          onClose={closeModal}
          preselectedIds={selectedIds.size >= 1 ? Array.from(selectedIds) : null}
        />
      )}
      {activeModal === "passOut" && selectedStudent && (
        <PassOutFlow
          student={selectedStudent}
          students={students}
          onClose={closeModal}
          preselectedIds={selectedIds.size >= 1 ? Array.from(selectedIds) : null}
        />
      )}
    </AdminLayout>
  );
}
