import SimpleLayout from "@/Layouts/SimpleLayout";

export default function StudentShow() {
  // Demo data (later comes from backend)
  const student = {
    name: "Aman Singh",
    father: "Harjit Singh",
    class: "Gurmukhi",
    section: "Section A",
    type: "Paid",
    monthlyFee: 600,
    status: "Active",
  };

  return (
    <SimpleLayout title="Student Details">
      <div className="space-y-4">

        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-xl font-semibold text-gray-800">
            {student.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Father: {student.father}
          </p>
        </div>

        {/* Academic Info */}
        <div className="bg-white rounded-xl shadow p-5 space-y-2">
          <InfoRow label="Class" value={student.class} />
          <InfoRow label="Section" value={student.section} />
          <InfoRow label="Status" value={student.status} />
        </div>

        {/* Fee Info */}
        <div className="bg-white rounded-xl shadow p-5 space-y-2">
          <InfoRow label="Student Type" value={student.type} />
          {student.type === "Paid" && (
            <InfoRow
              label="Monthly Fee"
              value={`₹${student.monthlyFee}`}
            />
          )}
        </div>

        {/* Attendance Summary (Placeholder) */}
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="text-md font-semibold text-gray-700 mb-2">
            Attendance Summary
          </h3>
          <p className="text-sm text-gray-500">
            Attendance details will appear here
          </p>
        </div>

      </div>
    </SimpleLayout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">
        {value}
      </span>
    </div>
  );
}
