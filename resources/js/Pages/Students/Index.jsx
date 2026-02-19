import AccountantLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import useRoles from "@/Hooks/useRoles";

export default function StudentsIndex({ students = [] }) {
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("all");

    const { isAccountant } = useRoles();

    const getClassObj = (enrollment) => enrollment?.school_class ?? enrollment?.schoolClass ?? null;
    const classTypeToken = (cls) => {
        const typeText = String(cls?.type ?? "").trim().toLowerCase();
        const nameText = String(cls?.name ?? "").trim().toLowerCase();
        const hay = `${typeText} ${nameText}`.trim();
        if (!hay) return "";
        if (hay.includes("kirtan")) return "kirtan";
        if (hay.includes("gurmukhi")) return "gurmukhi";
        return "";
    };

    const searchedStudents = (students ?? []).filter((s) =>
        String(s?.name ?? "").toLowerCase().includes(search.toLowerCase())
    );

    const visibleStudents = searchedStudents.filter((student) => {
        if (!isAccountant) return true;
        const enrollments = student.enrollments ?? [];
        if (classFilter === "all") return enrollments.length > 0;
        return enrollments.some((e) => classTypeToken(getClassObj(e)) === classFilter);
    });

    return (
        <AccountantLayout title="Students">
            {isAccountant && (
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setClassFilter("all")}
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${
                            classFilter === "all"
                                ? "bg-slate-700 text-white"
                                : "bg-white text-gray-700"
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setClassFilter("gurmukhi")}
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${
                            classFilter === "gurmukhi"
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-700"
                        }`}
                    >
                        Gurmukhi
                    </button>

                    <button
                        onClick={() => setClassFilter("kirtan")}
                        className={`px-3 py-1 rounded-full text-sm font-medium border ${
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
                <div className="flex justify-end">
                    <Link
                        href="/students/create"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition w-full text-center"
                    >
                        + Add Student
                    </Link>
                </div>

                <input
                    type="text"
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring"
                />

                {visibleStudents
                    .slice()
                    .reverse()
                    .map((student) => (
                        <StudentCard
                            key={student.id}
                            student={student}
                            classFilter={isAccountant ? classFilter : null}
                        />
                    ))}

                {visibleStudents.length === 0 && (
                    <p className="text-center text-gray-500 text-sm">
                        No students found
                    </p>
                )}
            </div>
        </AccountantLayout>
    );
}

function StudentCard({ student, classFilter }) {
    const { isTeacher } = useRoles();
    const { auth } = usePage().props;

    const enrollments = student.enrollments ?? [];

    const allowedSectionIds = isTeacher
        ? (auth?.user?.sections ?? []).map((s) => String(s.id))
        : null;

    let visibleEnrollments = isTeacher
        ? enrollments.filter((e) => allowedSectionIds.includes(String(e.section_id)))
        : enrollments;

    if (classFilter && classFilter !== "all") {
        visibleEnrollments = visibleEnrollments.filter((e) => {
            const cls = e.school_class ?? e.schoolClass ?? null;
            return classTypeToken(cls) === classFilter;
        });
    }

    const isPaid = visibleEnrollments.some((e) => e.student_type === "paid");

    return (
        <Link
            href={`/students/${student.id}`}
            className="block bg-white rounded-xl shadow p-4 active:scale-[0.98] transition focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{student.name}</h3>
                    <p className="text-sm text-gray-500">Father: {student.father_name}</p>
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

            <div className="flex flex-wrap gap-2 mt-3 text-xs">
                {visibleEnrollments.map((e) => {
                    const cls = e.school_class ?? e.schoolClass ?? null;
                    const sec = e.section ?? null;
                    const isKirtan = classTypeToken(cls) === "kirtan";

                    return (
                        <span
                            key={e.id ?? `${e.class_id}-${e.section_id}-${student.id}`}
                            className={`px-2 py-1 rounded-full font-medium ${
                                isKirtan
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                        >
                            {(cls?.name ?? "Class")} - {(sec?.name ?? "Section")}
                        </span>
                    );
                })}

                {isTeacher && visibleEnrollments.length === 0 && (
                    <span className="text-gray-400 italic">No accessible enrollments</span>
                )}
            </div>
        </Link>
    );
}
