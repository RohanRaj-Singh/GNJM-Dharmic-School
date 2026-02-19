import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";

export default function FeesIndex({ fees = [] }) {
  const toMonthValue = (month) => {
    if (!month || typeof month !== "string") return 0;
    const [year, m] = month.split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(m)) return 0;
    return year * 100 + m;
  };

  const isPaid = (fee) =>
    Boolean(fee?.is_paid) || (Array.isArray(fee?.payments) && fee.payments.length > 0);

  const sortedFees = [...fees].sort((a, b) => {
    const aStudent = (a?.enrollment?.student?.name ?? "").toLowerCase();
    const bStudent = (b?.enrollment?.student?.name ?? "").toLowerCase();
    if (aStudent !== bStudent) return aStudent.localeCompare(bStudent);

    const aPaid = isPaid(a) ? 1 : 0;
    const bPaid = isPaid(b) ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid; // unpaid first

    // Latest month first within same student + same status
    return toMonthValue(b?.month) - toMonthValue(a?.month);
  });

  return (
    <SimpleLayout title="Pending Fees">
      <div className="space-y-4">
        {sortedFees.length === 0 && (
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-green-600 font-medium">No pending fees</p>
            <p className="text-sm text-gray-500 mt-1">All monthly fees are cleared</p>
          </div>
        )}

        {sortedFees.map((fee) => (
          <div key={fee.id} className="bg-white rounded-xl shadow p-4">
            <div className="mb-3">
              <Link
                href={`/students/${fee.enrollment.student.id}`}
                className="text-lg font-semibold text-blue-600 underline"
              >
                {fee.enrollment.student.name}
              </Link>
              <p className="text-xs text-gray-500">Father: {fee.enrollment.student.father_name}</p>
            </div>

            <div className="flex gap-2 text-xs mb-3">
              <span className="bg-gray-100 px-2 py-1 rounded">{fee.enrollment.school_class.name}</span>
              {fee.enrollment.section && (
                <span className="bg-gray-100 px-2 py-1 rounded">{fee.enrollment.section.name}</span>
              )}
              <span
                className={`px-2 py-1 rounded ${
                  isPaid(fee) ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {isPaid(fee) ? "Paid" : "Unpaid"}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <div>
                <p className="text-gray-600">
                  Month: <span className="font-medium text-gray-800">{fee.month}</span>
                </p>
                <p className="text-gray-600">
                  Amount: <span className="font-medium text-gray-800">Rs {fee.amount}</span>
                </p>
              </div>

              {!isPaid(fee) && (
                <Link
                  href={`/accountant/receive-fee?student_id=${fee.enrollment.student.id}`}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Receive
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </SimpleLayout>
  );
}
