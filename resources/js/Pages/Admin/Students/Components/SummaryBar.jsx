export default function SummaryBar({ students }) {
  const total = students.length;
  const active = students.filter((s) => s.status === "active").length;

  let freeStudents = 0;
  let paidStudents = 0;
  students.forEach((s) => {
    const enrollments = s.enrollments || [];
    if (enrollments.length === 0) return;
    const allFree = enrollments.every((e) => e.student_type === "free");
    if (allFree) freeStudents++;
    else paidStudents++;
  });

  const stats = [
    { label: "Total Students", value: total, color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Active", value: active, color: "bg-green-50 text-green-700 border-green-200" },
    { label: "All Free", value: freeStudents, color: "bg-purple-50 text-purple-700 border-purple-200" },
    { label: "Has Paid", value: paidStudents, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`px-4 py-2 rounded-lg border ${s.color} text-sm`}
        >
          <span className="font-semibold">{s.value}</span>{" "}
          <span className="opacity-75">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
