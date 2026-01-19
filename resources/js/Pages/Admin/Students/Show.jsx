import SimpleLayout from "@/Layouts/SimpleLayout";

export default function StudentShow({ student, report }) {
  return (
    <SimpleLayout title="Student Report">
      {/* Student Info */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-xl font-semibold">{student.name}</h2>
        <p className="text-gray-600">
          Father: {student.father_name}
        </p>
        <p className="text-sm text-gray-500">
          Status: {student.status}
        </p>
      </div>

      {/* Per Class Report */}
      <div className="space-y-4">
        {report.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow p-4"
          >
            <h3 className="font-semibold text-lg">
              {item.class} – {item.section}
            </h3>

            {/* Attendance */}
            <p className="mt-2 text-gray-700">
              Attendance: {item.attendance.present} /{" "}
              {item.attendance.total} (
              {item.attendance.percentage}%)
            </p>

            {/* Lesson Learned */}
            {item.lesson && (
              <p className="text-gray-700">
                Lesson Learned: Yes {item.lesson.yes}, No{" "}
                {item.lesson.no}
              </p>
            )}

            {/* Fees */}
            <p className="text-gray-700 mt-2">
              Fees: Paid ₹{item.fees.paid} / Total ₹
              {item.fees.total} (
              Due ₹{item.fees.due})
            </p>
          </div>
        ))}
      </div>
    </SimpleLayout>
  );
}
