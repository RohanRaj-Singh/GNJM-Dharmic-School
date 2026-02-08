import AdminLayout from "@/Layouts/AdminLayout";
import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import EnrollmentsCell from "./EnrollmentsCell";
import PageLoader from "@/Components/PageLoader";
import useStudentFilters from "./hooks/useStudentFilters";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export default function Index() {
  /* ----------------------------------------
   | State
   ---------------------------------------- */
  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sectionsByClass, setSectionsByClass] = useState({});
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [uiReady, setUiReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const newRowNameRef = useRef(null);

  /* ----------------------------------------
   | Filters (ONLY what we need)
   ---------------------------------------- */
  const {
    classFilter,
    sectionFilter,
    feeFilter,
    setClassFilter,
    setSectionFilter,
    setFeeFilter,
    columnFilters,
    filterFns,
    resetFilters,
  } = useStudentFilters();

  /* ----------------------------------------
   | Initial Load
   ---------------------------------------- */
  useEffect(() => {
    reloadData();
  }, []);

  function reloadData() {
    setLoading(true);
    setUiReady(false);

    return Promise.all([
      fetch("/admin/students/data").then((r) => r.json()),
      fetch("/admin/classes/options").then((r) => r.json()),
    ])
      .then(([students, classes]) => {
        const normalized = students.map((s) => ({
          ...s,
          enrollments: (s.enrollments || []).map((e) => ({
            id: e.id ?? crypto.randomUUID(),
            class_id: String(e.class_id ?? ""),
            section_id: String(e.section_id ?? ""),
            student_type: e.student_type ?? "paid",
          })),
        }));

        setData(normalized);
        setClasses(classes);
        return normalized;
      })
      .catch(() => toast.error("Failed to load students"))
      .finally(() => setLoading(false));
  }

  /* ----------------------------------------
   | UI Hydration Guard
   ---------------------------------------- */
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setUiReady(true), 300);
      return () => clearTimeout(t);
    }
  }, [loading]);

  /* ----------------------------------------
   | Helpers
   ---------------------------------------- */
  function updateCell(rowIndex, key, value) {
    setData((prev) =>
      prev.map((row, i) =>
        i === rowIndex ? { ...row, [key]: value } : row
      )
    );
    setIsDirty(true);
  }

  function loadSections(classId) {
    if (!classId) return;
    const key = String(classId);
    if (sectionsByClass[key]) return;

    fetch(`/admin/sections/options?class_id=${classId}`)
      .then((r) => r.json())
      .then((sections) =>
        setSectionsByClass((p) => ({ ...p, [key]: sections }))
      );
  }

