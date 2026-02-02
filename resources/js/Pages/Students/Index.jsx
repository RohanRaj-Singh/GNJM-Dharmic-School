import AccountantLayout from "@/Layouts/SimpleLayout";
import { use, useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import useRoles from "@/Hooks/useRoles";

export default function StudentsIndex({ students }) {
    console.log(usePage().props);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("gurmukhi"); // ✅ default

    const { isAccountant } = useRoles();

    const filteredStudents = students.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AccountantLayout title="Students">
            {/* Accountant Class Filter */}
            {isAccountant && (
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setClassFilter("gurmukhi")}
                        className={`px-3 py-1 rounded-full text-sm font-medium border
                            ${
                                classFilter === "gurmukhi"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-700"
                            }`}
                    >
                        Gurmukhi
                    </button>

                    <button
                        onClick={() => setClassFilter("kirtan")}
                        className={`px-3 py-1 rounded-full text-sm font-medium border
                            ${
                                classFilter === "kirtan"
                                    ? "bg-purple-600 text-white"
                                    : "bg-white text-gray-700"
                            }`}
                    >
                        Kirtan
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {/* Add Student */}
                <div className="flex justify-end">
                    <Link
                        href="/students/create"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg
                                   hover:bg-blue-700 active:scale-95 transition
                                   w-full text-center"
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
                    className="w-full border rounded-lg px-3 py-2
                               focus:outline-none focus:ring"
                />

                {/* Student List */}
                {filteredStudents
    .filter((student) => {
        // Accountant class filter: hide student if no matching enrollment
        if (!isAccountant) return true;

        const enrollments = student.enrollments ?? [];

        return enrollments.some(
            (e) => e.school_class?.type === classFilter
        );
    })
    .slice()
    .reverse()
    .map((student) => (
        <StudentCard
            key={student.id}
            student={student}
            classFilter={isAccountant ? classFilter : null}
        />
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

/* ===============================
   STUDENT CARD
================================ */
function StudentCard({ student, classFilter }) {
    const { isTeacher } = useRoles();
    const { auth } = usePage().props;

    const enrollments = student.enrollments ?? [];

    /* Teacher allowed sections */
    const allowedSectionIds = isTeacher
        ? auth.user.sections.map((s) => s.id)
        : null;

    /* Teacher restriction */
    let visibleEnrollments = isTeacher
        ? enrollments.filter((e) =>
              allowedSectionIds.includes(e.section_id)
          )
        : enrollments;

    /* Accountant class filter */
    if (classFilter) {
        visibleEnrollments = visibleEnrollments.filter(
            (e) => e.school_class?.type === classFilter
        );
    }

    /* Paid status based on visible enrollments */
    const isPaid = visibleEnrollments.some(
        (e) => e.student_type === "paid"
    );

    return (
        <Link
            href={`/students/${student.id}`}
            className="block bg-white rounded-xl shadow p-4
                       active:scale-[0.98] transition
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                        {student.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                        Father: {student.father_name}
                    </p>
                </div>

                <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isPaid
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                    }`}
                >
                    {isPaid ? "Paid" : "Free"}
                </span>
            </div>

            {/* Enrollment Pills */}
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
                {visibleEnrollments.map((e) => {
                    const isKirtan =
                        e.school_class?.type === "kirtan";

                    return (
                        <span
                            key={e.id}
                            className={`px-2 py-1 rounded-full font-medium
                                ${
                                    isKirtan
                                        ? "bg-purple-100 text-purple-700"
                                        : "bg-gray-100 text-gray-700"
                                }`}
                        >
                            {e.school_class.name} — {e.section.name}
                        </span>
                    );
                })}

                {/* Teacher safety */}
                {isTeacher && visibleEnrollments.length === 0 && (
                    <span className="text-gray-400 italic">
                        No accessible enrollments
                    </span>
                )}
            </div>
        </Link>
    );
}
