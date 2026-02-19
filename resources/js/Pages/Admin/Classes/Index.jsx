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

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.content ?? "";
}

export default function Index() {
  const [data, setData] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [feeModal, setFeeModal] = useState({
    open: false,
    classId: null,
    className: "",
    periods: [],
    editingId: null,
    amount: 0,
    effective_from: "",
    effective_to: "",
  });

  const newRowRef = useRef(null);

  function loadData() {
    fetch("/admin/classes/data")
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(loadData, []);

  function updateCell(rowIndex, key, value) {
    setData((old) => old.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row)));
  }

  function TextCell({ row, column, autoFocus = false }) {
    const ref = autoFocus ? newRowRef : null;
    return (
      <input
        ref={ref}
        defaultValue={row.original[column.id] ?? ""}
        className="w-full px-2 py-1 border rounded text-sm"
        onBlur={(e) => updateCell(row.index, column.id, e.target.value)}
      />
    );
  }

  async function openFeeTimeline(row) {
    if (!row.original.id) {
      toast.error("Save class first, then configure fee timeline");
      return;
    }

    try {
      const res = await fetch(`/admin/classes/${row.original.id}/fee-periods`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Failed to load timeline");
      const payload = await res.json();
      setFeeModal({
        open: true,
        classId: row.original.id,
        className: row.original.name,
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
      ? `/admin/classes/${feeModal.classId}/fee-periods/${feeModal.editingId}`
      : `/admin/classes/${feeModal.classId}/fee-periods`;
    const method = feeModal.editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": csrf(),
        },
        body: JSON.stringify({
          amount: Number(feeModal.amount || 0),
          effective_from: feeModal.effective_from,
          effective_to: feeModal.effective_to || null,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg =
          payload?.message ||
          Object.values(payload?.errors ?? {}).flat()?.[0] ||
          "Failed to save";
        throw new Error(msg);
      }

      await openFeeTimeline({ original: { id: feeModal.classId, name: feeModal.className } });
      toast.success("Fee period saved");
    } catch (err) {
      toast.error(err.message || "Could not save period");
    }
  }

  async function deleteFeePeriod(periodId) {
    if (!confirm("Delete this fee period?")) return;

    try {
      const res = await fetch(`/admin/classes/${feeModal.classId}/fee-periods/${periodId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-CSRF-TOKEN": csrf(),
        },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg =
          payload?.message ||
          Object.values(payload?.errors ?? {}).flat()?.[0] ||
          "Delete failed";
        throw new Error(msg);
      }

      await openFeeTimeline({ original: { id: feeModal.classId, name: feeModal.className } });
      toast.success("Fee period deleted");
    } catch (err) {
      toast.error(err.message || "Could not delete period");
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
        header: "Class Name",
        cell: ({ row, column }) => (
          <TextCell row={row} column={column} autoFocus={row.original.__isNew} />
        ),
      },
      {
        accessorKey: "default_monthly_fee",
        header: "Legacy Monthly Fee",
        cell: ({ row }) => (
          <span className="text-gray-500">Rs. {row.original.default_monthly_fee ?? 0}</span>
        ),
      },
      {
        accessorKey: "sections_count",
        header: "Sections",
        cell: ({ row }) => <span className="text-gray-600">{row.original.sections_count ?? 0}</span>,
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
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => (row.id ? `class-${row.id}` : row.__tempId),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  function addNewRow() {
    const newRow = {
      id: null,
      __tempId: crypto.randomUUID(),
      name: "",
      default_monthly_fee: 0,
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

  return (
    <AdminLayout title="Classes">
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <input
          className="px-3 py-2 border rounded text-sm w-64"
          placeholder="Search classes..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />

        <div className="flex gap-2">
          <button onClick={addNewRow} className="px-4 py-2 bg-blue-600 text-white rounded">
            + Add Class
          </button>

          <button onClick={saveChanges} className="px-4 py-2 bg-green-600 text-white rounded">
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
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted()] ?? ""}
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
              <h3 className="font-semibold">Class Fee Timeline: {feeModal.className}</h3>
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
                        <button
                          onClick={() => deleteFeePeriod(p.id)}
                          className="text-red-600 text-xs"
                        >
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
