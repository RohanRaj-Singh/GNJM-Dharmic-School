import { useState, useMemo, useCallback, useEffect } from "react";
import axios from "axios";
import Modal from "@/Components/Modal";
import ImpactSummary from "./ImpactSummary";

export default function PromoteFlow({ student, students, classes, sections: propSections, onClose, preselectedIds = null }) {
  const allIds = preselectedIds || [student.id];
  const selectedStudents = useMemo(
    () => allIds.map((id) => students.find((s) => s.id === id)).filter(Boolean),
    [allIds, students]
  );
  const isBulk = selectedStudents.length > 1;
  const leadStudent = selectedStudents[0];

  // Suggest the current class as default — admin can change to any class
  const suggestedClassId = useMemo(() => {
    if (!leadStudent?.enrollments?.length) return "";
    const gurmukhi = leadStudent.enrollments.find(
      (e) => !e.className?.toLowerCase().includes("kirtan")
    );
    return gurmukhi ? String(gurmukhi.classId) : String(leadStudent.enrollments[0].classId);
  }, [leadStudent]);

  const [step, setStep] = useState(0);
  const [targetClassId, setTargetClassId] = useState(suggestedClassId);
  const [targetSectionId, setTargetSectionId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [lazySections, setLazySections] = useState([]);

  // Merge prop sections with lazily fetched sections for the target class
  const allSections = useMemo(
    () => (propSections?.length ? propSections : lazySections),
    [propSections, lazySections]
  );

  // Fetch sections lazily when target class changes and parent hasn't loaded them
  useEffect(() => {
    if (!targetClassId) return;
    const hasSections = (propSections || []).some((s) => String(s.class_id) === String(targetClassId));
    if (hasSections) return;
    axios.get(`/admin/sections/options?class_id=${targetClassId}`)
      .then((r) => setLazySections(r.data))
      .catch(() => setLazySections([]));
  }, [targetClassId, propSections]);

  const sectionOpts = useMemo(
    () => allSections.filter((s) => String(s.class_id) === String(targetClassId)),
    [allSections, targetClassId]
  );

  const validTarget = targetClassId && targetSectionId && effectiveDate;

  const totalOutstandings = useMemo(
    () => selectedStudents.reduce((sum, s) => sum + (s.outstandings || 0), 0),
    [selectedStudents]
  );

  const targetClassName = useMemo(
    () => classes.find((c) => String(c.id) === String(targetClassId))?.name || "",
    [classes, targetClassId]
  );
  const targetSectionName = useMemo(
    () => sectionOpts.find((s) => String(s.id) === String(targetSectionId))?.name || "",
    [sectionOpts, targetSectionId]
  );

  const submitAll = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    const promises = selectedStudents.map((s) =>
      axios.post(`/students/${s.id}/promote`, {
        section_id: targetSectionId,
        effective_date: effectiveDate,
      })
    );
    try {
      await Promise.all(promises);
      setDone(true);
    } catch (e) {
      const msg = e.response?.data?.errors?.lifecycle?.[0] || e.response?.data?.message || "Promotion failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedStudents, targetSectionId, effectiveDate]);

  if (done) {
    return (
      <Modal show maxWidth="lg" onClose={onClose}>
        <div className="p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-lg font-semibold text-gray-800">Promotion Complete</h2>
          <p className="text-sm text-gray-500">
            {isBulk
              ? <>{selectedStudents.length} students have been promoted.</>
              : <><strong>{leadStudent.name}</strong> has been promoted.</>}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 text-left max-w-sm mx-auto space-y-1">
            <p>✓ Previous enrollment(s) closed with outcome: <strong>Promoted</strong></p>
            <p>✓ New enrollment(s) created</p>
            <p>✓ All historical records preserved</p>
            <p>✓ New fee lifecycle started</p>
          </div>
          <button onClick={onClose} className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal show maxWidth="lg" onClose={onClose}>
      <div className="max-h-[85vh] min-h-0 flex flex-col">
        <div className="p-6 pb-0 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-800">Promote Student{isBulk ? "s" : ""}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isBulk
                ? `${selectedStudents.length} students selected for promotion`
                : `Choose a target class for ${leadStudent.name}.`}
            </p>
          </div>

          {isBulk && (
            <div className="flex-shrink-0 border rounded-lg divide-y text-sm max-h-32 overflow-y-auto bg-white">
              {selectedStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50">
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <span className="text-xs text-gray-500">
                    {s.enrollments?.map((e) => e.className).join(", ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            {["Destination", "Impact", "Confirm"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={i === step ? "font-medium text-gray-800" : "text-gray-400"}>{label}</span>
                {i < 2 && <span className="text-gray-200 mx-0.5">→</span>}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex-shrink-0">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4 flex-shrink-0">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-700">Current Enrollment{isBulk ? "s" : ""}</p>
                {isBulk ? (
                  <p className="text-gray-500 mt-1">{selectedStudents.length} active student(s) selected.</p>
                ) : (
                  leadStudent.enrollments?.map((e, i) => (
                    <p key={i} className="text-gray-500 mt-1">{e.className} — {e.sectionName}{e.startedAt ? ` (since ${e.startedAt})` : ""}</p>
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Class</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => { setTargetClassId(e.target.value); setTargetSectionId(""); }}
                    className="border rounded px-3 py-2 text-sm w-full"
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Section</label>
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    disabled={!targetClassId}
                    className="border rounded px-3 py-2 text-sm w-full disabled:bg-gray-100"
                  >
                    <option value="">Select section</option>
                    {sectionOpts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => setStep(1)}
                  disabled={!validTarget}
                  className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next — Impact Summary
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 flex-shrink-0">
              <ImpactSummary
                type="promote"
                studentName={leadStudent?.name}
                currentEnrollments={leadStudent?.enrollments || []}
                targetClassName={targetClassName}
                targetSectionName={targetSectionName}
                effectiveDate={effectiveDate}
                outstandings={totalOutstandings}
                students={isBulk ? selectedStudents : null}
              />

              {totalOutstandings > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <p>
                    <strong>Outstanding fees:</strong> Rs. {totalOutstandings.toLocaleString()} across {selectedStudents.length} student(s).
                    These remain collectible on the previous enrollment(s) and will NOT be moved.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep(0)} className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50">Back</button>
                <button onClick={() => setStep(2)} className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Next — Confirm</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 flex-shrink-0">
              <ImpactSummary
                type="promote"
                studentName={leadStudent?.name}
                currentEnrollments={leadStudent?.enrollments || []}
                targetClassName={targetClassName}
                targetSectionName={targetSectionName}
                effectiveDate={effectiveDate}
                outstandings={totalOutstandings}
                compact
                students={isBulk ? selectedStudents : null}
              />

              <div className="flex items-start gap-3 pt-1">
                <input
                  type="checkbox"
                  id="confirm"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <label htmlFor="confirm" className="text-sm text-gray-700">
                  I understand that this will close {isBulk ? `${selectedStudents.length} enrollments` : "the current enrollment"} and create {isBulk ? "new ones" : "a new one"}.
                  All historical data will be preserved.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50">Back</button>
                <button
                  onClick={submitAll}
                  disabled={!confirmed || submitting}
                  className="px-6 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Execute Promotion"}
                </button>
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>
    </Modal>
  );
}
