import { Link } from "@inertiajs/react";

import { getEnrollmentBadges } from "./utils";

function StudentCard({ student }) {
  const badges = getEnrollmentBadges(student?.enrollments ?? []);

  return (
    <Link
      href={`/students/${student.id}`}
      className="block bg-white rounded-xl shadow p-4"
    >
      <p className="font-semibold text-gray-800">{student.name}</p>
      <p className="text-sm text-gray-500">Father: {student.father_name || "-"}</p>

      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        {badges.map((badge) => (
          <span
            key={badge.id}
            className={`px-2 py-1 rounded-full ${
              badge.isKirtan
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {badge.label}
          </span>
        ))}
      </div>
    </Link>
  );
}

export default function StudentsList({ students }) {
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500 text-center">
        No students found
      </div>
    );
  }

  return (
    <>
      {students.map((student) => (
        <StudentCard key={student.id} student={student} />
      ))}
    </>
  );
}
