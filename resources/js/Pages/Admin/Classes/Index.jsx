import AdminLayout from "@/Layouts/AdminLayout";
import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import DataTable from "@/Components/DataTable";

/*
 * Stage B10 — full-class-creation modal.
 *
 * Replaces the silent-failure inline-row pattern with an explicit form so a
 * new class cannot land in the database without conscious Stage B config:
 * attendance days (Mon-Sat default, Sunday-only for Kirtan name), monthly
 * fee toggle + amount. The division slug is auto-derived from the name and
 * stored explicitly on `classes.division` so DivisionTypeResolver picks the
 * right bucket regardless of the legacy `type` heuristic.
 *
 * The two creation paths coexist:
 *   - inline "+ Add Class" row: minimal default config (Mon-Sat, no fees)
 *   - modal "+ New Class": full Stage B config the user picks explicitly
 */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function deriveDivisionSlug(name) {
  const slug = (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "class";
}

function isKirtanName(name) {
  return (name || "").toLowerCase().trim() === "kirtan";
}

const DEFAULT_CREATE_STATE = () => ({
  name: "",
  attendanceDays: [1, 2, 3, 4, 5, 6],
  chargesMonthlyFee: false,
  defaultMonthlyFee: 0,
});

export default function Index() {
  const [data, setData] = useState([]);
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
    sectionOptions: [],
    resetSectionIds: [],
  });

  const [createModal, setCreateModal] = useState({
    open: false,
    saving: false,
    ...DEFAULT_CREATE_STATE(),
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
      const [periodsRes, sectionsRes] = await Promise.all([
        window.axios.get(`/admin/classes/${row.original.id}/fee-periods`, {
          headers: { Accept: "application/json" },
        }),
        window.axios.get(`/admin/sections/options?class_id=${row.original.id}&include_meta=1`, {
          headers: { Accept: "application/json" },
        }),
      ]);
      const payload = periodsRes?.data ?? {};
      const sections = (sectionsRes?.data ?? []).map((s) => ({
        ...s,
        has_timeline: Boolean(s?.has_timeline),
      }));
      setFeeModal({
        open: true,
        classId: row.original.id,
        className: row.original.name,
        periods: payload.periods ?? [],
        editingId: null,
        amount: 0,
        effective_from: "",
        effective_to: "",
        sectionOptions: sections,
        resetSectionIds: [],
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
      const res = await window.axios.request({
        url,
        method: method.toLowerCase(),
        headers: { Accept: "application/json" },
        data: {
          amount: Number(feeModal.amount || 0),
          effective_from: feeModal.effective_from,
          effective_to: feeModal.effective_to || null,
          reset_section_ids: feeModal.resetSectionIds,
        },
      });

      const sectionSync = res?.data?.section_sync;
      if ((sectionSync?.updated ?? 0) > 0) {
        const timelineNote =
          (sectionSync?.timelines_zeroed ?? 0) > 0
            ? `, and zeroed ${sectionSync.timelines_zeroed} section timeline period(s)`
            : "";
        toast.success(
          `Updated ${sectionSync.updated} section legacy fee(s) to Rs. 0${timelineNote}`
        );
      }

      await openFeeTimeline({ original: { id: feeModal.classId, name: feeModal.className } });
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
      await window.axios.delete(`/admin/classes/${feeModal.classId}/fee-periods/${periodId}`, {
        headers: { Accept: "application/json" },
      });

      await openFeeTimeline({ original: { id: feeModal.classId, name: feeModal.className } });
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

  function toggleResetSection(sectionId, checked) {
    setFeeModal((prev) => {
      const next = new Set(prev.resetSectionIds ?? []);
      if (checked) {
        next.add(Number(sectionId));
      } else {
        next.delete(Number(sectionId));
      }
      return { ...prev, resetSectionIds: Array.from(next) };
    });
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

  function openCreateModal() {
    setCreateModal({ open: true, saving: false, ...DEFAULT_CREATE_STATE() });
  }

  function closeCreateModal() {
    setCreateModal({ open: false, saving: false, ...DEFAULT_CREATE_STATE() });
  }

  function updateCreateField(patch) {
    setCreateModal((prev) => ({ ...prev, ...patch }));
  }

  // Name change keeps the rest of the form in sync: a Kirtan name snaps
  // attendance to Sunday-only, any other name defaults to Mon-Sat.
  function onCreateNameChange(value) {
    const next = { name: value };
    if (isKirtanName(value)) {
      next.attendanceDays = [0];
      next.chargesMonthlyFee = false;
    } else if (isKirtanName(createModal.name)) {
      // User just renamed away from "Kirtan" — restore Mon-Sat default.
      next.attendanceDays = [1, 2, 3, 4, 5, 6];
    }
    updateCreateField(next);
  }

  function toggleAttendanceDay(day, checked) {
    setCreateModal((prev) => {
      const set = new Set(prev.attendanceDays);
      if (checked) {
        set.add(day);
      } else {
        set.delete(day);
      }
      return { ...prev, attendanceDays: Array.from(set).sort((a, b) => a - b) };
    });
  }

  async function submitCreate() {
    const name = (createModal.name || "").trim();
    if (!name) {
      toast.error("Class name cannot be empty");
      return;
    }
    if (createModal.attendanceDays.length === 0) {
      toast.error("Pick at least one attendance day");
      return;
    }

    setCreateModal((prev) => ({ ...prev, saving: true }));
    try {
      await window.axios.post(
        "/admin/classes/save",
        {
          classes: [
            {
              name,
              attendance_days: createModal.attendanceDays,
              charges_monthly_fee: createModal.chargesMonthlyFee,
              default_monthly_fee: Number(createModal.defaultMonthlyFee || 0),
            },
          ],
        },
        { headers: { Accept: "application/json" } }
      );
      toast.success(`Created class "${name}"`);
      closeCreateModal();
      loadData();
    } catch (err) {
      const payload = err?.response?.data;
      const msg =
        payload?.message || Object.values(payload?.errors ?? {}).flat()?.[0] || err?.message;
      toast.error(msg || "Could not create class");
      setCreateModal((prev) => ({ ...prev, saving: false }));
    }
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

          <button onClick={openCreateModal} className="px-4 py-2 bg-indigo-600 text-white rounded">
            + New Class
          </button>

          <button onClick={saveChanges} className="px-4 py-2 bg-green-600 text-white rounded">
            Save Changes
          </button>
        </div>
      </div>

      <DataTable
        data={data}
        columns={columns}
        sortable
        pagination
        getRowId={(row) => (row.id ? `class-${row.id}` : row.__tempId)}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        globalFilterFn="includesString"
        containerClassName="bg-white border rounded overflow-auto"
        tableClassName="min-w-full text-sm"
        theadClassName="bg-gray-50 border-b"
        headerCellClassName="px-3 py-2 text-left font-medium"
        bodyRowClassName="border-b hover:bg-gray-50"
      />

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

            <div className="mb-3 border rounded p-3 bg-amber-50/40">
              <p className="text-sm font-medium text-slate-800 mb-1">Optional: reset section legacy fee to inherit class</p>
              <p className="text-xs text-slate-600 mb-2">
                Selected sections will get legacy fee <span className="font-semibold">Rs. 0</span>. Section timelines still override class where configured.
              </p>
              <div className="max-h-36 overflow-auto space-y-1">
                {(feeModal.sectionOptions ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500">No sections found for this class.</p>
                ) : (
                  feeModal.sectionOptions.map((section) => (
                    <label key={section.id} className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1 bg-white">
                      <span>
                        {section.name} <span className="text-gray-500">(Legacy: Rs. {section.monthly_fee ?? 0})</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {section.has_timeline ? (
                          <span className="text-amber-700">Has timeline</span>
                        ) : (
                          <span className="text-emerald-700">No timeline</span>
                        )}
                        <input
                          type="checkbox"
                          checked={(feeModal.resetSectionIds ?? []).includes(Number(section.id))}
                          onChange={(e) => toggleResetSection(section.id, e.target.checked)}
                        />
                      </span>
                    </label>
                  ))
                )}
              </div>
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

      {createModal.open && (
        <CreateClassModal
          state={createModal}
          onChange={updateCreateField}
          onNameChange={onCreateNameChange}
          onToggleDay={toggleAttendanceDay}
          onSubmit={submitCreate}
          onClose={closeCreateModal}
        />
      )}
    </AdminLayout>
  );
}

function CreateClassModal({
  state,
  onChange,
  onNameChange,
  onToggleDay,
  onSubmit,
  onClose,
}) {
  const derivedSlug = deriveDivisionSlug(state.name);
  const kirtanBanner = isKirtanName(state.name);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-xl w-full max-w-lg p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-base">Create a new class</h3>
            <p className="text-xs text-gray-500">
              The division tag is auto-derived from the class name and stored
              explicitly so the resolvers, dashboard, fees, attendance and
              reports all pick the right bucket.
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-500">
            Close
          </button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Class name</label>
          <input
            autoFocus
            type="text"
            value={state.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Music, Tabla, Punjabi"
            className="w-full px-3 py-2 border rounded text-sm"
          />
          <div className="text-[11px] text-gray-500 mt-1">
            Division tag:&nbsp;
            <span className="font-mono font-medium text-gray-700">{derivedSlug}</span>
          </div>
        </div>

        {kirtanBanner && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2 text-xs">
            Kirtan name detected — defaulted to <b>Sundays only</b> with no
            monthly fees. Override the days below if that's not what you want.
          </div>
        )}

        <div>
          <div className="text-xs text-gray-500 mb-1">Attendance days</div>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, day) => {
              const checked = state.attendanceDays.includes(day);
              return (
                <label
                  key={day}
                  className={[
                    "px-3 py-1.5 rounded-full border text-xs cursor-pointer select-none",
                    checked
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={(e) => onToggleDay(day, e.target.checked)}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="border rounded p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.chargesMonthlyFee}
              onChange={(e) =>
                onChange({ chargesMonthlyFee: e.target.checked })
              }
            />
            <span>Charges a monthly fee</span>
          </label>
          {state.chargesMonthlyFee && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Monthly fee amount (Rs.)
              </label>
              <input
                type="number"
                min="0"
                value={state.defaultMonthlyFee}
                onChange={(e) =>
                  onChange({ defaultMonthlyFee: Number(e.target.value || 0) })
                }
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded bg-white text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={state.saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            {state.saving ? "Creating…" : "Create class"}
          </button>
        </div>
      </div>
    </div>
  );
}
