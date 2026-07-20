import AdminLayout from "@/Layouts/AdminLayout";
import { useState } from "react";

/*
|--------------------------------------------------------------------------
| Student Promotion (Prototype Mockup)
|--------------------------------------------------------------------------
|
| This is a visual prototype showing the intended promotion workflow.
| All data is mock data. No backend integration yet.
|
| Workflow:
|   1. Select source academic session
|   2. Select class → section → filter students
|   3. Review students eligible for promotion
|   4. Set target class, section, and session
|   5. Preview promotion summary
|   6. Execute promotion
|
| Business rules (see architectural specification):
|   - Promotion creates a NEW enrollment (never updates in-place)
|   - Old enrollment gets outcome = 'promoted', transferred_at = now
|   - Fees/attendance stay with old enrollment
|   - New enrollment starts fresh fee lifecycle
|   - Gurmukhi and Kirtan promote independently
*/

const MOCK_CLASSES = [
  { id: 1, name: "Gurmukhi Class 1", type: "gurmukhi" },
  { id: 2, name: "Gurmukhi Class 2", type: "gurmukhi" },
  { id: 3, name: "Gurmukhi Class 3", type: "gurmukhi" },
  { id: 4, name: "Kirtan (Tabla Basic)", type: "kirtan" },
  { id: 5, name: "Kirtan (Tabla Advanced)", type: "kirtan" },
  { id: 6, name: "Kirtan (Dil Rubab)", type: "kirtan" },
];

const MOCK_SECTIONS = {
  1: [
    { id: 101, name: "Section A" },
    { id: 102, name: "Section B" },
  ],
  2: [
    { id: 201, name: "Section A" },
    { id: 202, name: "Section B" },
  ],
  3: [
    { id: 301, name: "Section A" },
    { id: 302, name: "Section B" },
  ],
  4: [
    { id: 401, name: "Tabla" },
    { id: 402, name: "Dil Rubab" },
  ],
  5: [
    { id: 501, name: "Tabla" },
  ],
  6: [
    { id: 601, name: "Dil Rubab" },
  ],
};

const MOCK_ACADEMIC_SESSIONS = [
  { id: 1, name: "2025–26", is_current: false },
  { id: 2, name: "2026–27", is_current: true },
];

const MOCK_STUDENTS = [
  { id: 1, name: "Amardeep Singh", father_name: "Gurpreet Singh", enrollment_id: 101, status: "active", student_type: "paid", attendance_pct: 92, outstanding: 1200 },
  { id: 2, name: "Balwinder Kaur", father_name: "Jaswant Singh", enrollment_id: 102, status: "active", student_type: "paid", attendance_pct: 88, outstanding: 0 },
  { id: 3, name: "Gurleen Kaur", father_name: "Harjeet Singh", enrollment_id: 103, status: "active", student_type: "free", attendance_pct: 95, outstanding: 0 },
  { id: 4, name: "Harpreet Singh", father_name: "Sukhdev Singh", enrollment_id: 104, status: "active", student_type: "paid", attendance_pct: 76, outstanding: 2400 },
  { id: 5, name: "Jagjeet Singh", father_name: "Mohinder Singh", enrollment_id: 105, status: "active", student_type: "paid", attendance_pct: 100, outstanding: 600 },
  { id: 6, name: "Kulwinder Kaur", father_name: "Dalbir Singh", enrollment_id: 106, status: "active", student_type: "paid", attendance_pct: 84, outstanding: 0 },
  { id: 7, name: "Manpreet Singh", father_name: "Amarjit Singh", enrollment_id: 107, status: "active", student_type: "free", attendance_pct: 91, outstanding: 0 },
  { id: 8, name: "Navjot Kaur", father_name: "Ranbir Singh", enrollment_id: 108, status: "active", student_type: "paid", attendance_pct: 79, outstanding: 1800 },
];

