import AdminLayout from "@/Layouts/AdminLayout";
import { useState } from "react";

/*
|--------------------------------------------------------------------------
| Batches (Prototype Mockup)
|--------------------------------------------------------------------------
|
| A Batch represents an admission cohort (e.g., "Batch 2025").
| Assigned when a student joins and stays with them permanently.
| Primarily for identification and cohort-level reporting.
|
| This is a visual prototype. All data is mock data.
| No backend integration yet.
*/

const MOCK_BATCHES = [
  { id: 1, name: "Batch 2024", admission_year: 2024, student_count: 18 },
  { id: 2, name: "Batch 2025", admission_year: 2025, student_count: 24 },
  { id: 3, name: "Batch 2026", admission_year: 2026, student_count: 31 },
];

const MOCK_UNASSIGNED = 7;

export default function Batches() {
  const [batches] = useState(MOCK_BATCHES);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState("");

  function handleCreate() {
    if (!newName || !newYear) return;
    // Mock: just close the form
    setShowCreate(false);
    setNewName("");
    setNewYear("");
  }

  return (
    <AdminLayout title="Batches">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Batches</h1>
            <p className="text-sm text-gray-500 mt-1">
              An admission cohort. Assigned when a student joins and stays
              with them throughout their academic journey.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            + New Batch
          </button>
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
          <p>
            <strong>What is a Batch?</strong> A batch is an admission cohort,
            not a class. Students admitted in the same year belong to the same
            batch regardless of which class they study in. Batches are used
            for cohort-level reporting and identification.
          </p>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border border-blue-200">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Create New Batch
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Batch Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder='e.g. "Batch 2027"'
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Admission Year
                </label>
                <input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="e.g. 2027"
                  className="border rounded px-3 py-2 text-sm w-full"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName || !newYear}
                className="px-4 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Create Batch
              </button>
            </div>
          </div>
        )}

        {/* Current batches */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Batch
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Admission Year
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">
                  Students
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.admission_year}
                  </td>
                  <td className="px-4 py-3 text-center">{b.student_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-600 hover:underline text-xs">
                      View Students
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Unassigned students */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>{MOCK_UNASSIGNED}</strong> student(s) have no batch
          assigned.{" "}
          <button className="underline hover:no-underline font-medium">
            Assign batches
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
