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

  const newRowRef = useRef(null);

  /* ---------------- Load Data ---------------- */
  function loadData() {
    fetch("/admin/classes/data")
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(loadData, []);

  /* ---------------- Helpers ---------------- */
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
      />
    );
  }

  function NumberCell({ row, column }) {
    return (
      <input
        type="number"
        min={0}
        defaultValue={row.original[column.id] ?? 0}
        className="w-full px-2 py-1 border rounded text-sm"
        onBlur={(e) =>
          updateCell(
            row.index,
            column.id,
            Number(e.target.value || 0)
          )
        }
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

  /* ---------------- Columns ---------------- */
  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Class Name",
        cell: ({ row, column }) => (
          <TextCell
            row={row}
            column={column}
            autoFocus={row.original.__isNew}
          />
        ),
      },
      {
        accessorKey: "default_monthly_fee",
        header: "Monthly Fee",
        cell: ({ row, column }) => (
          <NumberCell row={row} column={column} />
        ),
      },
      {
        accessorKey: "sections_count",
        header: "Sections",
        cell: ({ row }) => (
          <span className="text-gray-600">
            {row.original.sections_count ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row, column }) => (
          <StatusCell row={row} column={column} />
        ),
      },
    ],
    []
  );

  /* ---------------- Table ---------------- */
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) =>
      row.id ? `class-${row.id}` : row.__tempId,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  /* ---------------- Actions ---------------- */
  function addNewRow() {
    const newRow = {
      id: null,
      __tempId: crypto.randomUUID(),
      name: "",
      default_monthly_fee: 0,
      status: "active",
      sections_count: 0,
      __isNew: true,
    };

    setData((prev) => [newRow, ...prev]);

    requestAnimationFrame(() => {
      newRowRef.current?.focus();
    });
  }

  function saveChanges() {
    if (data.some((r) => !r.name?.trim())) {
      toast.error("Class name cannot be empty");
      return;
    }

    router.post(
      "/admin/classes/save",
      { classes: data },
      {
        onSuccess: () => {
          toast.success("Classes saved");
          loadData();
        },
        onError: () => toast.error("Save failed"),
      }
    );
  }

  /* ---------------- Render ---------------- */
  return (
    <AdminLayout title="Classes">
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <input
          className="px-3 py-2 border rounded text-sm w-64"
          placeholder="Search classes…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            onClick={addNewRow}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            + Add Class
          </button>

          <button
            onClick={saveChanges}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="bg-white border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
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
                    {{
                      asc: " ↑",
                      desc: " ↓",
                    }[header.column.getIsSorted()] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
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
