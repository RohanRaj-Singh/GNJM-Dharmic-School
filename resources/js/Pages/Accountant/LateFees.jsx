import SimpleLayout from "@/Layouts/SimpleLayout";

/**
 * Late Fees – Accountant View
 * - Groups fees per student + section
 * - Deduplicates months
 * - Provides Collect Fee action
 */
export default function LateFees({
  dueThisMonth = [],
  dueOlder = [],
  totalPending = 0,
}) {
  return (
    <SimpleLayout title="Late Fees">
      <div className="space-y-4">

        {/* Due This Month */}
        <FeeCard
          emoji="🗓️"
          title="Due This Month"
          description="Students whose monthly fee is pending for the current month"
          items={dueThisMonth}
        />

        {/* Due Older */}
        <FeeCard
          emoji="📂"
          title="Pending From Previous Months"
          description="Fees pending from earlier months"
          items={dueOlder}
        />

        {/* Total Pending */}
        <div className="bg-gray-50 border rounded-xl p-6 text-center">
          <h3 className="text-base font-medium text-gray-700">
            📌 Total Pending Amount
          </h3>

          <p className="text-3xl font-semibold text-gray-800 mt-2">
            ₹{totalPending}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            Combined unpaid monthly fees
          </p>
        </div>

      </div>
    </SimpleLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Fee Card                                                                    */
/* -------------------------------------------------------------------------- */

function FeeCard({ emoji, title, description, items }) {
  const grouped = groupByStudent(items);
  const students = Object.values(grouped);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-800">
            {emoji} {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {description}
          </p>
        </div>

        <span className="text-sm text-gray-600">
          {students.length}
        </span>
      </div>

      {students.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 text-center">
          No pending fees
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {students.map((student) => (
            <div
              key={`${student.student_id}-${student.section}`}
              className="border rounded-xl p-4"
            >
              {/* Student Header */}
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-base font-semibold text-gray-800">
                    {student.student}
                  </p>
                  <p className="text-sm text-gray-500">
                    {student.class} · {student.section}
                  </p>
                </div>

                <button
                  onClick={() =>
                    (window.location.href =
                      `/accountant/receive-fee?student_id=${student.student_id}`)
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Collect Fee
                </button>
              </div>

              {/* Fee List (deduped by month) */}
              <ul className="space-y-1 text-sm">
                {dedupeFeesByMonth(student.fees).map((fee, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between text-gray-600"
                  >
                    <span>❌ {fee.month}</span>
                    <span>₹{fee.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Group fees by student + section
 * This prevents merging when a student has multiple enrollments
 */
function groupByStudent(items) {
  return items.reduce((acc, item) => {
    const key = `${item.student_id}-${item.section}`;

    if (!acc[key]) {
      acc[key] = {
        student_id: item.student_id,
        student: item.student,
        class: item.class,
        section: item.section,
        fees: [],
      };
    }

    acc[key].fees.push({
      month: item.month,
      amount: item.amount,
    });

    return acc;
  }, {});
}

/**
 * Deduplicate fees by month (safety for test data)
 */
function dedupeFeesByMonth(fees) {
  return Object.values(
    fees.reduce((acc, fee) => {
      acc[fee.month] = fee;
      return acc;
    }, {})
  );
}
