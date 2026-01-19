import AdminLayout from "@/Layouts/AdminLayout";
import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

export default function Index() {
    const [data, setData] = useState([]);
    const [sorting, setSorting] = useState([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [rowSelection, setRowSelection] = useState({});
    const [classes, setClasses] = useState([]);
    const [sectionsByClass, setSectionsByClass] = useState({});

    const newRowNameRef = useRef(null);

    /* ---------------- Load Data ---------------- */
    useEffect(() => {
        reloadData();
    }, []);

    function reloadData() {
        fetch("/admin/students/data")
            .then((r) => r.json())
            .then(setData);
    }

    useEffect(() => {
        fetch("/admin/classes/options")
            .then((r) => r.json())
            .then(setClasses);
    }, []);

    /* ---------------- Helpers ---------------- */
    function updateCell(rowIndex, key, value) {
        setData((old) =>
            old.map((row, i) =>
                i === rowIndex ? { ...row, [key]: value } : row,
            ),
        );
    }

    function loadSections(classId) {
        if (!classId || sectionsByClass[classId]) return;

        fetch(`/admin/sections/options?class_id=${classId}`)
            .then((r) => r.json())
            .then((sections) => {
                setSectionsByClass((prev) => ({
                    ...prev,
                    [classId]: sections,
                }));
            });
    }

    /* ---------------- Cells ---------------- */
    function TextCell({ row, column, autoFocus = false }) {
        return (
            <input
                ref={autoFocus ? newRowNameRef : null}
                defaultValue={row.original[column.id] ?? ""}
                className="w-full px-2 py-1 border rounded text-sm"
                onBlur={(e) => updateCell(row.index, column.id, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                }}
            />
        );
    }

    function StatusCell({ row, column }) {
        return (
            <select
                defaultValue={row.original[column.id] ?? "active"}
                className="w-full px-2 py-1 border rounded text-sm"
                onChange={(e) =>
                    updateCell(row.index, column.id, e.target.value)
                }
            >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
        );
    }

    function ClassSelectCell({ row }) {
        return (
            <select
                value={row.original.class_id ?? ""}
                className="w-full px-2 py-1 border rounded text-sm"
                onChange={(e) => {
                    const classId = e.target.value;
                    updateCell(row.index, "class_id", classId);
                    updateCell(row.index, "section_id", null);
                    loadSections(classId);
                }}
            >
                <option value="">Select class</option>
                {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                        {cls.name}
                    </option>
                ))}
            </select>
        );
    }

    function SectionSelectCell({ row }) {
        const classId = row.original.class_id;
        const sections = sectionsByClass[classId] || [];

        useEffect(() => {
            if (classId) loadSections(classId);
        }, [classId]);

        return (
            <select
                value={row.original.section_id ?? ""}
                className="w-full px-2 py-1 border rounded text-sm"
                onChange={(e) =>
                    updateCell(row.index, "section_id", e.target.value)
                }
            >
                <option value="">Select section</option>
                {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name}
                    </option>
                ))}
            </select>
        );
    }

    /* ---------------- Columns ---------------- */
    const columns = useMemo(
  () => [
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
        <TextCell row={row} column={column} />
      ),
    },
    {
      accessorKey: "mother_phone",
      header: "Mother Phone",
      cell: ({ row, column }) => (
        <TextCell row={row} column={column} />
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
      cell: ({ row }) => <EnrollmentsCell row={row} />,
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


    /* ---------------- Table ---------------- */
    const table = useReactTable({
        data,
        columns,
        getRowId: (row) => (row.id ? `student-${row.id}` : row.__tempId),
        state: { sorting, globalFilter, rowSelection },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        globalFilterFn: "includesString",
    });

    /* ---------------- Actions ---------------- */
    function saveChanges() {
  const clean = data.filter((s) => {
    if (!s.name?.trim()) return false;
    if (!s.enrollments?.length) return false;
    return true;
  });

  if (clean.length !== data.length) {
    toast("Some incomplete students were ignored", {
      icon: "⚠️",
    });
  }

  router.post(
    "/admin/students/bulk-update",
    { students: clean },
    {
      onSuccess: () => {
        toast.success("Changes saved");
        reloadData();
      },
    }
  );
}


    function addEmptyRow() {
        const newRow = {
            id: null,
            __tempId: crypto.randomUUID(),
            name: "",
            father_name: "",
            father_phone: "",
            mother_phone: "",
            class_id: null,
            section_id: null,
            status: "active",
            __isNew: true,
        };

        setData((prev) => [newRow, ...prev]);

        requestAnimationFrame(() => {
            newRowNameRef.current?.focus();
        });
    }
    function EnrollmentsCell({ row }) {
        const enrollments = row.original.enrollments || [];

        function addEnrollment() {
            updateCell(row.index, "enrollments", [
                ...enrollments,
                { class_id: "", section_id: "" },
            ]);
        }

        function updateEnrollment(i, key, value) {
            const next = enrollments.map((e, idx) =>
                idx === i ? { ...e, [key]: value } : e,
            );
            updateCell(row.index, "enrollments", next);
        }

        function removeEnrollment(i) {
            updateCell(
                row.index,
                "enrollments",
                enrollments.filter((_, idx) => idx !== i),
            );
        }

        return (
            <div className="flex flex-col gap-2 min-w-[260px]">
                {enrollments.map((e, i) => (
                    <div key={i} className="flex gap-2 items-center">
                        {/* Class */}
                        <select
                            value={e.class_id ?? ""}
                            className="border px-2 py-1 text-sm rounded"
                            onChange={(ev) => {
                                updateEnrollment(
                                    i,
                                    "class_id",
                                    ev.target.value,
                                );
                                updateEnrollment(i, "section_id", "");
                                loadSections(ev.target.value);
                            }}
                        >
                            <option value="">Class</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name}
                                </option>
                            ))}
                        </select>

                        {/* Section */}
                        <select
                            value={e.section_id ?? ""}
                            className="border px-2 py-1 text-sm rounded"
                            onChange={(ev) =>
                                updateEnrollment(
                                    i,
                                    "section_id",
                                    ev.target.value,
                                )
                            }
                        >
                            <option value="">Section</option>
                            {(sectionsByClass[e.class_id] || []).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>

                        {/* Remove */}
                        <button
                            onClick={() => removeEnrollment(i)}
                            className="text-red-600 text-sm"
                            title="Remove enrollment"
                        >
                            ✕
                        </button>
                    </div>
                ))}

                <button
                    onClick={addEnrollment}
                    className="text-blue-600 text-xs self-start"
                >
                    + Add Enrollment
                </button>
            </div>
        );
    }

    /* ---------------- Render ---------------- */
    return (
        <AdminLayout title="Students">
            {/* ================= Top Controls ================= */}
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Search */}
                <input
                    className="w-full sm:w-64 px-3 py-2 border rounded-lg text-sm"
                    placeholder="Search students…"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                />

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={addEmptyRow}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm whitespace-nowrap"
                    >
                        + Add Student
                    </button>

                    <button
                        onClick={saveChanges}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm whitespace-nowrap"
                    >
                        Save Changes
                    </button>
                </div>
            </div>

            {/* ================= Table ================= */}
            <div className="bg-white border rounded-lg overflow-x-auto">
                <table className="min-w-[900px] text-sm">
                    <thead className="bg-gray-50 border-b">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap"
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>

                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className="border-b hover:bg-gray-50"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="px-3 py-2 align-top whitespace-nowrap"
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
