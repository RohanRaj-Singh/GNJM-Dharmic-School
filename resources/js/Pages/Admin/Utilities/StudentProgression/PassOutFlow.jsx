import { useState, useMemo } from "react";
import Modal from "@/Components/Modal";
import ImpactSummary from "./ImpactSummary";
import { MOCK_ENROLLMENTS, MOCK_STUDENTS } from "./mockData";

export default function PassOutFlow({ student, onClose, preselectedIds = null }) {
  const allIds = preselectedIds || [student.id];
  const students = useMemo(
    () => allIds.map((id) => MOCK_STUDENTS.find((s) => s.id === id)).filter(Boolean),
    [allIds]
  );
  const isBulk = students.length > 1;
  const leadStudent = students[0];

  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);

  const leadEnrollments = MOCK_ENROLLMENTS[leadStudent.id] || [];

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
          <div className="text-5xl">🎓</div>
          <h2 className="text-lg font-semibold text-gray-800">Pass Out Complete</h2>
          <p className="text-sm text-gray-500">
            {isBulk
              ? <>{students.length} students have been marked as Passed Out.</>
              : <><strong>{leadStudent.name}</strong> has been marked as Passed Out.</>}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 text-left max-w-sm mx-auto space-y-1">
            <p>✓ All enrollment(s) closed with outcome: <strong>Passed Out</strong></p>
            <p>✓ Historical records preserved</p>
            <p>✓ No future attendance or fee generation</p>
            <p>✓ Reports remain accessible</p>
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
            <h2 className="text-lg font-semibold text-gray-800">Pass Out Student{isBulk ? "s" : ""}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isBulk
                ? `${students.length} students selected to be marked as passed out`
                : `Mark ${leadStudent.name} as passed out from the school.`}
            </p>
          </div>

          {isBulk && (
            <div className="flex-shrink-0 border rounded-lg divide-y text-sm max-h-32 overflow-y-auto bg-white">
              {students.map((s) => {
                const enrollments = MOCK_ENROLLMENTS[s.id] || [];
                return (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50">
                    <span className="font-medium text-gray-800">{s.name}</span>
                    {s.outstandings > 0 && (
                      <span className="text-xs text-red-600">Rs. {s.outstandings.toLocaleString()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-shrink-0">
            <ImpactSummary
              type="passOut"
              studentName={leadStudent.name}
              currentEnrollments={leadEnrollments}
              outstandings={totalOutstandings}
              students={isBulk ? students : null}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1 flex-shrink-0">
            <p className="font-medium">What happens when a student passes out?</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>The student is marked as <strong>Passed Out</strong></li>
              <li>All current enrollments are closed</li>
              <li>No future attendance will be marked</li>
              <li>No future fees will be generated</li>
              <li>All historical data remains accessible</li>
            </ul>
          </div>

          {totalOutstandings > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2 flex-shrink-0">
              <span className="text-lg">⚠️</span>
              <p>
                <strong>Outstanding fees:</strong> Rs. {totalOutstandings.toLocaleString()}. These remain
                collectible even after the student{isBulk ? "s" : ""} pass{isBulk ? "" : "es"} out.
              </p>
            </div>
          )}

          <div className="flex items-start gap-3 pt-1 flex-shrink-0">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4"
            />
            <label htmlFor="confirm" className="text-sm text-gray-700">
              {isBulk ? (
                <>I confirm that these <strong>{students.length}</strong> students have completed their studies and should be marked as Passed Out.</>
              ) : (
                <>I confirm that <strong>{leadStudent.name}</strong> has completed their studies and should be marked as Passed Out.</>
              )}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleExecute}
              disabled={!confirmed}
              className="px-6 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Pass Out
            </button>
          </div>

          <div className="h-2" />
        </div>
      </div>
    </Modal>
  );
}
