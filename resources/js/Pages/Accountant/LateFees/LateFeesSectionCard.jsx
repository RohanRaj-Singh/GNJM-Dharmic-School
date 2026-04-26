import { Link } from "@inertiajs/react";

import { dedupeFeesByMonth, groupFeesByStudent } from "./utils";

function StudentFeeRow({ student }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="flex justify-between items-center mb-2 gap-2">
        <div>
          <p className="text-base font-semibold text-gray-800">{student.student}</p>

          <p className="text-sm text-gray-500">{student.father_name}</p>
          <p className="text-sm text-gray-500">
            {student.class} - {student.section}
          </p>
        </div>

        <Link
          href={`/accountant/receive-fee?student_id=${student.student_id}`}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
        >
          Collect Fee
        </Link>
      </div>

      <ul className="space-y-1 text-sm">
        {dedupeFeesByMonth(student.fees).map((fee) => (
          <li
            key={`${student.student_id}-${student.section}-${fee.month}`}
            className="flex justify-between text-gray-600"
          >
            <span>- {fee.month}</span>
            <span>Rs. {fee.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LateFeesSectionCard({
  emoji,
  title,
  description,
  items,
}) {
  const students = Object.values(groupFeesByStudent(items));

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-gray-800">
            {emoji} {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>

        <span className="text-sm text-gray-600">{students.length}</span>
      </div>

      {students.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 text-center">No pending fees</p>
      ) : (
        <div className="mt-4 space-y-4">
          {students.map((student) => (
            <StudentFeeRow
              key={`${student.student_id}-${student.section}`}
              student={student}
            />
          ))}
        </div>
      )}
    </div>
  );
}
