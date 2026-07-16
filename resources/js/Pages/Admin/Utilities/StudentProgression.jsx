import AdminLayout from "@/Layouts/AdminLayout";
import { useState, useMemo, useCallback } from "react";
import PromoteFlow from "./StudentProgression/PromoteFlow";
import PassOutFlow from "./StudentProgression/PassOutFlow";
import { MOCK_STUDENTS, MOCK_CLASSES, MOCK_SECTIONS, MOCK_ENROLLMENTS, resolveNextClassForEnrollments } from "./StudentProgression/mockData";

export default function StudentProgression() {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  const sectionOptions = useMemo(
    () => (classFilter ? MOCK_SECTIONS[classFilter] || [] : []),
    [classFilter]
  );

  const filtered = useMemo(() => {
    let list = MOCK_STUDENTS.filter((s) => s.status === "active");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.fatherName && s.fatherName.toLowerCase().includes(q))
      );
    }
    if (classFilter) {
      list = list.filter((s) => {
        const enrollments = MOCK_ENROLLMENTS[s.id] || [];
        return enrollments.some((e) => e.classId === Number(classFilter));
      });
    }
    if (sectionFilter) {
      list = list.filter((s) => {
        const enrollments = MOCK_ENROLLMENTS[s.id] || [];
        return enrollments.some((e) => e.sectionId === Number(sectionFilter));
      });
    }
    return list;
  }, [search, classFilter, sectionFilter]);

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = filtered.map((s) => s.id);
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
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const openFlow = useCallback((student, action) => {
    setSelectedStudent(student);
    setActiveModal(action);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setSelectedStudent(null);
  }, []);

  const canPromote = useMemo(
    () =>
      selectedIds.size > 0 &&
      Array.from(selectedIds).every((id) => {
        const s = MOCK_STUDENTS.find((st) => st.id === id);
        if (!s) return false;
        const enrollments = MOCK_ENROLLMENTS[id] || [];
        return resolveNextClassForEnrollments(enrollments).length > 0;
      }),
    [selectedIds]
  );

  const hasOutstanding = (student) => student.outstandings > 0;
  const classLabel = (student) => {
    const enrollments = MOCK_ENROLLMENTS[student.id] || [];
    return enrollments.map((e) => e.className).join(", ") || "—";
  };

  return (
    <AdminLayout title="Student Progression">
      <div className="max-w-6xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Student Progression</h1>
          <p className="text-sm text-gray-500 mt-1">
            Promote or pass out active students.
          </p>
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
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSectionFilter("");
              }}
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
          <div className="text-xs text-gray-400 self-center pb-1">
            {filtered.length} student(s)
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
                disabled={!canPromote}
                onClick={() => {
                  const first = MOCK_STUDENTS.find((s) => selectedIds.has(s.id));
                  if (first) openFlow(first, "promote");
                }}
                className="px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Promote Selected
              </button>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const first = MOCK_STUDENTS.find((s) => selectedIds.has(s.id));
                  if (first) openFlow(first, "passOut");
                }}
                className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
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
          {filtered.length === 0 ? (
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
                      checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))}
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Student Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Father Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Current Class</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Type</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Outstanding</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((student) => (
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
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          student.studentType === "free"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {student.studentType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {hasOutstanding(student) ? (
                        <span className="text-red-600 font-medium text-xs">
                          Rs. {student.outstandings.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <ActionButton
                          label="Promote"
                          color="blue"
                          disabled={!resolveNextClassForEnrollments(MOCK_ENROLLMENTS[student.id] || []).length}
                          onClick={() => openFlow(student, "promote")}
                        />
                        <ActionButton
                          label="Pass Out"
                          color="green"
                          onClick={() => openFlow(student, "passOut")}
                        />
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
          onClose={closeModal}
          preselectedIds={selectedIds.size >= 1 ? Array.from(selectedIds) : null}
        />
      )}
      {activeModal === "passOut" && selectedStudent && (
        <PassOutFlow
          student={selectedStudent}
          onClose={closeModal}
          preselectedIds={selectedIds.size >= 1 ? Array.from(selectedIds) : null}
        />
      )}
    </AdminLayout>
  );
}

function ActionButton({ label, color, disabled, onClick }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    green: "bg-green-50 text-green-700 hover:bg-green-100",
  };
  if (disabled) {
    return (
      <span className="text-[11px] text-gray-300 italic" title="No next class available">
        {label}
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-[11px] font-medium transition ${colors[color] || colors.blue}`}
    >
      {label}
    </button>
  );
}
