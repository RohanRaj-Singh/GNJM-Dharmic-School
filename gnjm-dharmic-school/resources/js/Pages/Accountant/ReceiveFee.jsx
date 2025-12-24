import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";

export default function ReceiveFee() {
  const [student, setStudent] = useState(null);

  return (
    <SimpleLayout title="Receive Fee">
      <div className="space-y-4">

        {/* Search */}
        <div className="bg-white rounded-xl shadow p-5">
          <label className="text-sm text-gray-600">
            Search Student
          </label>

          <input
            type="text"
            placeholder="Enter student name or phone"
            className="w-full mt-2 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
            onChange={() =>
              setStudent({
                name: "Aman Singh",
                father: "Harjit Singh",
                class: "Gurmukhi",
                pending: 1200,
              })
            }
          />
        </div>

        {/* Student Info */}
        {student && (
          <>
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-semibold text-gray-800">
                🧑‍🎓 {student.name}
              </h3>

              <p className="text-sm text-gray-500">
                Father: {student.father}
              </p>

              <p className="text-sm text-gray-500">
                Class: {student.class}
              </p>
            </div>

            {/* Fee Summary */}
            <div className="bg-white rounded-xl shadow p-5">
              <h4 className="text-md font-semibold text-gray-700 mb-2">
                Fee Summary
              </h4>

              <div className="flex justify-between text-sm mb-1">
                <span>Pending Amount</span>
                <span className="font-medium text-red-600">
                  ₹{student.pending}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Current Month</span>
                <span>₹600</span>
              </div>
            </div>

            {/* Action */}
            <div className="bg-white rounded-xl shadow p-5">
              <button
                disabled
                className="w-full bg-green-600 text-white py-3 rounded-lg opacity-60"
              >
                Mark as Paid (Coming Soon)
              </button>
            </div>
          </>
        )}
      </div>
    </SimpleLayout>
  );
}
