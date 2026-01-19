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
  const [classes, setClasses] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const newRowRef = useRef(null);

  /* -----------------------------------------
   | Load data
   ----------------------------------------- */
  useEffect(() => {
    reloadData();

    fetch("/admin/classes/options")
      .then((r) => r.json())
      .then(setClasses);
  }, []);

  function reloadData() {
    fetch("/admin/sections/data")
      .then((r) => r.json())
      .then(setData);
  }

  /* -----------------------------------------
   | Helpers
   ----------------------------------------- */
  function updateCell(rowIndex, key, value) {
    setData((old) =>
      old.map((row, i) =>
        i === rowIndex ? { ...row, [key]: value } : row
      )
    );
  }

  function TextCell({ row, column, autoFocus = false }) {
    const ref = autoFocus ? newRowRef : null;

    return (
      <input
        ref={ref}
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

  function ClassSelectCell({ row }) {
    return (
      <select
        value={row.original.class_id ?? ""}
        className="w-full px-2 py-1 border rounded text-sm"
        onChange={(e) =>
          updateCell(row.index, "class_id", e.target.value)
        }
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


  /* -----------------------------------------
   | Columns
   ----------------------------------------- */
  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Section Name",
        cell: ({ row, column }) => (
          <TextCell
            row={row}
            column={column}
            autoFocus={row.original.__isNew}
          />
        ),
      },

      {
        accessorKey: "class_id",
        header: "Class",
        cell: ({ row }) => <ClassSelectCell row={row} />,
      },

      {
        accessorKey: "students_count",
        header: "Students",
        cell: ({ row }) => (
          <span className="text-gray-600 text-sm">
            {row.original.students_count ?? 0}
          </span>
        ),
      },
      {
  header: "Action",
  cell: ({ row }) => (
    <button
      onClick={() => deleteSection(row.original.id)}
      className="text-red-600 text-sm hover:underline"
    >
      Delete
    </button>
  ),
}

    ],
    [classes]
  );

  /* -----------------------------------------
   | Table
   ----------------------------------------- */
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) =>
      row.id ? `section-${row.id}` : row.__tempId,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  /* -----------------------------------------
   | Actions
   ----------------------------------------- */
  function saveChanges() {
    router.post(
      "/admin/sections/save",
      { sections: data },
      {
        onSuccess: () => {
          toast.success("Sections saved");
          reloadData();
        },
        onError: () => toast.error("Save failed"),
      }
    );
  }

  function deleteSection(id) {
  if (!confirm("Delete this section? This cannot be undone.")) return;

  router.delete(`/admin/sections/${id}`, {
    onSuccess: () => {
      toast.success("Section deleted");
      reloadData();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message ||
        "Cannot delete section"
      );
    },
  });
}


  function addEmptyRow() {
    const newRow = {
      id: null,
      __tempId: crypto.randomUUID(),
      name: "",
      class_id: "",
      __isNew: true,
    };

    setData((prev) => [newRow, ...prev]);

    requestAnimationFrame(() => {
      newRowRef.current?.focus();
    });
  }

  /* -----------------------------------------
   | Render
   ----------------------------------------- */
  return (
    <AdminLayout title="Sections">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <input
          className="px-3 py-2 border rounded text-sm w-full sm:w-64"
          placeholder="Search sections…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            onClick={addEmptyRow}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
          >
            + Add Section
          </button>

          <button
            onClick={saveChanges}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-auto max-h-[70vh]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium cursor-pointer"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
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
    </AdminLayout>
  );
}