export default function StudentPromotion() {
  // Step tracking
  const [step, setStep] = useState(1);

  // Filters
  const [sourceSession, setSourceSession] = useState("");
  const [sourceClass, setSourceClass] = useState("");
  const [sourceSection, setSourceSection] = useState("");
  const [targetSession, setTargetSession] = useState("2");
  const [targetClass, setTargetClass] = useState("");
  const [targetSection, setTargetSection] = useState("");

  // Selection
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const sections = MOCK_SECTIONS[sourceClass] || [];
  const targetSections = MOCK_SECTIONS[targetClass] || [];

  function toggleStudent(id) {
    setSelectedStudents((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function toggleAll() {
    if (selectedStudents.size === MOCK_STUDENTS.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(MOCK_STUDENTS.map((s) => s.id)));
    }
  }

  function canPromote() {
    return sourceClass && targetClass && selectedStudents.size > 0;
  }

  function resetFlow() {
    setStep(1);
    setSourceSession("");
    setSourceClass("");
    setSourceSection("");
    setTargetClass("");
    setTargetSection("");
    setSelectedStudents(new Set());
    setConfirmed(false);
  }

  return (
    <AdminLayout title="Student Promotion">
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-800">Student Promotion</h1>
          <p className="text-sm text-gray-500 mt-1">
            Promote students to the next class for a new academic session.
            Each promotion creates a new enrollment — the previous enrollment
            is preserved as historical record.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          {[
            { num: 1, label: "Source" },
            { num: 2, label: "Select Students" },
            { num: 3, label: "Destination" },
            { num: 4, label: "Confirm" },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step > s.num
                    ? "bg-green-500 text-white"
                    : step === s.num
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s.num ? "✓" : s.num}
              </div>
              <span
                className={
                  step === s.num ? "font-medium text-gray-800" : "text-gray-500"
                }
              >
                {s.label}
              </span>
              {i < 3 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Source ── */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Select Source Enrollment
            </h2>
            <p className="text-sm text-gray-500">
              Choose the academic session and class to promote students from.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Academic Session
                </label>
                <select
                  value={sourceSession}
                  onChange={(e) => setSourceSession(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">Select session</option>
                  {MOCK_ACADEMIC_SESSIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_current ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Class
                </label>
                <select
                  value={sourceClass}
                  onChange={(e) => {
                    setSourceClass(e.target.value);
                    setSourceSection("");
                  }}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">Select class</option>
                  {MOCK_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Section
                </label>
                <select
                  value={sourceSection}
                  onChange={(e) => setSourceSection(e.target.value)}
                  disabled={!sourceClass}
                  className="border rounded px-3 py-2 text-sm w-full disabled:bg-gray-100"
                >
                  <option value="">All Sections</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!sourceClass}
                className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next — Select Students →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Select Students ── */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  Select Students to Promote
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {MOCK_CLASSES.find((c) => c.id == sourceClass)?.name}
                  {sourceSection
                    ? ` — ${sections.find((s) => s.id == sourceSection)?.name}`
                    : ""}
                  {" · "}
                  {MOCK_STUDENTS.length} student(s)
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Change source
              </button>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={
                        MOCK_STUDENTS.length > 0 &&
                        selectedStudents.size === MOCK_STUDENTS.length
                      }
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-4 py-2 text-left">Student Name</th>
                  <th className="px-4 py-2 text-left">Father Name</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-center">Attendance</th>
                  <th className="px-4 py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {MOCK_STUDENTS.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-blue-50 ${
                      selectedStudents.has(s.id) ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.father_name}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.student_type === "free"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {s.student_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={
                          s.attendance_pct >= 90
                            ? "text-green-600 font-medium"
                            : s.attendance_pct >= 75
                            ? "text-amber-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {s.attendance_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {s.outstanding > 0 ? (
                        <span className="text-red-600 font-medium">
                          Rs. {s.outstanding}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedStudents.size} student(s) selected
              </span>
              <button
                onClick={() => setStep(3)}
                disabled={selectedStudents.size === 0}
                className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next — Destination →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Destination ── */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">
              Set Destination
            </h2>
            <p className="text-sm text-gray-500">
              Choose the target class, section, and academic session for the{" "}
              {selectedStudents.size} promoted student(s).
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
              <strong>Note:</strong> Promotion creates a{" "}
              <strong>new enrollment</strong> for each student. The previous
              enrollment is archived as a historical record with outcome ={" "}
              <code>promoted</code>. All fees and attendance stay with the
              previous enrollment.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Target Academic Session
                </label>
                <select
                  value={targetSession}
                  onChange={(e) => setTargetSession(e.target.value)}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  {MOCK_ACADEMIC_SESSIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_current ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Target Class
                </label>
                <select
                  value={targetClass}
                  onChange={(e) => {
                    setTargetClass(e.target.value);
                    setTargetSection("");
                  }}
                  className="border rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">Select class</option>
                  {MOCK_CLASSES.filter(
                    (c) => c.id != sourceClass
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Target Section
                </label>
                <select
                  value={targetSection}
                  onChange={(e) => setTargetSection(e.target.value)}
                  disabled={!targetClass}
                  className="border rounded px-3 py-2 text-sm w-full disabled:bg-gray-100"
                >
                  <option value="">Select section</option>
                  {targetSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!targetClass || !targetSection}
                className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next — Confirm →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6 space-y-4 overflow-x-auto">
              <h2 className="text-base font-semibold text-gray-800">
                Confirm Promotion
              </h2>
              <p className="text-sm text-gray-500">
                Review the promotion summary before executing. This action
                will create new enrollments and archive the previous ones.
              </p>

              {/* Summary card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  label="Students"
                  value={selectedStudents.size}
                  color="blue"
                />
                <SummaryCard
                  label="Source Class"
                  value={
                    MOCK_CLASSES.find((c) => c.id == sourceClass)?.name || ""
                  }
                  color="gray"
                />
                <SummaryCard
                  label="Destination"
                  value={
                    MOCK_CLASSES.find((c) => c.id == targetClass)?.name || ""
                  }
                  color="green"
                />
                <SummaryCard
                  label="Academic Session"
                  value={
                    MOCK_ACADEMIC_SESSIONS.find(
                      (s) => s.id == targetSession
                    )?.name || ""
                  }
                  color="gray"
                />
              </div>

              {/* Student list preview */}
              <h3 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
                Students Being Promoted
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Father</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-center">New Enrollment</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {MOCK_STUDENTS.filter((s) =>
                    selectedStudents.has(s.id)
                  ).map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {s.father_name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.student_type === "free"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {s.student_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.outstanding > 0 ? (
                          <span className="text-red-600 font-medium">
                            Rs. {s.outstanding}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          ✓ Will be created
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Outstanding fee warning */}
              {MOCK_STUDENTS.filter(
                (s) => selectedStudents.has(s.id) && s.outstanding > 0
              ).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                  <strong>⚠ Outstanding fees:</strong>{" "}
                  {
                    MOCK_STUDENTS.filter(
                      (s) => selectedStudents.has(s.id) && s.outstanding > 0
                    ).length
                  }{" "}
                  student(s) have outstanding balances. These remain
                  collectible on the historical enrollment. The new enrollment
                  starts with a fresh fee lifecycle.
                </div>
              )}

              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="confirm"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <label htmlFor="confirm" className="text-sm text-gray-700">
                  I understand that this will archive{" "}
                  <strong>{selectedStudents.size}</strong> enrollment(s) and
                  create <strong>{selectedStudents.size}</strong> new
                  enrollment(s). Previous data will be preserved as historical
                  records.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => resetFlow()}
                className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setStep(5);
                }}
                disabled={!confirmed}
                className="px-6 py-2 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Execute Promotion
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Success ── */}
        {step === 5 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Promotion Complete
            </h2>
            <p className="text-gray-500 mb-6">
              {selectedStudents.size} student(s) promoted successfully from{" "}
              <strong>
                {MOCK_CLASSES.find((c) => c.id == sourceClass)?.name}
              </strong>{" "}
              to{" "}
              <strong>
                {MOCK_CLASSES.find((c) => c.id == targetClass)?.name}
              </strong>{" "}
              for {MOCK_ACADEMIC_SESSIONS.find((s) => s.id == targetSession)?.name}.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800 text-left max-w-lg mx-auto mb-6">
              <h3 className="font-semibold mb-1">What happened</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>{selectedStudents.size}</strong> previous enrollment(s)
                  archived with outcome = <code>promoted</code>
                </li>
                <li>
                  <strong>{selectedStudents.size}</strong> new enrollment(s) created
                </li>
                <li>All attendance and fee records preserved in history</li>
                <li>Outstanding fees still collectible</li>
                <li>New fee generation will begin for the new enrollments</li>
              </ul>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => resetFlow()}
                className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Promote More Students
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ label, value, color }) {
  const colors = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    gray: "bg-gray-50 border-gray-200 text-gray-800",
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${colors[color] || colors.gray}`}>
      <div className="text-xs uppercase tracking-wider opacity-75">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
