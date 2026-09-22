import AdminLayout from "@/Layouts/AdminLayout";
import { router } from "@inertiajs/react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function MultiClassFeeCorrection() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState({});
  const [expanded, setExpanded] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadCandidates = useCallback(async (q) => {
    setLoading(true);
    try {
      const url = route(
        "admin.utilities.multi-class-fee-correction.candidates",
        q ? { search: q } : {}
      );
      const res = await window.axios.get(url);
      const data = res.data;
      setStudents(data.students || []);
      const next = {};
      (data.students || []).forEach((s) => {
        next[s.target.id] = s.target.assumed_pending_months ?? 0;
      });
      setEdits(next);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Unable to load multi-class students.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates("");
  }, [loadCandidates]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== searchInput) {
        setSearch(searchInput);
        loadCandidates(searchInput);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, search, loadCandidates]);

  function onChangeMonths(targetId, value) {
    const n = value === "" ? 0 : Number(value);
    setEdits((prev) => ({ ...prev, [targetId]: n }));
  }

  async function openPreview(student) {
    const n = Number(edits[student.target.id] ?? 0);
    setPreviewing(true);
    try {
      const res = await window.axios.post(
        route("admin.utilities.multi-class-fee-correction.preview"),
        {
          student_section_id: student.target.id,
          pending_months: n,
        }
      );
      setPreview({ ...res.data, student });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function applyCorrection(student) {
    const n = Number(edits[student.target.id] ?? 0);
    setApplying(true);
    try {
      const res = await window.axios.post(
        route("admin.utilities.multi-class-fee-correction.apply"),
        {
          student_section_id: student.target.id,
          pending_months: n,
        }
      );
      const data = res.data;
      if (data.reference_unchanged === false) {
        toast.error("Reference enrollment changed unexpectedly — abort.");
        return;
      }
      toast.success("Kirtan pending months corrected. Gurmukhi untouched.");
      setPreview(null);
      await loadCandidates(search);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Correction failed.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <AdminLayout title="Multi-Class Fee Correction">
      <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        For students in <strong>Gurmukhi + Kirtan</strong> only. Gurmukhi is the
        reference enrollment (never modified). Review and explicitly confirm the
        Kirtan pending months — nothing is repaired automatically.
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-gray-500">Student search</label>
          <input
            className="w-64 rounded border px-3 py-2 text-sm"
            placeholder="Name or student ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => loadCandidates(searchInput)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading candidates…</div>
      ) : students.length === 0 ? (
        <div className="text-sm text-gray-600">
          No active Gurmukhi + Kirtan students found.
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((s) => {
            const isOpen = Boolean(expanded[s.student_id]);
            const n = edits[s.target.id] ?? 0;
            const locked = s.target.has_payments;
            const nonCharging = !s.target.charges_monthly_fee;

            return (
              <div
                key={s.student_id}
                className="rounded-lg border bg-white shadow-sm"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [s.student_id]: !prev[s.student_id],
                    }))
                  }
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {s.student_name}
                      {s.father_name ? (
                        <span className="ml-2 font-normal text-gray-500">
                          s/o {s.father_name}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Gurmukhi {s.reference.fee_months_count} months · Kirtan{" "}
                      {s.target.fee_months_count} months
                    </div>
                  </div>
                  <span className="text-xs text-blue-600">
                    {isOpen ? "Hide" : "Review"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-4">
                    <div className="mb-3 text-sm font-medium text-gray-700">
                      Classes:
                    </div>
                    <div className="mb-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded border border-green-200 bg-green-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-green-800">
                          ✓ Gurmukhi — reference enrollment
                        </div>
                        <div className="mt-1 text-sm text-gray-800">
                          {s.reference.class_name}
                          {s.reference.section_name
                            ? ` · ${s.reference.section_name}`
                            : ""}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Existing fee records:{" "}
                          <strong>{s.reference.fee_months_count} months</strong>
                          {" — "}DO NOT MODIFY
                        </div>
                        <div className="text-xs text-gray-500">
                          Enrollment #{s.reference.id}
                        </div>
                      </div>
                      <div className="rounded border border-amber-300 bg-amber-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                          ⚠ Kirtan — correction target
                        </div>
                        <div className="mt-1 text-sm text-gray-800">
                          {s.target.class_name}
                          {s.target.section_name
                            ? ` · ${s.target.section_name}`
                            : ""}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Existing fee records:{" "}
                          <strong>{s.target.fee_months_count} months</strong>
                        </div>
                        <div className="text-xs text-gray-500">
                          Enrollment #{s.target.id}
                          {locked ? " · Locked (payments exist)" : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-end gap-3">
                      <div className="flex flex-col">
                        <label className="mb-1 text-xs text-gray-500">
                          Kirtan pending months
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="255"
                          className="w-28 rounded border px-2 py-1 text-sm"
                          value={n}
                          disabled={locked}
                          onChange={(e) =>
                            onChangeMonths(s.target.id, e.target.value)
                          }
                        />
                      </div>
                      {locked && (
                        <span className="text-xs text-gray-500">
                          Pending months are locked after fee collection.
                        </span>
                      )}
                      {!locked && nonCharging && n > 0 && (
                        <span className="text-xs text-red-600">
                          This Kirtan class does not charge a monthly fee — N
                          must be 0.
                        </span>
                      )}
                      <button
                        type="button"
                        className="rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        disabled={locked || previewing}
                        onClick={() => openPreview(s)}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={locked || applying}
                        onClick={() => applyCorrection(s)}
                      >
                        Apply to Kirtan only
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-gray-800">
              Preview correction
            </h2>
            <p className="mb-3 text-sm text-gray-600">
              Target: Kirtan enrollment #{preview.target?.id} only. Gurmukhi
              reference #{preview.reference?.id} will not be modified.
            </p>

            <div className="mb-3 rounded bg-gray-50 p-3 text-sm">
              <div>
                Existing Kirtan fee months:{" "}
                <strong>{preview.existing_months?.length ?? 0}</strong>
              </div>
              <div>
                Desired pending months:{" "}
                <strong>{preview.pending_months}</strong>
              </div>
            </div>

            <div className="mb-3 text-sm">
              <div className="mb-1 font-medium text-gray-700">Will create:</div>
              {preview.will_create?.length ? (
                <div className="flex flex-wrap gap-1">
                  {preview.will_create.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">None</div>
              )}
            </div>

            <div className="mb-4 text-sm">
              <div className="mb-1 font-medium text-gray-700">
                Will delete (unpaid only):
              </div>
              {preview.will_delete_unpaid?.length ? (
                <div className="flex flex-wrap gap-1">
                  {preview.will_delete_unpaid.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">None</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={applying}
                onClick={() => applyCorrection(preview.student)}
              >
                Apply to Kirtan only
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
