export default function SummaryBar({ students }) {
  const total = students.length;

  let active = 0;
  let inactive = 0;
  let promoted = 0;
  let passedOut = 0;
  let left = 0;

  students.forEach((s) => {
    const enrollments = s.enrollments || [];
    if (enrollments.length === 0) {
      const sStatus = s.status || "active";
      if (sStatus === "active") active++;
      else if (sStatus === "inactive") inactive++;
      else if (sStatus === "promoted") promoted++;
      else if (sStatus === "passed_out") passedOut++;
      else if (sStatus === "left") left++;
      else active++;
      return;
    }

    const statuses = enrollments.map((e) => e.status || "active");
    if (statuses.includes("left")) left++;
    else if (statuses.includes("passed_out")) passedOut++;
    else if (statuses.includes("inactive")) inactive++;
    else if (statuses.includes("promoted")) promoted++;
    else active++;
  });

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
    { label: "Inactive", value: inactive, color: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Left", value: left, color: "bg-red-50 text-red-700 border-red-200" },
    { label: "Passed Out", value: passedOut, color: "bg-purple-50 text-purple-700 border-purple-200" },
    { label: "All Free", value: freeStudents, color: "bg-purple-50 text-purple-700 border-purple-200" },
    { label: "Has Paid", value: paidStudents, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ].filter((s) => s.value > 0 || s.label === "Total Students");

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
