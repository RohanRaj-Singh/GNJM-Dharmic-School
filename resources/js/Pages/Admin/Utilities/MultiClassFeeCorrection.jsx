import AdminLayout from "@/Layouts/AdminLayout";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtMonth = (ym) => {
  if (!ym || !ym.includes("-")) return ym;
  const [y, m] = ym.split("-");
  const mi = parseInt(m, 10);
  return `${MONTH_NAMES[mi - 1]} ${y}`;
};

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

  // Bulk review / apply
  const [reviewOpen, setReviewOpen] = useState(false);
  const [previews, setPreviews] = useState({});
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [applyingBulk, setApplyingBulk] = useState(false);
  const previewTimeouts = useRef({});

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
      setExpanded({});
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

  const originalValue = (s) => Number(s.target.assumed_pending_months ?? 0);
  const currentEdit = (s) => Number(edits[s.target.id] ?? originalValue(s));
  const isChanged = (s) => currentEdit(s) !== originalValue(s);
  const hasPayments = (s) => Boolean(s.target.has_payments);
  const isNonCharging = (s) => !s.target.charges_monthly_fee;

  const changedStudents = students.filter(isChanged);
  const changedCount = changedStudents.length;

  function onChangeMonths(targetId, value) {
    const n = value === "" ? 0 : Number(value);
    setEdits((prev) => ({ ...prev, [targetId]: n }));

    // If the review modal is open, refresh that row's preview so the
    // create/delete summary stays accurate as the value changes.
    if (reviewOpen) {
      const student = students.find((s) => s.target.id === targetId);
      if (student) {
        clearTimeout(previewTimeouts.current[targetId]);
        previewTimeouts.current[targetId] = setTimeout(
          () => fetchPreview(student, n),
          350
        );
      }
    }
  }

  function clearAllChanges() {
    setEdits((prev) => {
      const next = {};
      students.forEach((s) => {
        next[s.target.id] = originalValue(s);
      });
      return next;
    });
  }

  function revertStudent(s) {
    setEdits((prev) => ({ ...prev, [s.target.id]: originalValue(s) }));
    setPreviews((prev) => {
      const copy = { ...prev };
      delete copy[s.target.id];
      return copy;
    });
  }

  const fetchPreview = useCallback(async (student, value) => {
    try {
      const res = await window.axios.post(
        route("admin.utilities.multi-class-fee-correction.preview"),
        {
          student_section_id: student.target.id,
          pending_months: Number(value ?? 0),
        }
      );
      setPreviews((prev) => ({ ...prev, [student.target.id]: res.data }));
    } catch (e) {
      setPreviews((prev) => ({
        ...prev,
        [student.target.id]: {
          error: e?.response?.data?.message || "Preview failed.",
          pending_months: Number(value ?? 0),
        },
      }));
    }
  }, []);

  async function openPreview(student) {
    const n = currentEdit(student);
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
    const n = currentEdit(student);
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

  async function openReview() {
    setReviewOpen(true);
    setLoadingReviews(true);
    try {
      await Promise.all(
        changedStudents.map((s) => fetchPreview(s, currentEdit(s)))
      );
    } finally {
      setLoadingReviews(false);
    }
  }

  async function applyBulk() {
    // Exclude rows the client already knows are invalid (non-charging class
    // with a positive value) or that the server preview rejected, so a single
    // bad row doesn't block the rest. The server stays atomic as a backstop.
    const skipped = [];
    const corrections = [];
    for (const s of changedStudents) {
      const n = currentEdit(s);
      const invalid = !s.target.charges_monthly_fee && n > 0;
      const errored = previews[s.target.id]?.error;
      if (invalid || errored) {
        skipped.push(s.student_name);
      } else {
        corrections.push({
          student_section_id: s.target.id,
          pending_months: n,
        });
      }
    }

    if (corrections.length === 0) {
      toast.error(
        "No valid corrections to apply — check for invalid or errored rows."
      );
      return;
    }

    setApplyingBulk(true);
    try {
      const res = await window.axios.post(
        route("admin.utilities.multi-class-fee-correction.bulk-apply"),
        { corrections }
      );
      let msg = `${res.data.applied?.length ?? 0} student(s) corrected.`;
      if (skipped.length) {
        msg += ` ${skipped.length} invalid row(s) skipped.`;
      }
      toast.success(msg);
      setReviewOpen(false);
      setPreviews({});
      await loadCandidates(search);
    } catch (e) {
      const data = e?.response?.data;
      if (data?.errors) {
        toast.error(data.message || "Some students could not be corrected.");
      } else {
        toast.error(data?.message || "Bulk apply failed.");
      }
    } finally {
      setApplyingBulk(false);
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

      {/* Bulk action bar — appears when there are pending edits */}
      {changedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="text-sm">
            <strong className="text-blue-900">{changedCount}</strong>{" "}
            {changedCount === 1 ? "change" : "changes"} pending review.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              onClick={clearAllChanges}
            >
              Clear all changes
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={openReview}
            >
              Review &amp; Apply All
            </button>
          </div>
        </div>
      )}

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
            const n = currentEdit(s);
            const paid = hasPayments(s);
            const nonCharging = isNonCharging(s);
            const changed = isChanged(s);

            return (
              <div
                key={s.student_id}
                className={`
                  relative rounded-lg border-l-4 bg-white shadow-sm
                  transition-colors
                  ${
                    changed
                      ? "border-l-amber-400 bg-amber-50"
                      : "border-l-transparent border-gray-200"
                  }
                `}
              >
                {/* Highlighted badge for changed students */}
                {changed && (
                  <div className="absolute top-2 right-3">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Changed
                    </span>
                  </div>
                )}

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
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">
                      {s.student_name}
                      {s.father_name ? (
                        <span className="ml-2 font-normal text-gray-500">
                          s/o {s.father_name}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs text-gray-500">
                      <span>
                        Gurmukhi {s.reference.fee_months_count} months
                      </span>
                      <span>Kirtan {s.target.fee_months_count} months</span>
                      {paid && (
                        <span className="font-medium text-amber-600">
                          · Has payments (still editable)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline edit (visible even when collapsed) */}
                  <div
                    className="flex items-center gap-2 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {changed && (
                      <span
                        className="hidden xs:inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                        aria-label="changed"
                      >
                        Changed
                      </span>
                    )}
                    <label className="text-xs text-gray-500">
                      Kirtan pending
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      className={`w-16 rounded border px-2 py-1 text-sm ${
                        nonCharging && n > 0
                          ? "border-red-400"
                          : "border-gray-300"
                      }`}
                      value={n}
                      onChange={(e) =>
                        onChangeMonths(s.target.id, e.target.value)
                      }
                    />
                    <span className="text-xs text-blue-600">
                      {isOpen ? "Hide" : "Details"}
                    </span>
                  </div>
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
                          {paid ? " · Has payments" : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 text-sm">
                      Currently set Kirtan pending months:{" "}
                      <strong>{originalValue(s)}</strong>
                      {"  ·  "}Editing value:{" "}
                      <strong
                        className={
                          nonCharging && n > 0
                            ? "text-red-600"
                            : "text-gray-800"
                        }
                      >
                        {n}
                      </strong>
                      {nonCharging && n > 0 ? (
                        <span className="ml-2 text-xs text-red-600">
                          This Kirtan class does not charge a monthly fee — N
                          must be 0.
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        disabled={previewing}
                        onClick={() => openPreview(s)}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={applying}
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

      {/* Single-student preview modal */}
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
              {preview.student &&
              currentEdit(preview.student) > preview.pending_months ? (
                <div className="mt-1 text-xs text-amber-800">
                  Clamped from {currentEdit(preview.student)} to{" "}
                  {preview.pending_months} (cap = months since last paid).
                </div>
              ) : null}
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
                      {fmtMonth(m)}
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
                      {fmtMonth(m)}
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

      {/* Bulk review modal */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="text-lg font-semibold text-gray-800">
                Review {changedCount === 1 ? "1 change" : `${changedCount} changes`}
              </h2>
              <button
                type="button"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => {
                  setReviewOpen(false);
                  setPreviews({});
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4">
              {loadingReviews ? (
                <div className="text-sm text-gray-600">
                  Loading previews…
                </div>
              ) : (
                <div className="space-y-4">
                  {changedStudents.map((s) => {
                    const p = previews[s.target.id];
                    const n = currentEdit(s);
                    const invalid =
                      !s.target.has_payments && !s.target.charges_monthly_fee && n > 0;
                    return (
                      <div
                        key={s.target.id}
                        className="rounded-lg border border-gray-200 p-3 text-sm"
                      >
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                          <div className="font-medium text-gray-800">
                            {s.student_name}
                            {s.father_name ? (
                              <span className="ml-2 font-normal text-gray-500">
                                s/o {s.father_name}
                              </span>
                            ) : null}
                          </div>
                          {p?.error && (
                            <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                              {p.error}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 grid gap-2 text-xs text-gray-600 md:grid-cols-2">
                          <div>
                            Gurmukhi reference:{" "}
                            <strong>{s.reference.fee_months_count} months</strong>
                          </div>
                          <div>
                            Kirtan existing:{" "}
                            <strong>{s.target.fee_months_count} months</strong>
                          </div>
                          <div>
                            Kirtan desired:{" "}
                            <input
                              type="number"
                              min="0"
                              max="255"
                              className={`w-16 rounded border px-1.5 py-0.5 text-xs ${
                                invalid
                                  ? "border-red-400"
                                  : "border-gray-300"
                              }`}
                              value={n}
                              onChange={(e) =>
                                onChangeMonths(s.target.id, e.target.value)
                              }
                            />
                          </div>
                          <div>
                            Gurmukhi reference:{" "}
                            <span className="font-normal text-gray-500">
                              enrollment #{s.reference.id} (untouched)
                            </span>
                          </div>
                        </div>

                        {p && !p.error && n > p.pending_months ? (
                          <div className="mt-2 text-xs text-amber-800">
                            Clamped from {n} to {p.pending_months} (cap = months
                            since last paid).
                          </div>
                        ) : null}

                        {p && !p.error ? (
                          <div className="mt-2 space-y-1.5 text-xs">
                            <div>
                              Will create (
                              {p.will_create?.length ?? 0}):{" "}
                              <span className="inline-flex flex-wrap gap-1">
                                {(p.will_create ?? []).map((m) => (
                                  <span
                                    key={"c" + m}
                                    className="rounded bg-green-100 px-1.5 py-0.5 text-green-800"
                                  >
                                    {fmtMonth(m)}
                                  </span>
                                ))}
                                {p.will_create?.length === 0 && (
                                  <span className="text-gray-400">None</span>
                                )}
                              </span>
                            </div>
                            <div>
                              Will delete unpaid (
                              {p.will_delete_unpaid?.length ?? 0}):{" "}
                              <span className="inline-flex flex-wrap gap-1">
                                {(p.will_delete_unpaid ?? []).map((m) => (
                                  <span
                                    key={"d" + m}
                                    className="rounded bg-red-100 px-1.5 py-0.5 text-red-800"
                                  >
                                    {fmtMonth(m)}
                                  </span>
                                ))}
                                {p.will_delete_unpaid?.length === 0 && (
                                  <span className="text-gray-400">None</span>
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs italic text-gray-400">
                            Preview not available.
                          </div>
                        )}

                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                            onClick={() => revertStudent(s)}
                          >
                            Revert
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() => {
                  setReviewOpen(false);
                  setPreviews({});
                }}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={applyingBulk || loadingReviews || changedCount === 0}
                onClick={applyBulk}
              >
                {applyingBulk
                  ? "Applying…"
                  : `Apply All ${changedCount} Change${changedCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
