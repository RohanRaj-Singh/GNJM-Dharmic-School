import AccountantLayout from "@/Layouts/SimpleLayout";
import SearchInput from "@/Components/SearchInput";
import { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import useRoles from "@/Hooks/useRoles";
import { division, divisionMeta } from "@/utils/divisionType";

const getClassObj = (enrollment) => enrollment?.school_class ?? enrollment?.schoolClass ?? null;

export default function StudentsIndex({ students = [], divisions = [] }) {
    const [search, setSearch] = useState("");
    // Default to the first division the school has configured (e.g. gurmukhi).
    // A third+ class (Music, Tabla, …) appears here automatically because the
    // backend ships the distinct division keys via `divisions` prop; no JSX
    // change needed when a new class is added. The user can also opt out of
    // filtering by switching to "All".
    const [classFilter, setClassFilter] = useState("all");

    const { isAccountant } = useRoles();

    const searchedStudents = (students ?? []).filter((s) =>
        String(s?.name ?? "").toLowerCase().includes(search.toLowerCase())
    );

    const visibleStudents = searchedStudents.filter((student) => {
        if (!isAccountant) return true;
        if (classFilter === "all") return true;
        const enrollments = student.enrollments ?? [];
        return enrollments.some((e) => {
            const cls = getClassObj(e);
            // 3-arg resolver so a class with explicit division='music' / 'tabla'
            // matches the filter pill instead of falling through to 'gurmukhi'.
            return division(cls?.type, cls?.name, cls?.division) === classFilter;
        });
    });

    return (
        <AccountantLayout title="Students" divisions={divisions}>
            {isAccountant && divisions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setClassFilter("all")}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                            classFilter === "all"
                                ? "bg-slate-700 text-white border-slate-700"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                        All
                    </button>

                    {divisions.map((key) => {
                        const meta = divisionMeta(key);
                        const isActive = classFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setClassFilter(key)}
                                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                                    isActive
                                        ? `${meta.pillBg} ${meta.pillText} border-transparent`
                                        : `${meta.bg} ${meta.text} border-gray-300 hover:${meta.bgHover}`
                                }`}
                            >
                                {meta.title}
                            </button>
                        );
                    })}
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

                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search student..."
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
            // 3-arg resolver — see root-level comment in this file.
            return division(cls?.type, cls?.name, cls?.division) === classFilter;
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
                    // 3-arg resolver + divisionMeta palette so a third+ class
                    // badge inherits a deterministic color (emerald/orange/teal/…)
                    // instead of the legacy "purple when kirtan, gray otherwise"
                    // 2-division contract.
                    const divisionKey = division(
                        cls?.type,
                        cls?.name,
                        cls?.division,
                    );
                    const meta = divisionMeta(divisionKey);

                    return (
                        <span
                            key={e.id ?? `${e.class_id}-${e.section_id}-${student.id}`}
                            className={`px-2 py-1 rounded-full font-medium ${meta.pillBg} ${meta.pillText}`}
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
