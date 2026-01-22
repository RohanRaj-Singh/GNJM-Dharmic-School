import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export default function CustomFees() {
  const { rows, sections } = usePage().props;

  const [data, setData] = useState(rows ?? []);
  const [sorting, setSorting] = useState({});

  /* ---------------- Modal ---------------- */
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    section_id: "",
    title: "",
    amount: "",
  });

  /* ---------------- Helpers ---------------- */
  function updateCell(rowIndex, key, value) {
    setData((prev) =>
      prev.map((r, i) =>
        i === rowIndex ? { ...r, [key]: value, __dirty: true } : r
      )
    );
  }

  /* ---------------- Actions ---------------- */
  function saveRow(row) {
    router.put(
      route("admin.fees.custom.update"),
      {
        section_id: row.section_id,
        old_title: row.title,
        old_amount: row.amount,
        title: row.title,
        amount: row.amount,
      },
      {
        preserveScroll: true,
        onSuccess: () => toast.success("Custom fee updated"),
      }
    );
  }

  function deleteSectionFee(row) {
    if (!confirm("Delete this custom fee for entire section?")) return;

    router.delete(route("admin.fees.custom.destroy.section"), {
      data: {
        section_id: row.section_id,
        title: row.title,
        amount: row.amount,
      },
      preserveScroll: true,
      onSuccess: () => toast.success("Custom fee deleted"),
    });
  }

  function submitNewFee() {
    if (!form.section_id || !form.title || !form.amount) {
      toast.error("All fields are required");
      return;
    }

    router.post(route("admin.fees.custom.store"), form, {
      preserveScroll: true,
      onSuccess: () => {
        toast.success("Custom fee assigned");
        setShowModal(false);
        setForm({ section_id: "", title: "", amount: "" });
      },
    });
  }

  /* ---------------- Columns ---------------- */
  const columns = useMemo(
    () => [
      { header: "#", cell: ({ row }) => row.index + 1 },

      { accessorKey: "class_name", header: "Class" },
      { accessorKey: "section_name", header: "Section" },

      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <input
            defaultValue={row.original.title}
            disabled={row.original.paid_count > 0}
            className="border px-2 py-1 rounded text-sm w-full"
            onBlur={(e) =>
              updateCell(row.index, "title", e.target.value)
            }
          />
        ),
      },

      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <input
            type="number"
            min={1}
            defaultValue={row.original.amount}
            disabled={row.original.paid_count > 0}
            className="border px-2 py-1 rounded text-sm w-full"
            onBlur={(e) =>
              updateCell(row.index, "amount", Number(e.target.value))
            }
          />
        ),
      },

      {
        header: "Students",
        cell: ({ row }) => row.original.total_students,
      },

      {
        header: "Paid",
        cell: ({ row }) =>
          row.original.paid_count > 0 ? (
            <span className="text-green-600">
              {row.original.paid_count}
            </span>
          ) : (
            <span className="text-gray-400">0</span>
          ),
      },

      {
        header: "Actions",
        cell: ({ row }) => {
          const r = row.original;

          if (r.paid_count > 0) {
            return (
              <span className="text-gray-400 text-sm">
                Locked
              </span>
            );
          }

          return (
            <div className="flex gap-2">
              {r.__dirty && (
                <button
                  onClick={() => saveRow(r)}
                  className="text-green-600 text-sm"
                >
                  Save
                </button>
              )}
              <button
                onClick={() => deleteSectionFee(r)}
                className="text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [data]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  /* ---------------- Render ---------------- */
  return (
    <AdminLayout title="Custom Fees">
      {/* Top bar */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
        >
          + Assign Custom Fee
        </button>
      </div>

      {/* Table */}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-5">
            <h3 className="text-lg font-semibold mb-4">
              Assign Custom Fee
            </h3>

            <div className="space-y-3">
              <select
                className="w-full border px-3 py-2 rounded"
                value={form.section_id}
                onChange={(e) =>
                  setForm({ ...form, section_id: e.target.value })
                }
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.class_name} — {s.name}
                  </option>
                ))}
              </select>

              <input
                className="w-full border px-3 py-2 rounded"
                placeholder="Fee title"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
              />

              <input
                type="number"
                className="w-full border px-3 py-2 rounded"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitNewFee}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
