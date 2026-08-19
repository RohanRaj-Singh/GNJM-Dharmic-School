import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import Modal from "@/Components/Modal";
import EnrollmentsList from "./EnrollmentsList";
import EnrollmentFeesView from "./EnrollmentFeesView";
import CollectFeeSheet from "./CollectFeeSheet";

/**
 * StudentFeeSheet — the central workspace for managing a single student's
 * fees across all their current and historical enrollments.
 *
 * Three nested views managed by the parent so we never nest modals:
 *
 *   level 1: EnrollmentsList
 *     - Current enrollments (where is_current_enrollment=true on any fee)
 *     - Previous enrollments (everything else, visually muted)
 *
 *   level 2: EnrollmentFeesView (per spec §18)
 *     - Back button → returns to level 1
 *     - Title: class · section
 *     - Totals (Unpaid / Paid)
 *     - Recent fees first; "View older fees (N)" reveals the rest
 *     - Each unpaid fee has Collect; each paid fee has Un-collect
 *
 *   level 3: CollectFeeSheet (per spec §22)
 *     - Replaces the level-2 content for a single fee; Cancel returns
 *
 * The sheet fetches detail from /admin/fees/students/{student.id}/fees on
 * open (and after every collect/un-collect). It does not modify the
 * backend contract — it consumes the endpoint that's already in the tree
 * and replays the existing collect / de-collect Inertia requests.
 *
 * Props:
 *   student   — { id, name, father_name } | null. Null = closed.
 *   onClose   — () => void, fired on close / backdrop / ESC. The parent
 *               also uses this to clear its `selectedStudent` state.
 */
export default function StudentFeeSheet({ student, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // View stack. Storing a list of {level, enrollmentId, feeId} lets "Back"
  // walk up the navigation naturally instead of trying to encode three
  // independent piece of state.
  const [history, setHistory] = useState([]);
  const [collectingFee, setCollectingFee] = useState(null);

  const refresh = useCallback(async () => {
    if (!student) return;
    // Index rows carry the id under `student_id`; the legacy `id` key is
    // still accepted so callers that build the row by hand don't have to
    // rename. Accept either.
    const studentId = student.id ?? student.student_id;
    if (studentId == null) {
      setError(new Error("Student id is missing"));
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/admin/fees/students/${studentId}/fees`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      setData(payload);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [student?.id, student?.student_id]);

  // Reset the entire view state on open so a previously drilled-into
  // enrollment doesn't bleed into the next student's sheet.
  useEffect(() => {
    if (!student) {
      setData(null);
      setHistory([]);
      setCollectingFee(null);
      setError(null);
      return;
    }
    refresh();
  }, [student, refresh]);

  // Derived: the currently displayed enrollment (when in level 2).
  const currentEnrollment = useMemo(() => {
    const frame = history[history.length - 1];
    if (!frame || frame.level !== "detail") return null;
    if (!data?.fees) return null;

    const map = new Map();
    for (const fee of data.fees) {
      const key = fee.student_section_id;
      if (key == null) continue;
      if (!map.has(key)) {
        map.set(key, {
          studentSectionId: key,
          className: fee.class_name ?? null,
          sectionName: fee.section_name ?? null,
          divisionKey: fee.division_key ?? null,
          fees: [],
          isCurrent: false,
        });
      }
      const e = map.get(key);
      e.fees.push(fee);
      if (fee.is_current_enrollment) e.isCurrent = true;
      if (!e.className && fee.class_name) e.className = fee.class_name;
      if (!e.sectionName && fee.section_name) e.sectionName = fee.section_name;
      if (!e.divisionKey && fee.division_key) e.divisionKey = fee.division_key;
    }
    const found = map.get(frame.enrollmentId);
    if (!found) return null;

    const unpaid = found.fees
      .filter((f) => !f.is_paid)
      .reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const paid = found.fees
      .filter((f) => f.is_paid)
      .reduce((s, f) => s + (Number(f.payment_amount ?? f.amount) || 0), 0);
    return {
      ...found,
      unpaid,
      paid,
      unpaidCount: found.fees.filter((f) => !f.is_paid).length,
      paidCount: found.fees.filter((f) => f.is_paid).length,
    };
  }, [history, data]);

  const handleSelectEnrollment = (enrollment) => {
    setHistory((h) => [...h, { level: "detail", enrollmentId: enrollment.studentSectionId }]);
  };

  const handleBack = () => {
    setHistory((h) => h.slice(0, -1));
  };

  const handleCollect = (fee) => {
    setCollectingFee(fee);
  };

  const handleCancelCollect = () => {
    setCollectingFee(null);
  };

  const handleCollected = useCallback(() => {
    setCollectingFee(null);
    refresh();
    // Toast is already surfaced inside CollectFeeSheet — no need to repeat.
  }, [refresh]);

  const handleDeCollect = (feeId) => {
    if (!confirm("Un-collect this fee? You can re-collect it afterwards.")) return;
    router.post(
      route("admin.fees.deCollect", feeId),
      {},
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
          refresh();
        },
      }
    );
  };

  if (!student) return null;

  const currentLevel = history[history.length - 1]?.level ?? "enrollments";

  return (
    <Modal show={!!student} onClose={onClose} maxWidth="lg">
      <div className="border-b px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {student.name}
            </h2>
            {student.father_name ? (
              <p className="mt-0.5 truncate text-xs text-gray-500">
                S/o {student.father_name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {currentLevel === "enrollments" ? (
          <EnrollmentsList
            fees={data?.fees ?? []}
            loading={loading && !data}
            onSelect={handleSelectEnrollment}
          />
        ) : null}

        {currentLevel === "detail" && currentEnrollment ? (
          <EnrollmentFeesView
            enrollment={currentEnrollment}
            onBack={handleBack}
            onCollect={handleCollect}
            onDeCollect={handleDeCollect}
            onClose={onClose}
          />
        ) : null}

        {currentLevel === "detail" && !currentEnrollment && data ? (
          <div className="rounded-lg bg-gray-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">
              Enrollment not found
            </p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[44px]"
            >
              Back to enrollments
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 ring-1 ring-red-200">
            <p className="text-sm font-medium text-red-800">
              Could not load fees
            </p>
            <p className="mt-1 text-xs text-red-700">
              {error.message || "Please retry by closing and reopening."}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 min-h-[40px] sm:min-h-[36px]"
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <CollectFeeSheet
        fee={collectingFee}
        enrollment={currentEnrollment ?? null}
        student={student}
        onClose={handleCancelCollect}
        onCollected={handleCollected}
      />
    </Modal>
  );
}