import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";

export default function FeesIndex({ fees }) {
  return (
    <SimpleLayout title="Pending Fees">
      <div className="space-y-4">

        {fees.length === 0 && (
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-green-600 font-medium">
              ✔ No pending fees
            </p>
            <p className="text-sm text-gray-500 mt-1">
              All monthly fees are cleared
            </p>
          </div>
        )}

        {fees.map((fee) => (
          <div
            key={fee.id}
            className="bg-white rounded-xl shadow p-4"
          >
            {/* Student Info */}
            <div className="mb-3">
              <Link
                href={`/students/${fee.enrollment.student.id}`}
                className="text-lg font-semibold text-blue-600 underline"
              >
                {fee.enrollment.student.name}
              </Link>
              <p className="text-xs text-gray-500">
                Father: {fee.enrollment.student.father_name}
              </p>
            </div>

            {/* Class Info */}
            <div className="flex gap-2 text-xs mb-3">
              <span className="bg-gray-100 px-2 py-1 rounded">
                {fee.enrollment.school_class.name}
              </span>
              {fee.enrollment.section && (
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {fee.enrollment.section.name}
                </span>
              )}
            </div>

            {/* Fee Info */}
            <div className="flex justify-between items-center text-sm">
              <div>
                <p className="text-gray-600">
                  Month:{" "}
                  <span className="font-medium text-gray-800">
                    {fee.month}
                  </span>
                </p>
                <p className="text-gray-600">
                  Amount:{" "}
                  <span className="font-medium text-gray-800">
                    ₹{fee.amount}
                  </span>
                </p>
              </div>

              {/* Action */}
              <Link
                href={`/accountant/receive-fee?student_id=${fee.enrollment.student.id}`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Receive
              </Link>
            </div>
          </div>
        ))}
      </div>
    </SimpleLayout>
  );
}
