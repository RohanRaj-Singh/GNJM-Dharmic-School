import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";

export default function Students({ students = [] }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("gurmukhi");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (students ?? []).filter((student) => {
      const matchesSearch =
        term === "" ||
        String(student?.name ?? "").toLowerCase().includes(term) ||
        String(student?.father_name ?? "").toLowerCase().includes(term);

      if (!matchesSearch) return false;

      const enrollments = student?.enrollments ?? [];
      return enrollments.some((e) => {
        const type = String(e?.school_class?.type ?? "").trim().toLowerCase();
        if (!type) return true;
        return type === classFilter || type.includes(classFilter);
      });
    });
  }, [students, search, classFilter]);

  return (
    <SimpleLayout title="Students">
      <div className="space-y-4">
        <div className="flex gap-2">
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

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student or father"
          className="w-full border rounded-lg px-3 py-2"
        />

        {rows.map((student) => (
          <Link
            key={student.id}
            href={`/students/${student.id}`}
            className="block bg-white rounded-xl shadow p-4"
          >
            <p className="font-semibold text-gray-800">{student.name}</p>
            <p className="text-sm text-gray-500">Father: {student.father_name || "-"}</p>

            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              {(student.enrollments ?? []).map((e) => {
                const cls = e?.school_class?.name ?? "Class";
                const sec = e?.section?.name ?? "Section";
                const isKirtan = String(e?.school_class?.type ?? "").toLowerCase().includes("kirtan");
                return (
                  <span
                    key={e.id}
                    className={`px-2 py-1 rounded-full ${
                      isKirtan ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {cls} - {sec}
                  </span>
                );
              })}
            </div>
          </Link>
        ))}

        {rows.length === 0 && (
          <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500 text-center">
            No students found
          </div>
        )}
      </div>
    </SimpleLayout>
  );
}