const sectionOptions = useMemo(() => {
  if (classFilter === "all") return [];

  const list = sectionsByClass[String(classFilter)];
  if (!Array.isArray(list)) return [];

  return list.map((s) => ({
    id: String(s.id),
    name: s.name,
  }));
}, [classFilter, sectionsByClass]);

  /* ----------------------------------------
   | Cells
   ---------------------------------------- */
  function TextCell({ row, column, autoFocus = false }) {
    return (
      <input
        ref={autoFocus ? newRowNameRef : null}
        defaultValue={row.original[column.id] ?? ""}
        className="w-full px-2 py-1 border rounded text-sm"
        onBlur={(e) =>
          updateCell(row.index, column.id, e.target.value)
        }
      />
    );
  }

  function PhoneCell({ row, column }) {
    return (
      <input
        defaultValue={row.original[column.id] ?? ""}
        className="w-full px-2 py-1 border rounded text-sm"
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val && !/^\d{10,15}$/.test(val)) {
            toast.error("Phone must be 10–15 digits");
            return;
          }
          updateCell(row.index, column.id, val);
        }}
      />
    );
  }

  /* ----------------------------------------
   | Columns
   ---------------------------------------- */
  const columns = useMemo(
    () => [
      { header: "#",

        cell: ({ row }) => row.index + 1
    },

    //   {
    //     accessorKey: "id",
    //     header: "ID",
    //     enableSorting: true,
    //   },

      {
        accessorKey: "name",
        header: "Name",
        enableSorting: true,
        cell: ({ row, column }) => (
          <TextCell
            row={row}
            column={column}
            autoFocus={row.original.__isNew}
          />
        ),
      },

      {
        accessorKey: "father_name",
        header: "Father",
        cell: ({ row, column }) => (
          <TextCell row={row} column={column} />
        ),
      },

      {
        accessorKey: "father_phone",
        header: "Father Phone",
        cell: ({ row, column }) => (
          <PhoneCell row={row} column={column} />
        ),
      },
      {
  accessorKey: "mother_phone",
  header: "Mother Phone",
  cell: ({ row, column }) => (
    <PhoneCell row={row} column={column} />
  ),
},


      {
        header: "Enrollments",
        cell: ({ row }) => (
          <EnrollmentsCell
            row={row}
            classes={classes}
            sectionsByClass={sectionsByClass}
            loadSections={loadSections}
            setData={setData}
            setIsDirty={setIsDirty}
          />
        ),
      },

      {
        header: "Actions",
        cell: ({ row }) => (
          <button
            className="text-red-600 text-sm"
            onClick={() => {
              if (
                confirm(
                  "Delete this student? All enrollments will be removed."
                )
              ) {
                const id = row.original.id;
                if (!id) {
                  setData((prev) =>
                    prev.filter((_, i) => i !== row.index)
                  );
                  setIsDirty(true);
                  return;
                }

                router.delete(`/admin/students/${id}`, {
                  preserveScroll: true,
                  onSuccess: () => {
                    reloadData().then((students) => {
                      const stillThere = students?.some(
                        (s) => String(s.id) === String(id)
                      );
                      if (stillThere) {
                        toast.error("Delete failed. Student still exists.");
                        return;
                      }

                      toast.success("Student deleted");
                    });
                  },
                  onError: () =>
                    toast.error("Failed to delete student"),
                });
              }
            }}
          >
            Delete
          </button>
        ),
      },
    ],
    [classes, sectionsByClass]
  );
  //Student Row Filter
  const studentRowFilter = (row) => {
  const student = row.original;

  // 🔍 Class filter
  if (classFilter !== "all") {
    const hasClass = student.enrollments?.some(
      (e) => String(e.class_id) === String(classFilter)
    );
    if (!hasClass) return false;
  }

  // 💰 Paid / Free filter
  if (feeFilter !== "all") {
    const match = student.enrollments?.some((e) =>
      feeFilter === "free"
        ? e.student_type === "free"
        : e.student_type !== "free"
    );
    if (!match) return false;
  }

  return true;
};

const filteredData = useMemo(() => {
  return data.filter((student) => {

    // 🏫 Class filter
    if (classFilter !== "all") {
      const ok = student.enrollments?.some(
        (e) => String(e.class_id) === String(classFilter)
      );
      if (!ok) return false;
    }

    // 🧩 Section filter
    if (sectionFilter !== "all") {
      const ok = student.enrollments?.some(
        (e) => String(e.section_id) === String(sectionFilter)
      );
      if (!ok) return false;
    }

    // 💰 Paid / Free
    if (feeFilter !== "all") {
      const ok = student.enrollments?.some((e) =>
        feeFilter === "free"
          ? e.student_type === "free"
          : e.student_type !== "free"
      );
      if (!ok) return false;
    }

    return true;
  });
}, [data, classFilter, sectionFilter, feeFilter]);
;

  /* ----------------------------------------
   | Table
   ---------------------------------------- */
  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) =>
      row.id ? `student-${row.id}` : row.__tempId,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    filterFns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });


  function addEmptyRow() {
  if (!uiReady) return;

  const hasUnfinished = data.some(
    (r) => r.__isNew && !r.name?.trim()
  );

  if (hasUnfinished) {
    toast.error("Finish the current new student first");
    return;
  }

  setData((prev) => [
    {
      id: null,
      __tempId: crypto.randomUUID(), // 🔑 required for TanStack
      name: "",
      father_name: "",
      father_phone: "",
      mother_phone: "",
      status: "active",
      enrollments: [],
      __isNew: true,
    },
    ...prev,
  ]);

  setIsDirty(true);

  // autofocus name field
  requestAnimationFrame(() => {
    newRowNameRef.current?.focus();
  });
}

