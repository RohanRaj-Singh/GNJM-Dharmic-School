import AdminLayout from "@/Layouts/AdminLayout";
import { usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";

import StatusBadge from "@/Components/StatusBadge";
import DataTable from "@/Components/DataTable";
import DirectoryToolbar from "./Components/DirectoryToolbar";
import SummaryBar from "./Components/SummaryBar";
import StudentCard from "./Components/StudentCard";
import StudentEditorModal from "./Components/StudentEditorModal";

const safeUUID = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
}
function effectiveStatus(student) {
  const enrollments = student.enrollments || [];
  if (enrollments.length === 0) return student.status || "active";

  const statusPriority = ["left", "passed_out", "inactive", "promoted", "active"];
  let worst = "active";
  for (const e of enrollments) {
    const idx = statusPriority.indexOf(e.status);
    const worstIdx = statusPriority.indexOf(worst);
    if (idx >= 0 && idx < worstIdx) worst = e.status;
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
  const { students: initialStudents, classes: initialClasses } = usePage().props;

  const [students, setStudents] = useState(() => (initialStudents || []).map(normalizeStudent));
  const [classes] = useState(initialClasses || []);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sectionOptions, setSectionOptions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });

  const [editingStudent, setEditingStudent] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDone, setDeleteDone] = useState(false);

  useEffect(() => {
    if (classFilter === "all") {
      setSectionOptions([]);
      return;
    }
    fetch(`/admin/sections/options?class_id=${classFilter}`)
      .then((r) => r.json())
      .then((sections) => {
        setSectionOptions(sections.map((s) => ({ id: String(s.id), name: s.name })));
      })
      .catch(() => setSectionOptions([]));
  }, [classFilter]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.father_name || "").toLowerCase().includes(q)
      );
    }
    if (classFilter !== "all") {
      result = result.filter((s) =>
        (s.enrollments || []).some((e) => String(e.class_id) === String(classFilter))
      );
    }
    if (sectionFilter !== "all") {
      result = result.filter((s) =>
        (s.enrollments || []).some((e) => String(e.section_id) === String(sectionFilter))
      );
    }
    if (feeFilter !== "all") {
      result = result.filter((s) =>
        (s.enrollments || []).some((e) =>
          feeFilter === "free" ? e.student_type === "free" : e.student_type !== "free"
        )
      );
    }
    return result;
  }, [students, search, classFilter, sectionFilter, feeFilter]);

  const sortedStudents = useMemo(() => {
    if (!sortConfig.key) return filteredStudents;
    return [...filteredStudents].sort((a, b) => {
      const aVal = (a[sortConfig.key] || "").toString().toLowerCase();
      const bVal = (b[sortConfig.key] || "").toString().toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortConfig.dir === "asc" ? cmp : -cmp;
    });
  }, [filteredStudents, sortConfig]);

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
    setSelectedIds(new Set());
    setStatusFilter("active");
  }, []);

  const handleStatusFilterChange = useCallback((newVal) => {
    setStatusFilter(newVal);
    setSelectedIds(new Set());
    setLoading(true);
    fetch(`/admin/students/data?status=${newVal}`)
      .then((r) => r.json())
      .then((data) => setStudents((data || []).map(normalizeStudent)))
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
    setSelectedIds(new Set());
    fetch(`/admin/students/data?status=${statusFilter}`)
      .then((r) => r.json())
      .then((data) => setStudents((data || []).map(normalizeStudent)))
      .catch(() => toast.error("Failed to refresh data"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

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
      const visibleIds = new Set(sortedStudents.map((s) => s.id));
      const allSelected = sortedStudents.every((s) => prev.has(s.id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, [sortedStudents]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkDeleteConfirm = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    fetch("/admin/students/bulk-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrf(),
        Accept: "application/json",
      },
      body: JSON.stringify({ student_ids: Array.from(selectedIds) }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || "Delete failed");
        return data;
      })
      .then((data) => {
        setStudents((prev) => prev.filter((s) => !selectedIds.has(s.id)));
        setSelectedIds(new Set());
        setDeleting(false);
        setDeleteDone(true);
        toast.success(`${data.deleted} student(s) deleted`);
      })
      .catch((e) => {
        setDeleting(false);
        toast.error(e.message || "Failed to delete students");
      });
  }, [selectedIds]);

  const handleCloseBulkDelete = useCallback(() => {
    setShowBulkDelete(false);
    setDeleteDone(false);
  }, []);

  // Desktop table column defs. Header/cell classes come from the old
  // page-scoped DataTable verbatim; selection + external sort stay opt-in
  // features of the shared component.
  const columns = useMemo(() => {
    const allSelected =
      sortedStudents.length > 0 &&
      sortedStudents.every((s) => selectedIds.has(s.id));

    return [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleOne(row.original.id)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        meta: { headerClassName: "px-3 py-3 w-10", cellClassName: "px-3 py-3" },
      },
      {
        id: "index",
        header: "#",
        cell: ({ row }) => (
          <span className="text-gray-400 text-xs">{row.index + 1}</span>
        ),
        meta: {
          headerClassName: "px-4 py-3 text-left font-medium text-gray-600 w-12",
          cellClassName: "px-4 py-3 text-gray-400 text-xs",
        },
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="font-medium text-gray-800">{row.original.name}</div>
        ),
        meta: {
          sortKey: "name",
          headerClassName:
            "px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors",
          cellClassName: "px-4 py-3",
        },
      },
      {
        accessorKey: "father_name",
        header: "Father",
        cell: ({ row }) => row.original.father_name || "—",
        meta: {
          sortKey: "father_name",
          headerClassName:
            "px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors",
          cellClassName: "px-4 py-3 text-gray-500",
        },
      },
      {
        id: "class_section",
        header: "Class / Section",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.enrollments || []).length === 0 ? (
              <span className="text-xs text-gray-400">—</span>
            ) : (
              (row.original.enrollments || []).map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  {e.class_name || "?"}
                  {e.section_name && <span className="opacity-60">·</span>}
                  {e.section_name || ""}
                </span>
              ))
            )}
          </div>
        ),
        meta: {
          headerClassName: "px-4 py-3 text-left font-medium text-gray-600",
          cellClassName: "px-4 py-3",
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1 justify-center">
            {(row.original.enrollments || []).length === 0 ? (
              <span className="text-xs text-gray-300">—</span>
            ) : (
              (row.original.enrollments || []).map((e) => (
                <span
                  key={e.id}
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                    e.student_type === "free"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {e.student_type === "free" ? "Free" : "Paid"}
                </span>
              ))
            )}
          </div>
        ),
        meta: {
          headerClassName: "px-4 py-3 text-center font-medium text-gray-600",
          cellClassName: "px-4 py-3 text-center",
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={effectiveStatus(row.original)} />
        ),
        meta: {
          headerClassName: "px-4 py-3 text-center font-medium text-gray-600",
          cellClassName: "px-4 py-3 text-center",
        },
      },
      {
        id: "outstanding",
        header: "Outstanding",
        cell: () => "—",
        meta: {
          headerClassName: "px-4 py-3 text-right font-medium text-gray-600",
          cellClassName: "px-4 py-3 text-right text-xs text-gray-300",
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button
            onClick={() => handleEdit(row.original)}
            className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            Edit
          </button>
        ),
        meta: {
          headerClassName: "px-4 py-3 text-right font-medium text-gray-600",
          cellClassName: "px-4 py-3 text-right",
        },
      },
    ];
  }, [sortedStudents, selectedIds, toggleAll, toggleOne, handleEdit]);

  return (
    <AdminLayout title="Students">
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Student Directory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            View, search, and manage student records.
          </p>
        </div>

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
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          onReset={handleReset}
          onAddStudent={handleAddStudent}
          classes={classes}
        />

        <SummaryBar students={filteredStudents} />

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <span className="text-sm text-blue-800 font-medium">
              {selectedIds.size} student(s) selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear
            </button>
            <button
              onClick={() => setShowBulkDelete(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border rounded-lg p-12 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable
                data={sortedStudents}
                columns={columns}
                externalSort={{
                  key: sortConfig.key,
                  dir: sortConfig.dir,
                  onSort: handleSort,
                }}
                getRowId={(row) => String(row.original.id)}
                emptyMessage="No students found"
                containerClassName="bg-white border rounded-lg overflow-hidden"
                tableClassName="w-full text-sm"
                theadClassName="bg-gray-50 border-b"
                tbodyClassName="divide-y divide-gray-100"
                bodyRowClassName={(row) =>
                  `hover:bg-blue-50 transition-colors ${
                    selectedIds.has(row.original.id) ? "bg-blue-50/50" : ""
                  }`
                }
              />
            </div>

            <div className="block md:hidden">
              <StudentCard
                students={sortedStudents}
                onEdit={handleEdit}
                effectiveStatus={effectiveStatus}
                selectedIds={selectedIds}
                onToggleOne={toggleOne}
              />
            </div>
          </>
        )}

        <StudentEditorModal
          isOpen={isEditorOpen}
          onClose={handleEditorClose}
          student={editingStudent}
          classes={classes}
          onSaved={handleSaved}
        />
      </div>

      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={!deleting ? handleCloseBulkDelete : undefined}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            {deleteDone ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Students Deleted</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    The selected students and all related records have been permanently removed.
                  </p>
                </div>
                <button
                  onClick={handleCloseBulkDelete}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Delete Students</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Are you sure you want to permanently delete{" "}
                      <strong>{selectedIds.size} student(s)</strong>?
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  <p className="font-medium">This will permanently remove:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-red-700">
                    <li>All student records</li>
                    <li>All enrollment history</li>
                    <li>All attendance records</li>
                    <li>All fee and payment records</li>
                  </ul>
                  <p className="mt-2 font-medium">This action cannot be undone.</p>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCloseBulkDelete}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDeleteConfirm}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 transition-colors"
                  >
                    {deleting ? "Deleting..." : "Delete Permanently"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
