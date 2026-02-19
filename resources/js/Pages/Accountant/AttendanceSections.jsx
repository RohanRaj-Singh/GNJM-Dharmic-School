import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";

export default function AttendanceSections({ sections = [] }) {
  const [classFilter, setClassFilter] = useState("gurmukhi");

  const visibleSections = useMemo(() => {
    return (sections ?? []).filter((section) => {
      const type = String(section?.school_class?.type ?? "").trim().toLowerCase();
      if (!type) return true;
      return type === classFilter || type.includes(classFilter);
    });
  }, [sections, classFilter]);

  return (
    <SimpleLayout title="Select Section">
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

        {visibleSections.map((section) => (
          <Link
            key={section.id}
            href={`/accountant/attendance/sections/${section.id}`}
            className="block bg-white border rounded-xl p-4 hover:bg-gray-50"
          >
            <p className="font-semibold text-gray-800">
              {section?.school_class?.name ?? "Class"}
            </p>
            <p className="text-sm text-gray-500">{section?.name ?? "Section"}</p>
          </Link>
        ))}

        {visibleSections.length === 0 && (
          <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500 text-center">
            No sections found
          </div>
        )}
      </div>
    </SimpleLayout>
  );
}

