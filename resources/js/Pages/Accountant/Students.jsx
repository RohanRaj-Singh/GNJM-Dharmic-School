import SimpleLayout from "@/Layouts/SimpleLayout";
import { useMemo, useState } from "react";

import StudentsFilterBar from "./Students/StudentsFilterBar";
import StudentsList from "./Students/StudentsList";
import { buildStudentRows } from "./Students/utils";

/**
 * B12 — data-driven division filter.
 *
 * The page receives `divisions` from the backend (one entry per division the
 * resolver returns for the school's classes). The filter bar renders one
 * button per division plus an "All" sentinel; default state is "all" so an
 * accountant never lands on a screen that silently hides a third+ class.
 */
export default function Students({ students = [], divisions = [] }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const rows = useMemo(
    () => buildStudentRows(students ?? [], { search, classFilter }),
    [students, search, classFilter]
  );

  return (
    <SimpleLayout title="Students">
      <div className="space-y-4">
        <StudentsFilterBar
          classFilter={classFilter}
          search={search}
          divisions={divisions}
          onClassFilterChange={setClassFilter}
          onSearchChange={setSearch}
        />

        <StudentsList students={rows} />
      </div>
    </SimpleLayout>
  );
}
