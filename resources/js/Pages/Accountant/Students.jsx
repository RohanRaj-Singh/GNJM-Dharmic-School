import SimpleLayout from "@/Layouts/SimpleLayout";
import { useMemo, useState } from "react";

import StudentsFilterBar from "./Students/StudentsFilterBar";
import StudentsList from "./Students/StudentsList";
import { buildStudentRows } from "./Students/utils";

export default function Students({ students = [] }) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("gurmukhi");

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
          onClassFilterChange={setClassFilter}
          onSearchChange={setSearch}
        />

        <StudentsList students={rows} />
      </div>
    </SimpleLayout>
  );
}
