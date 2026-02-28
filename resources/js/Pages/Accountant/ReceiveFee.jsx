import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";
import { router, Link } from "@inertiajs/react";

export default function ReceiveFee({ student, fees = [] }) {

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

  // Group fees by class type (kirtan vs gurmukhi)
  // Handle various case formats and null values
  const isKirtan = (classType) => {
    const type = String(classType ?? '').toLowerCase().trim();
    return type === 'kirtan' || type.includes('kirtan');
  };

  const gurmukhiFees = fees.filter(f => !isKirtan(f.class_type));
  const kirtanFees = fees.filter(f => isKirtan(f.class_type));

  // Collapsible section state - Gurmukhi open by default
  const [gurmukhiOpen, setGurmukhiOpen] = useState(true);
  const [kirtanOpen, setKirtanOpen] = useState(false);

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
      { fee_ids: selectedFees },
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

          {fees.length === 0 && (
            <p className="text-green-600 text-sm">
              ✔ No pending fees
            </p>
          )}

          {/* Gurmukhi Section - Collapsible, open by default */}
          {gurmukhiFees.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setGurmukhiOpen(!gurmukhiOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-medium">Gurmukhi</span>
                  <span className="text-xs text-gray-500">({gurmukhiFees.length} fees)</span>
                </div>
                <svg
                  className={`w-5 h-5 text-blue-600 transition-transform ${gurmukhiOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {gurmukhiOpen && (
                <div className="p-3 space-y-2">
                  {gurmukhiFees.map((fee) => (
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
          )}

          {/* Kirtan Section - Collapsible, closed by default */}
          {kirtanFees.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setKirtanOpen(!kirtanOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 font-medium">Kirtan</span>
                  <span className="text-xs text-gray-500">({kirtanFees.length} fees)</span>
                </div>
                <svg
                  className={`w-5 h-5 text-purple-600 transition-transform ${kirtanOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {kirtanOpen && (
                <div className="p-3 space-y-2">
                  {kirtanFees.map((fee) => (
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
          )}
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
          disabled={processing || selectedFees.length === 0}
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
