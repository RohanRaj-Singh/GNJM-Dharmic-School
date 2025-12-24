import SimpleLayout from "@/Layouts/SimpleLayout";

export default function LateFees() {
  return (
    <SimpleLayout title="Late Fees">
      <div className="space-y-4">

        {/* Due This Month */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-lg font-semibold text-red-600">
            🔴 Due This Month
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Students whose fee is pending for this month
          </p>

          <div className="mt-3 text-gray-400 text-sm">
            No data yet
          </div>
        </div>

        {/* Due More Than One Month */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-lg font-semibold text-orange-600">
            🟠 Due More Than 1 Month
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Long pending fees
          </p>

          <div className="mt-3 text-gray-400 text-sm">
            No data yet
          </div>
        </div>

        {/* Total Pending */}
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <h3 className="text-lg font-semibold text-gray-800">
            📌 Total Pending Amount
          </h3>

          <p className="text-2xl font-bold text-red-600 mt-2">
            ₹0
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Combined pending fees
          </p>
        </div>

      </div>
    </SimpleLayout>
  );
}
