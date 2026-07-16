import AdminLayout from "@/Layouts/AdminLayout";
import { usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import DirectoryToolbar from "./Components/DirectoryToolbar";
import SummaryBar from "./Components/SummaryBar";
import DataTable from "./Components/DataTable";
import StudentCard from "./Components/StudentCard";
import StudentEditorModal from "./Components/StudentEditorModal";

/* ----------------------------------------
 | Helpers
 ---------------------------------------- */
const safeUUID = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Derive the effective display status from a student's enrollments.
 * Priority: left > passed_out > inactive > promoted > active
 * This is needed because student.status may not reflect the true state
 * when enrollments were changed individually via the Student Status page.
 */
function effectiveStatus(student) {
  const enrollments = student.enrollments || [];
  if (enrollments.length === 0) return student.status || "active";

  const statusPriority = ["left", "passed_out", "inactive", "promoted", "active"];
  let worst = "active";
  for (const e of enrollments) {
    const idx = statusPriority.indexOf(e.status);
    const worstIdx = statusPriority.indexOf(worst);
    if (idx < worstIdx) worst = e.status;
  }
  return worst;
}

function normalizeStudent(s) {
  return {
    ...s,
    enrollments: (s.enrollments || []).map((e) => ({
      id: e.id ?? safeUUID(),
      class_id: String(e.class_id ?? ""),
      section_id: String(e.section_id ?? ""),
      class_name: e.class_name ?? "",
      section_name: e.section_name ?? "",
      student_type: e.student_type ?? "paid",
      status: e.status ?? "active",
    })),
  };
}

export default function Index() {
  /* ----------------------------------------
   | Page props — initial data from the server
   ---------------------------------------- */
  const { students: initialStudents, classes: initialClasses } = usePage().props;

  /* ----------------------------------------
   | State
   ---------------------------------------- */
  const [students, setStudents] = useState(
    () => (initialStudents || []).map(normalizeStudent)
  );
  const [classes] = useState(initialClasses || []);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });

  // Editor modal
  const [editingStudent, setEditingStudent] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  /* ----------------------------------------
   | Load sections when class filter changes
   ---------------------------------------- */
  useEffect(() => {
    if (classFilter === "all") {
      setSectionOptions([]);
      return;
    }
    fetch(`/admin/sections/options?class_id=${classFilter}`)
      .then((r) => r.json())
      .then((sections) => {
        setSectionOptions(
          sections.map((s) => ({ id: String(s.id), name: s.name }))
        );
      })
      .catch(() => setSectionOptions([]));
  }, [classFilter]);

  /* ----------------------------------------
   | Filtered + sorted students
   ---------------------------------------- */
  const filteredStudents = useMemo(() => {
    let result = students;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.father_name || "").toLowerCase().includes(q)
      );
    }

    // Class filter
    if (classFilter !== "all") {
      result = result.filter((s) =>
        (s.enrollments || []).some(
          (e) => String(e.class_id) === String(classFilter)
        )
      );
    }

    // Section filter
    if (sectionFilter !== "all") {
      result = result.filter((s) =>
        (s.enrollments || []).some(
          (e) => String(e.section_id) === String(sectionFilter)
        )
      );
    }

    // Fee type filter
    if (feeFilter !== "all") {
      result = result.filter((s) =>
        (s.enrollments || []).some((e) =>
          feeFilter === "free"
            ? e.student_type === "free"
            : e.student_type !== "free"
        )
      );
    }

    return result;
  }, [students, search, classFilter, sectionFilter, feeFilter]);

  // Sort
  const sortedStudents = useMemo(() => {
    if (!sortConfig.key) return filteredStudents;
    return [...filteredStudents].sort((a, b) => {
      const aVal = (a[sortConfig.key] || "").toString().toLowerCase();
      const bVal = (b[sortConfig.key] || "").toString().toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
  }, [filteredStudents, sortConfig]);

  /* ----------------------------------------
   | Handlers
   ---------------------------------------- */
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleReset = useCallback(() => {
    setSearch("");
    setClassFilter("all");
    setSectionFilter("all");
    setFeeFilter("all");
    setSortConfig({ key: null, dir: "asc" });
  }, []);

  const handleIncludeInactiveToggle = useCallback((newVal) => {
    setIncludeInactive(newVal);
    setLoading(true);
    fetch(`/admin/students/data${newVal ? "?include_inactive=1" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setStudents((data || []).map(normalizeStudent));
      })
      .catch(() => toast.error("Failed to load students"))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = useCallback((student) => {
    setEditingStudent(student);
    setIsEditorOpen(true);
  }, []);

  const handleAddStudent = useCallback(() => {
    setEditingStudent(null);
    setIsEditorOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setIsEditorOpen(false);
    setEditingStudent(null);
  }, []);

  const handleSaved = useCallback(() => {
    setLoading(true);
    fetch(`/admin/students/data${includeInactive ? "?include_inactive=1" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setStudents((data || []).map(normalizeStudent));
      })
      .catch(() => toast.error("Failed to refresh data"))
      .finally(() => setLoading(false));
  }, [includeInactive]);

  /* ----------------------------------------
   | Render
   ---------------------------------------- */
  return (
    <AdminLayout title="Students">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Page heading */}
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Student Directory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View, search, and manage student records.
          </p>
        </div>

        {/* Toolbar */}
        <DirectoryToolbar
          search={search}
          onSearchChange={setSearch}
          classFilter={classFilter}
          onClassFilterChange={setClassFilter}
          sectionFilter={sectionFilter}
          onSectionFilterChange={setSectionFilter}
          sectionOptions={sectionOptions}
          feeFilter={feeFilter}
          onFeeFilterChange={setFeeFilter}
          includeInactive={includeInactive}
          onIncludeInactiveToggle={handleIncludeInactiveToggle}
          onReset={handleReset}
          onAddStudent={handleAddStudent}
          classes={classes}
        />

        {/* Summary */}
        <SummaryBar students={filteredStudents} />

        {/* Loading state */}
        {loading ? (
          <div className="bg-white border rounded-lg p-12 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <DataTable
                students={sortedStudents}
                sortConfig={sortConfig}
                onSort={handleSort}
                onEdit={handleEdit}
                effectiveStatus={effectiveStatus}
              />
            </div>

            {/* Mobile cards */}
            <div className="block md:hidden">
              <StudentCard
                students={sortedStudents}
                onEdit={handleEdit}
                effectiveStatus={effectiveStatus}
              />
            </div>
          </>
        )}

        {/* Editor modal */}
        <StudentEditorModal
          isOpen={isEditorOpen}
          onClose={handleEditorClose}
          student={editingStudent}
          classes={classes}
          onSaved={handleSaved}
        />
      </div>
    </AdminLayout>
  );
}

