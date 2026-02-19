import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export default function PendingFeesSetup() {
  const { rows = [], filters = {}, classes = [], sections = [] } =
    usePage().props;

  const [edits, setEdits] = useState({});
  const [lastSaved, setLastSaved] = useState({});
  const [searchInput, setSearchInput] = useState(filters?.search ?? "");

  useEffect(() => {
    const next = {};
    rows.forEach((r) => {
      next[r.id] = r.assumed_pending_months ?? 0;
    });
    setEdits(next);
    setLastSaved(next);
  }, [rows]);

  const classId = filters.class_id ?? "";
  const sectionId = filters.section_id ?? "";
  const search = filters.search ?? "";

  function applyFilter(key, value) {
    router.get(
      route("admin.utilities.pending-fees"),
      {
        ...filters,
        [key]: value,
        ...(key === "class_id" ? { section_id: "" } : {}),
      },
      {
        preserveState: true,
        replace: true,
      }
    );
  }

  useEffect(() => {
    setSearchInput(filters?.search ?? "");
  }, [filters?.search]);

  function applySearchLive(value) {
    if ((filters?.search ?? "") !== value) {
      applyFilter("search", value);
    }
  }

  function onChangeMonths(id, value) {
    const asNumber = value === "" ? 0 : Number(value);
    setEdits((prev) => ({ ...prev, [id]: asNumber }));
  }

  const dirtyRows = useMemo(() => {
    return rows
      .filter((r) => !r.has_payments)
      .filter((r) => (lastSaved[r.id] ?? 0) !== (edits[r.id] ?? 0))
      .map((r) => ({ id: r.id, value: edits[r.id] ?? 0 }));
  }, [rows, edits, lastSaved]);

  function saveAll() {
    if (!dirtyRows.length) {
      alert("No changes to save.");
      return;
    }

    const invalid = dirtyRows.find(
      (r) =>
        r.value === null ||
        Number.isNaN(Number(r.value)) ||
        Number(r.value) < 0
    );
    if (invalid) {
      toast.error("Enter valid pending months for all edited rows.");
      return;
    }

    router.patch(
      route("admin.utilities.pending-fees.bulk"),
      { updates: dirtyRows },
      {
        preserveScroll: true,
        onSuccess: () => {
          setLastSaved((prev) => {
            const next = { ...prev };
            dirtyRows.forEach((r) => {
              next[r.id] = r.value;
            });
            return next;
          });
          toast.success("Pending months updated.");
        },
        onError: (errors) => {
          const msg =
            errors?.assumed_pending_months ||
            "Unable to update pending months.";
          toast.error(msg);
        },
      }
    );
  }

  const hasRequiredFilters = Boolean(classId);

  const displayRows = useMemo(() => rows, [rows]);

  return (
    <AdminLayout title="Pending Fees Setup">
      <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        This utility sets assumed pending months. Do NOT use after fee
        collection begins.
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Class</label>
          <select
            className="border px-3 py-2 rounded text-sm"
            value={classId}
            onChange={(e) => applyFilter("class_id", e.target.value)}
          >
            <option value="">Select class (required)</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Section</label>
          <select
            className="border px-3 py-2 rounded text-sm"
            value={sectionId}
            disabled={!classId}
            onChange={(e) => applyFilter("section_id", e.target.value)}
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">
            Student Search
          </label>
          <input
            className="border px-3 py-2 rounded text-sm w-64"
            placeholder="Name or student ID"
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              applySearchLive(value);
            }}
            disabled={!classId}
          />
        </div>
        </div>

        <button
          className="px-4 py-2 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          onClick={saveAll}
          disabled={!hasRequiredFilters || dirtyRows.length === 0}
        >
          Save Changes
        </button>
      </div>

      {!hasRequiredFilters ? (
        <div className="text-sm text-gray-600">
          Select a class to view and edit pending fees.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="min-w-[900px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 z-10 bg-gray-50">
                  Student
                </th>
                <th className="px-3 py-2 text-left">Father Name</th>
                <th className="px-3 py-2 text-left">Class</th>
                <th className="px-3 py-2 text-left">Section</th>
                <th className="px-3 py-2 text-left">Monthly Fee</th>
                <th className="px-3 py-2 text-left">
                  Assumed Pending Months
                </th>
                <th className="px-3 py-2 text-left">Pending Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const value = edits[row.id] ?? 0;
                const effectiveFee = Number(row.effective_monthly_fee || 0);
                const pendingAmount = Number(
                  row?.pending_amount_prefix_sums?.[Number(value)] ?? 0
                );
                const locked = row.has_payments;
                const isFree = effectiveFee === 0;

                return (
                  <tr key={row.id} className="border-b">
                    <td className="px-3 py-2 sticky left-0 z-10 bg-white">
                      {row.student_name}
                    </td>
                    <td className="px-3 py-2">{row.father_name || "-"}</td>
                    <td className="px-3 py-2">{row.class_name}</td>
                    <td className="px-3 py-2">
                      {row.section_name || "-"}
                    </td>
                    <td className="px-3 py-2">Rs {effectiveFee}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="255"
                          className="border px-2 py-1 rounded text-sm w-24"
                          value={value}
                          onChange={(e) =>
                            onChangeMonths(row.id, e.target.value)
                          }
                          disabled={locked || isFree}
                        />
                        {locked && (
                          <span
                            className="text-xs text-gray-500"
                            title="Pending months are locked after fee collection."
                          >
                            Locked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">Rs {pendingAmount}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {isFree ? "✅ Free" : locked ? "🔒 Locked" : "Editable"}
                    </td>
                  </tr>
                );
              })}

              {displayRows.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-gray-500"
                    colSpan={8}
                  >
                    No students found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
