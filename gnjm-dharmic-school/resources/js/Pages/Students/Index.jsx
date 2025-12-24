import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";


export default function StudentsIndex({ students }) {
  const [search, setSearch] = useState("");
const flattened = students.flatMap(student =>
  student.enrollments.map(enrollment => ({
    id: enrollment.id,
    name: student.name,
    father: student.father_name,
    class: enrollment.school_class.name,
    section: enrollment.section.name,
    type: enrollment.student_type === 'paid' ? 'Paid' : 'Free',
  }))
);
const filteredStudents = flattened.filter(s =>
  s.name.toLowerCase().includes(search.toLowerCase())
);

  

  return (
    <SimpleLayout title="Students">
    
      <div className="space-y-4">
        <a
  href="/students/create"
  className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg"
>
  ➕ Add Student
</a>

        {/* Search */}
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring"
        />

        {/* List */}
        {filteredStudents.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}

        {filteredStudents.length === 0 && (
          <p className="text-center text-gray-500 text-sm">
            No students found
          </p>
        )}

      </div>
    </SimpleLayout>
  );
}

function StudentCard({ student }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
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
    </div>
  );
}
