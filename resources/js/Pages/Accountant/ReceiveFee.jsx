import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";
import { router, Link } from "@inertiajs/react";
import { divisionMeta } from "@/utils/divisionType";

export default function ReceiveFee({ student, fees = [] }) {
  const getTodayDateInput = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (!student) {
    return (
      <SimpleLayout title="Receive Fee">
        <div className="bg-white rounded-xl shadow p-6 text-center text-red-600">
          Student not found.
        </div>
      </SimpleLayout>
    );
  }

  const [selectedFees, setSelectedFees] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [collectionDate, setCollectionDate] = useState(getTodayDateInput);

  // Map-over-divisions: group the pending fees by their resolved division. The
  // backend sends each fee's canonical class_type; a third class keeps its own
  // collapsible section instead of merging into the Gurmukhi one.
  const divisions = [...new Set(fees.map((f) => f.class_type).filter(Boolean))].sort();

  // Collapsible section state — first division (Gurmukhi when present) open by
  // default, matching the legacy behaviour.
  const [openDivisions, setOpenDivisions] = useState(() =>
    divisions[0] ? { [divisions[0]]: true } : {}
  );

  const toggleDivision = (divisionKey) =>
    setOpenDivisions((cur) => ({ ...cur, [divisionKey]: !cur[divisionKey] }));

  const toggleFee = (feeId) => {
    setSelectedFees((prev) =>
      prev.includes(feeId)
        ? prev.filter((id) => id !== feeId)
        : [...prev, feeId]
    );
  };

  const totalAmount = fees
    .filter((f) => selectedFees.includes(f.id))
    .reduce((sum, f) => sum + Number(f.amount ?? 0), 0);

  const submitPayment = () => {
    if (selectedFees.length === 0) return;

    setProcessing(true);

    router.post(
      "/accountant/receive-fee",
      {
        fee_ids: selectedFees,
        collection_date: collectionDate,
      },
      { onFinish: () => setProcessing(false) }
    );
  };

  return (
    <SimpleLayout title="Receive Fee">
      <div className="space-y-4">

        {/* Student Info */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-xl font-semibold">{student.name}</h2>
          <p className="text-sm text-gray-500">
            Father: {student.father_name}
          </p>
        </div>

        {/* Fee Selection */}
        <div className="bg-white rounded-xl shadow p-5 space-y-3">
          <h3 className="font-semibold text-gray-700">
            Select Month(s)
          </h3>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Collection Date
            </label>
            <input
              type="date"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {fees.length === 0 && (
            <p className="text-green-600 text-sm">
              ✔ No pending fees
            </p>
          )}

          {/* One collapsible section per division — Gurmukhi/Kirtan keep their
              legacy colours; any third class gets a generated section. */}
          {divisions.map((divisionKey) => {
            const divFees = fees.filter((f) => f.class_type === divisionKey);
            const meta = divisionMeta(divisionKey);
            const isOpen = openDivisions[divisionKey] ?? false;

            return (
              <div key={divisionKey} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleDivision(divisionKey)}
                  className={`w-full flex items-center justify-between px-4 py-3 ${meta.bg} ${meta.bgHover} transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`${meta.accent} font-medium`}>{meta.title}</span>
                    <span className="text-xs text-gray-500">({divFees.length} fees)</span>
                  </div>
                  <svg
                    className={`w-5 h-5 ${meta.accent} transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="p-3 space-y-2">
                    {divFees.map((fee) => (
                      <FeeCheckbox
                        key={fee.id}
                        fee={fee}
                        selected={selectedFees.includes(fee.id)}
                        onToggle={() => toggleFee(fee.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        {selectedFees.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-600">
              Total Amount
            </p>
            <p className="text-xl font-semibold">
              Rs. {totalAmount}
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={submitPayment}
          disabled={processing || selectedFees.length === 0 || !collectionDate}
          className="w-full bg-green-600 text-white py-3 rounded-lg disabled:opacity-50"
        >
          {processing ? "Processing..." : "Confirm Payment"}
        </button>

        <div className="text-center">
          <Link
            href={`/students/${student.id}`}
            className="text-sm text-gray-600 underline"
          >
            ← Back to Student
          </Link>
        </div>

      </div>
    </SimpleLayout>
  );
}

// Fee checkbox component
function FeeCheckbox({ fee, selected, onToggle }) {
  return (
    <label className="flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 text-green-600 rounded"
        />
        <span className="text-sm">
          {fee.month}
          {fee.section_name && <span className="text-gray-400 ml-1">- {fee.section_name}</span>}
        </span>
      </div>
      <span className="text-sm font-medium">
        Rs. {fee.amount}
      </span>
    </label>
  );
}
