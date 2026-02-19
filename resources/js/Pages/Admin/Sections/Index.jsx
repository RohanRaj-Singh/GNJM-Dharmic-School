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
  const [feeModal, setFeeModal] = useState({
    open: false,
    sectionId: null,
    sectionName: "",
    periods: [],
    editingId: null,
    amount: 0,
    effective_from: "",
    effective_to: "",
  });

  const newRowRef = useRef(null);

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

  function updateCell(rowIndex, key, value) {
    setData((old) => old.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)));
  }

  function TextCell({ row, column, autoFocus = false }) {
    const ref = autoFocus ? newRowRef : null;

    return (
      <input
        ref={ref}
        defaultValue={row.original[column.id] ?? ""}
        className="min-w-36 px-2 py-1 border rounded text-sm"
        onBlur={(e) => updateCell(row.index, column.id, e.target.value.trim())}
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
        className="px-2 py-1 border rounded text-sm"
        onChange={(e) => updateCell(row.index, "class_id", e.target.value)}
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

  async function openFeeTimeline(row) {
    if (!row.original.id) {
      toast.error("Save section first, then configure fee timeline");
      return;
    }

    try {
      const res = await window.axios.get(`/admin/sections/${row.original.id}/fee-periods`, {
        headers: { Accept: "application/json" },
      });
      const payload = res?.data ?? {};
      setFeeModal({
        open: true,
        sectionId: row.original.id,
        sectionName: row.original.name,
        periods: payload.periods ?? [],
        editingId: null,
        amount: 0,
        effective_from: "",
        effective_to: "",
      });
    } catch {
      toast.error("Failed to load fee timeline");
    }
  }

  async function saveFeePeriod() {
    if (!feeModal.effective_from) {
      toast.error("Start month is required");
      return;
    }

    const url = feeModal.editingId
      ? `/admin/sections/${feeModal.sectionId}/fee-periods/${feeModal.editingId}`
      : `/admin/sections/${feeModal.sectionId}/fee-periods`;
    const method = feeModal.editingId ? "PUT" : "POST";

    try {
      await window.axios.request({
        url,
        method: method.toLowerCase(),
        headers: { Accept: "application/json" },
        data: {
          amount: Number(feeModal.amount || 0),
          effective_from: feeModal.effective_from,
          effective_to: feeModal.effective_to || null,
        },
      });

      await openFeeTimeline({ original: { id: feeModal.sectionId, name: feeModal.sectionName } });
      toast.success("Fee period saved");
    } catch (err) {
      const payload = err?.response?.data;
      const msg =
        payload?.message || Object.values(payload?.errors ?? {}).flat()?.[0] || err?.message;
      toast.error(msg || "Could not save period");
    }
  }

  async function deleteFeePeriod(periodId) {
    if (!confirm("Delete this fee period?")) return;

    try {
      await window.axios.delete(`/admin/sections/${feeModal.sectionId}/fee-periods/${periodId}`, {
        headers: { Accept: "application/json" },
      });

      await openFeeTimeline({ original: { id: feeModal.sectionId, name: feeModal.sectionName } });
      toast.success("Fee period deleted");
    } catch (err) {
      const payload = err?.response?.data;
      const msg =
        payload?.message || Object.values(payload?.errors ?? {}).flat()?.[0] || err?.message;
      toast.error(msg || "Could not delete period");
    }
  }

  function startEditPeriod(period) {
    setFeeModal((prev) => ({
      ...prev,
      editingId: period.id,
      amount: period.amount,
      effective_from: period.effective_from,
      effective_to: period.effective_to ?? "",
    }));
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Section Name",
        cell: ({ row, column }) => <TextCell row={row} column={column} autoFocus={row.original.__isNew} />,
      },
      {
        accessorKey: "class_id",
        header: "Class",
        cell: ({ row }) => <ClassSelectCell row={row} />,
      },
      {
        accessorKey: "monthly_fee",
        header: "Legacy Section Fee",
        cell: ({ row }) => <span className="text-gray-500">Rs. {row.original.monthly_fee ?? 0}</span>,
      },
      {
        accessorKey: "student_sections_count",
        header: "Students",
        cell: ({ row }) => (
          <span className="text-gray-600 text-sm">{row.original.student_sections_count ?? 0}</span>
        ),
      },
      {
        header: "Fee Timeline",
        cell: ({ row }) => (
          <button
            onClick={() => openFeeTimeline(row)}
            className="px-2 py-1 text-xs bg-slate-700 text-white rounded"
          >
            Manage
          </button>
        ),
      },
      {
        header: "Action",
        cell: ({ row }) => {
          if ((row.original.student_sections_count ?? 0) > 0) {
            return <span className="text-gray-400 text-sm">In use</span>;
          }

          return (
            <button
              onClick={() => deleteSection(row.original.id)}
              className="text-red-600 text-sm hover:underline"
            >
              Delete
            </button>
          );
        },
      },
    ],
    [classes]
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => (row.id ? `section-${row.id}` : row.__tempId),
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

  function validate() {
    const errors = [];

    data.forEach((row, i) => {
      if (!row.name?.trim()) errors.push(`Row ${i + 1}: Section name required`);
      if (!row.class_id) errors.push(`Row ${i + 1}: Class required`);
    });

    const seen = new Set();
    data.forEach((row, i) => {
      const key = `${row.class_id}-${row.name?.toLowerCase()}`;
      if (seen.has(key)) errors.push(`Row ${i + 1}: Duplicate section in same class`);
      seen.add(key);
    });

    return errors;
  }

  function saveChanges() {
    const errors = validate();

    if (errors.length) {
      toast.error(
        <ul className="list-disc ml-4">
          {errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>,
        { duration: 5000 }
      );
      return;
    }

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
        toast.error(err?.response?.data?.message || "Cannot delete section");
      },
    });
  }

  function addEmptyRow() {
    if (data.some((r) => r.__isNew && !r.name)) {
      toast.error("Finish the current new section first");
      return;
    }

    const newRow = {
      id: null,
      __tempId: crypto.randomUUID(),
      name: "",
      class_id: "",
      monthly_fee: 0,
      __isNew: true,
    };

    setData((prev) => [newRow, ...prev]);

    requestAnimationFrame(() => {
      newRowRef.current?.focus();
    });
  }

  return (
    <AdminLayout title="Sections">
      <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4">
        <input
          className="px-3 py-2 border rounded text-sm w-full sm:w-64"
          placeholder="Search sections..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />

        <div className="flex gap-2">
          <button onClick={addEmptyRow} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
            + Add Section
          </button>

          <button onClick={saveChanges} className="px-4 py-2 bg-green-600 text-white rounded text-sm">
            Save Changes
          </button>
        </div>
      </div>

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
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {feeModal.open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Section Fee Timeline: {feeModal.sectionName}</h3>
              <button
                onClick={() => setFeeModal((prev) => ({ ...prev, open: false }))}
                className="text-sm text-gray-500"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
              <input
                type="number"
                min="0"
                className="border rounded px-2 py-1 text-sm"
                placeholder="Amount"
                value={feeModal.amount}
                onChange={(e) =>
                  setFeeModal((prev) => ({ ...prev, amount: Number(e.target.value || 0) }))
                }
              />
              <input
                type="month"
                className="border rounded px-2 py-1 text-sm"
                value={feeModal.effective_from}
                onChange={(e) =>
                  setFeeModal((prev) => ({ ...prev, effective_from: e.target.value }))
                }
              />
              <input
                type="month"
                className="border rounded px-2 py-1 text-sm"
                value={feeModal.effective_to}
                onChange={(e) => setFeeModal((prev) => ({ ...prev, effective_to: e.target.value }))}
              />
              <button onClick={saveFeePeriod} className="bg-blue-600 text-white rounded px-3 py-1 text-sm">
                {feeModal.editingId ? "Update" : "Add"}
              </button>
            </div>

            <div className="border rounded max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">From</th>
                    <th className="text-left px-3 py-2">To</th>
                    <th className="text-left px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feeModal.periods.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{p.effective_from}</td>
                      <td className="px-3 py-2">{p.effective_to ?? "Open"}</td>
                      <td className="px-3 py-2">Rs. {p.amount}</td>
                      <td className="px-3 py-2 space-x-2">
                        <button onClick={() => startEditPeriod(p)} className="text-blue-600 text-xs">
                          Edit
                        </button>
                        <button onClick={() => deleteFeePeriod(p.id)} className="text-red-600 text-xs">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {feeModal.periods.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-gray-500">
                        No fee periods configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
