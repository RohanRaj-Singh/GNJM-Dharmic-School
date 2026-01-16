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

  const toggleFee = (feeId) => {
    setSelectedFees((prev) =>
      prev.includes(feeId)
        ? prev.filter((id) => id !== feeId)
        : [...prev, feeId]
    );
  };

  const totalAmount = fees
    .filter((f) => selectedFees.includes(f.id))
    .reduce((sum, f) => sum + f.amount, 0);

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

          {fees.map((fee) => (
            <label
              key={fee.id}
              className="flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFees.includes(fee.id)}
                  onChange={() => toggleFee(fee.id)}
                />
                <span className="text-sm">
                  {fee.month}
                </span>
              </div>
              <span className="text-sm font-medium">
                ₹{fee.amount}
              </span>
            </label>
          ))}
        </div>

        {/* Total */}
        {selectedFees.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-600">
              Total Amount
            </p>
            <p className="text-xl font-semibold">
              ₹{totalAmount}
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
            href={`/accountant/students/${student.id}`}
            className="text-sm text-gray-600 underline"
          >
            ← Back to Student
          </Link>
        </div>

      </div>
    </SimpleLayout>
  );
}
