import SimpleLayout from "@/Layouts/SimpleLayout";

export default function Attendance({ students = [] }) {

  const categories = {
    absent_1: { title: "Absent (1 Day)", icon: "❌" },
    absent_2: { title: "Absent (2 Days)", icon: "❌❌" },
    absent_3_plus: { title: "Absent (3+ Days)", icon: "❌❌❌" },
    leave_1: { title: "Leave (1 Day)", icon: "🟡" },
    leave_2_plus: { title: "Leave (2+ Days)", icon: "🟡🟡" },
  };

  const grouped = {};

  students.forEach((s) => {
    if (!grouped[s.category]) grouped[s.category] = {};
    if (!grouped[s.category][s.section])
      grouped[s.category][s.section] = [];
    grouped[s.category][s.section].push(s);
  });

  return (
    <SimpleLayout title="Attendance – Absent & Leave Register">
      <div className="space-y-6">

        {Object.entries(categories).map(([key, meta]) => (
          <div
            key={key}
            className="bg-white border rounded-md p-4"
          >
            {/* Category Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">{meta.icon}</span>
              <h2 className="font-semibold text-gray-800">
                {meta.title}
              </h2>
            </div>

            {!grouped[key] ? (
              <p className="text-sm text-gray-500 pl-5">
                No students
              </p>
            ) : (
              <div className="space-y-4 pl-2">

                {Object.entries(grouped[key]).map(
                  ([sectionName, list]) => (
                    <div key={sectionName}>

                      {/* Section Header */}
                      <p className="text-sm font-medium text-gray-600 mb-2">
                        📂 {sectionName}
                      </p>

                      <ul className="border rounded divide-y">

                        {list.map((s) => (
                          <li
                            key={s.id}
                            className="px-4 py-2"
                          >
                            <p className="text-sm font-medium text-gray-900">
                              {s.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Father: {s.father_name || "—"}
                            </p>
                          </li>
                        ))}

                      </ul>
                    </div>
                  )
                )}

              </div>
            )}
          </div>
        ))}

        {students.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            No absent or leave records
          </p>
        )}

      </div>
    </SimpleLayout>
  );
}
