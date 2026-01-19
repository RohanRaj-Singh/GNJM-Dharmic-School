import AdminLayout from "@/Layouts/AdminLayout";
import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import EnrollmentsCell from "./EnrollmentsCell";
import PageLoader from "@/Components/PageLoader";

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
  const [rowSelection, setRowSelection] = useState({});

  const [loading, setLoading] = useState(true);     // data fetch
  const [uiReady, setUiReady] = useState(false);    // hydration guard
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const newRowNameRef = useRef(null);

  /* ----------------------------------------
   | Initial Load (students + classes)
   ---------------------------------------- */
  useEffect(() => {
    reloadData();
  }, []);

  function reloadData() {
    setLoading(true);
    setUiReady(false);

    Promise.all([
      fetch("/admin/students/data").then((r) => r.json()),
      fetch("/admin/classes/options").then((r) => r.json()),
    ])
      .then(([students, classes]) => {
        setData(students);
        setClasses(classes);
      })
      .finally(() => setLoading(false));
  }

  /* ----------------------------------------
   | UI Hydration Guard (IMPORTANT)
   | Wait for React + TanStack to settle
   ---------------------------------------- */
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setUiReady(true), 400);
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
      .then((sections) => {
        setSectionsByClass((prev) => ({
          ...prev,
          [key]: sections,
        }));
      });
  }

  /* ----------------------------------------
   | Navigation Guards
   ---------------------------------------- */
  useEffect(() => {
  const handler = (e) => {
    if (!isDirty || isSaving) return;
    e.preventDefault();
    e.returnValue = "";
  };

  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [isDirty, isSaving]);


  useEffect(() => {
  const unbind = router.on("before", (event) => {
    // ✅ do NOT prompt during save
    if (!isDirty || isSavingRef.current) return;

    if (!confirm("You have unsaved changes. Leave anyway?")) {
      event.preventDefault();
    }
  });

  return () => unbind();
}, [isDirty, isSaving]);


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
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
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

  function StatusCell({ row, column }) {
    return (
      <select
        value={row.original[column.id] ?? "active"}
        onChange={(e) =>
          updateCell(row.index, column.id, e.target.value)
        }
        className="w-full px-2 py-1 border rounded text-sm"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    );
  }

  /* ----------------------------------------
   | Columns
   ---------------------------------------- */
  const columns = useMemo(
    () => [
      {
        header: "#",
        cell: ({ row }) => row.index + 1,
      },
      {
        accessorKey: "id",
        header: "Student ID",
        cell: ({ row }) => row.original.id ?? "—",
      },
      {
        accessorKey: "name",
        header: "Name",
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
        header: "Father Name",
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
        accessorKey: "status",
        header: "Status",
        cell: ({ row, column }) => (
          <StatusCell row={row} column={column} />
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
                setData((prev) =>
                  prev.filter((_, i) => i !== row.index)
                );
                setIsDirty(true);
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

  /* ----------------------------------------
   | Table
   ---------------------------------------- */
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) =>
      row.id ? `student-${row.id}` : row.__tempId,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  /* ----------------------------------------
   | Validation
   ---------------------------------------- */
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

  /* ----------------------------------------
   | Actions
   ---------------------------------------- */
function saveChanges() {
  if (!isDirty || isSavingRef.current) return;

  const errors = [];
  const clean = [];

  data.forEach((student, idx) => {
    const err = validateStudent(student);
    if (err) errors.push(`Row ${idx + 1}: ${err}`);
    else clean.push(student);
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

  // 🔥 BOTH state + ref
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



  function addEmptyRow() {
    if (!uiReady) return;

    const hasEmpty = data.some(
      (r) => r.__isNew && !r.name?.trim()
    );
    if (hasEmpty) {
      toast.error("Finish the current new student first");
      return;
    }

    setData((prev) => [
      {
        id: null,
        __tempId: crypto.randomUUID(),
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

    requestAnimationFrame(() => {
      newRowNameRef.current?.focus();
    });
  }

  /* ----------------------------------------
   | Render
   ---------------------------------------- */
  return (
    <AdminLayout title="Students">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:justify-between">
        <input
          className="w-full sm:w-64 px-3 py-2 border rounded-lg text-sm"
          placeholder="Search students…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            onClick={addEmptyRow}
            disabled={!uiReady}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            + Add Student
          </button>

          <button
  onClick={saveChanges}
  disabled={!isDirty || isSaving}
  className={`
    px-4 py-2 rounded-lg text-sm whitespace-nowrap
    ${isSaving
      ? "bg-green-400 cursor-not-allowed"
      : "bg-green-600 hover:bg-green-700"}
    text-white disabled:opacity-60
  `}
>
  {isSaving ? "Saving…" : "Save Changes"}
</button>

        </div>
      </div>

      {loading ? (
        <PageLoader text="Loading students…" />
      ) : (
        <div className="relative">
          {!uiReady && (
            <div className="absolute inset-0 z-30 bg-white/60 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                Preparing editor…
              </div>
            </div>
          )}

          <div className={!uiReady ? "pointer-events-none" : ""}>
            <div className="bg-white border rounded-lg overflow-x-auto">
              <table className="min-w-[900px] text-sm">
                <thead className="bg-gray-50 border-b">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} className="px-3 py-2 text-left">
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2">
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
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
