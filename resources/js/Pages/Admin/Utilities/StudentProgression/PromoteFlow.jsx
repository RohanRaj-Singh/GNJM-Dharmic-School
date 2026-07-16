import { useState, useMemo } from "react";
import Modal from "@/Components/Modal";
import ImpactSummary from "./ImpactSummary";
import { MOCK_CLASSES, MOCK_SECTIONS, MOCK_ENROLLMENTS, MOCK_STUDENTS, resolveNextClassForEnrollments } from "./mockData";

const STEPS = ["Destination", "Impact", "Confirm"];

export default function PromoteFlow({ student, onClose, preselectedIds = null }) {
  const allIds = preselectedIds || [student.id];
  const students = useMemo(
    () => allIds.map((id) => MOCK_STUDENTS.find((s) => s.id === id)).filter(Boolean),
    [allIds]
  );
  const isBulk = students.length > 1;
  const leadStudent = students[0];

  const [step, setStep] = useState(0);
  const [targetSectionId, setTargetSectionId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);

  const leadEnrollments = MOCK_ENROLLMENTS[leadStudent.id] || [];
  const autoTargets = useMemo(
    () => resolveNextClassForEnrollments(leadEnrollments),
    [leadEnrollments]
  );

  const firstTarget = autoTargets[0] || null;
  const targetClassId = firstTarget ? String(firstTarget.nextClass.id) : null;
  const targetClass = firstTarget ? firstTarget.nextClass : null;

  const sections = useMemo(
    () => (targetClassId ? MOCK_SECTIONS[targetClassId] || [] : []),
    [targetClassId]
  );

  const validTarget = targetClassId && targetSectionId && effectiveDate;

  const totalOutstandings = useMemo(
    () => students.reduce((sum, s) => sum + s.outstandings, 0),
    [students]
  );

  const handleExecute = () => {
    setDone(true);
  };

  if (done) {
    return (
      <Modal show maxWidth="lg" onClose={onClose}>
        <div className="p-8 text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-lg font-semibold text-gray-800">Promotion Complete</h2>
          <p className="text-sm text-gray-500">
            {isBulk
              ? <>{students.length} students have been promoted.</>
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

  if (!targetClass) {
    return (
      <Modal show maxWidth="sm" onClose={onClose}>
        <div className="p-6 text-center space-y-4">
          <div className="text-5xl">🚫</div>
          <h2 className="text-lg font-semibold text-gray-800">Cannot Promote</h2>
          <p className="text-sm text-gray-500">
            <strong>{leadStudent.name}</strong> is already in the highest available class and cannot be promoted further.
          </p>
          <p className="text-sm text-gray-400">
            Consider using <strong>Pass Out</strong> if the student has completed their studies.
          </p>
          <button onClick={onClose} className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Close</button>
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
                ? `${students.length} students selected for promotion`
                : `Move ${leadStudent.name} to the next class.`}
            </p>
          </div>

          {isBulk && (
            <div className="flex-shrink-0 border rounded-lg divide-y text-sm max-h-32 overflow-y-auto bg-white">
              {students.map((s) => {
                const enrollments = MOCK_ENROLLMENTS[s.id] || [];
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50">
                    <span className="font-medium text-gray-800">{s.name}</span>
                    <span className="text-xs text-gray-500">{enrollments.map((e) => e.className).join(", ")}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={i === step ? "font-medium text-gray-800" : "text-gray-400"}>{label}</span>
                {i < STEPS.length - 1 && <span className="text-gray-200 mx-0.5">→</span>}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4 flex-shrink-0">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-gray-700">Current Enrollment{isBulk ? "s" : ""}</p>
                {isBulk ? (
                  <p className="text-gray-500">{students.length} active enrollment(s) across selected students.</p>
                ) : (
                  leadEnrollments.map((e, i) => (
                    <p key={i} className="text-gray-500">{e.className} — {e.sectionName} (since {e.startedAt})</p>
                  ))
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2.5">
                <span className="text-lg mt-0.5">🔄</span>
                <div>
                  <p className="font-medium">Target class auto-detected</p>
                  <p className="text-blue-700 mt-0.5">
                    Based on the current enrollment, the next class is <strong>{targetClass.name}</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Class</label>
                  <div className="border rounded px-3 py-2 text-sm w-full bg-gray-50 text-gray-700 flex items-center gap-2">
                    {targetClass.name}
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded">Auto</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Section</label>
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                  >
                    <option value="">Select section</option>
                    {sections.map((s) => (
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
                studentName={leadStudent.name}
                currentEnrollments={leadEnrollments}
                targetClassName={targetClass.name}
                targetSectionName={sections.find((s) => s.id == targetSectionId)?.name}
                effectiveDate={effectiveDate}
                outstandings={totalOutstandings}
                students={isBulk ? students : null}
              />

              {totalOutstandings > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <p>
                    <strong>Outstanding fees:</strong> Rs. {totalOutstandings.toLocaleString()} across {students.length} student(s).
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
                studentName={leadStudent.name}
                currentEnrollments={leadEnrollments}
                targetClassName={targetClass.name}
                targetSectionName={sections.find((s) => s.id == targetSectionId)?.name}
                effectiveDate={effectiveDate}
                outstandings={totalOutstandings}
                compact
                students={isBulk ? students : null}
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
                  I understand that this will close {isBulk ? `${students.length} enrollments` : "the current enrollment"} and create {isBulk ? "new ones" : "a new one"}.
                  All historical data will be preserved.
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50">Back</button>
                <button
                  onClick={handleExecute}
                  disabled={!confirmed}
                  className="px-6 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Execute Promotion
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