//validate function
function validateStudent(student) {
  if (!student.name?.trim())
    return "Student name is required";

  if (!student.enrollments?.length)
    return "At least one enrollment required";

  const seen = new Set();

  for (const e of student.enrollments) {
    if (!e.class_id || !e.section_id)
      return "Each enrollment needs class & section";

    const key = `${e.class_id}-${e.section_id}`;
    if (seen.has(key))
      return "Duplicate class + section enrollment";

    seen.add(key);
  }

  return null;
}


function saveChanges() {
  if (!isDirty || isSavingRef.current) return;

  const errors = [];
  const clean = [];

  data.forEach((student, idx) => {
    const err = validateStudent(student);
    if (err) {
      errors.push(`Row ${idx + 1}: ${err}`);
    } else {
      clean.push(student);
    }
  });

  if (errors.length) {
    toast.error(
      <div>
        <strong>Fix these issues:</strong>
        <ul className="list-disc ml-4 mt-1">
          {errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </div>,
      { duration: 6000 }
    );
    return;
  }

  setIsSaving(true);
  isSavingRef.current = true;

  router.post(
    "/admin/students/bulk-update",
    { students: clean },
    {
      preserveScroll: true,
      onSuccess: () => {
        toast.success("Changes saved");
        setIsDirty(false);
        reloadData();
      },
      onFinish: () => {
        setIsSaving(false);
        isSavingRef.current = false;
      },
    }
  );
}


function TextCell({ row, column, autoFocus = false }) {
  return (
    <input
      ref={autoFocus ? newRowNameRef : null}
      defaultValue={row.original[column.id] ?? ""}
      className="w-full px-2 py-1 border rounded text-sm"
      onBlur={(e) =>
        updateCell(row.index, column.id, e.target.value)
      }
    />
  );
}


  /* ----------------------------------------
   | Render
   ---------------------------------------- */
  return (
    <AdminLayout title="Students">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
  {/* LEFT: Filters */}
  <div className="flex flex-wrap gap-2 items-center">
    <input
      className="px-3 py-2 border rounded text-sm w-64"
      placeholder="Search…"
      value={globalFilter}
      onChange={(e) => setGlobalFilter(e.target.value)}
    />

    {/* Class */}
    <select
      value={classFilter}
      onChange={(e) => setClassFilter(e.target.value)}
      className="px-3 py-2 border rounded text-sm"
    >
      <option value="all">All Classes</option>
      {classes.map((c) => (
        <option key={c.id} value={String(c.id)}>
          {c.name}
        </option>
      ))}
    </select>
    <select
  value={sectionFilter}
  onChange={(e) => setSectionFilter(e.target.value)}
  disabled={classFilter === "all"}
  className="px-3 py-2 border rounded text-sm disabled:bg-gray-100"
>
  <option value="all">
    {classFilter === "all" ? "Select class first" : "All Sections"}
  </option>

  {sectionOptions.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ))}
</select>



    {/* Paid / Free */}
    <select
      value={feeFilter}
      onChange={(e) => setFeeFilter(e.target.value)}
      className="px-3 py-2 border rounded text-sm"
    >
      <option value="all">Paid & Free</option>
      <option value="paid">Paid</option>
      <option value="free">Free</option>
    </select>

    <button
      onClick={resetFilters}
      className="px-3 py-2 border rounded text-sm"
    >
      Reset
    </button>
  </div>

  {/* RIGHT: Actions */}
  <div className="flex gap-2">
    <button
      onClick={addEmptyRow}
      disabled={!uiReady}
      className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
    >
      + Add Student
    </button>

    <button
      onClick={saveChanges}
      disabled={!isDirty || isSaving}
      className={`px-4 py-2 rounded text-sm text-white ${
        isSaving
          ? "bg-green-400"
          : "bg-green-600 hover:bg-green-700"
      } disabled:opacity-50`}
    >
      {isSaving ? "Saving…" : "Save Changes"}
    </button>
  </div>
</div>
      {/* Table */}
      {loading ? (
        <PageLoader text="Loading students…" />
      ) : (
        <div className="bg-white border rounded overflow-x-auto">
          <table className="min-w-[900px] text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-3 py-2 cursor-pointer select-none"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        h.column.columnDef.header,
                        h.getContext()
                      )}
                      {{
                        asc: " ▲",
                        desc: " ▼",
                      }[h.column.getIsSorted()] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {
                table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b">

                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-3 py-2 min-${cell.column.columnDef.header === "#" ? "w-auto" : "w-[150px]"} border-b align-top`}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
