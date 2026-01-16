import AccountantLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";
import { Link } from "@inertiajs/react";

export default function StudentsIndex({ students }) {
  const [search, setSearch] = useState("");

  const flattened = students.flatMap(student =>
    student.enrollments.map(enrollment => ({
      student_id: student.id,          // ✅ FIX
      enrollment_id: enrollment.id,
      name: student.name,
      father: student.father_name,
      class: enrollment.school_class.name,
      section: enrollment.section.name,
      type: enrollment.student_type === "paid" ? "Paid" : "Free",
    }))
  );

  const filteredStudents = flattened.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AccountantLayout title="Students">
      <div className="space-y-4">
        {/* Add Student Button full width*/}
        <div className="flex justify-end">
          <Link
            href="/accountant/students/create"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg
                    hover:bg-blue-700 active:scale-95 transition w-full text-center"
          >
            + Add Student
          </Link>
        </div>
        {/* Search */}
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring"
        />

        {/* List */}
        {[...filteredStudents]
  .reverse()
  .map((student) => (
    <StudentCard key={student.id} student={student} />
  ))}



        {filteredStudents.length === 0 && (
          <p className="text-center text-gray-500 text-sm">
            No students found
          </p>
        )}
      </div>
    </AccountantLayout>
  );
}

function StudentCard({ student }) {
  return (
    <Link
      href={`/accountant/students/${student.student_id}`}
      className="block bg-white rounded-xl shadow p-4
                 active:scale-[0.98] transition
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {student.name}
          </h3>
          <p className="text-sm text-gray-500">
            Father: {student.father}
          </p>
        </div>

        <span
          className={`text-xs px-2 py-1 rounded-full ${
            student.type === "Paid"
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {student.type}
        </span>
      </div>

      <div className="flex gap-2 mt-3 text-xs">
        <span className="bg-gray-100 px-2 py-1 rounded">
          {student.class}
        </span>
        <span className="bg-gray-100 px-2 py-1 rounded">
          {student.section}
        </span>
      </div>
    </Link>
  );
}