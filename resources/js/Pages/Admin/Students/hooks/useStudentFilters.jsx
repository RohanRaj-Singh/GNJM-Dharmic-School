import { useMemo, useState } from "react";

/*
|--------------------------------------------------------------------------
| Student Filters Hook
|--------------------------------------------------------------------------
| Handles:
| - Class filter
| - Section filter
| - Paid / Free filter
|
| IMPORTANT:
| Filters work on row.original (student object)
| because enrollments are nested.
|--------------------------------------------------------------------------
*/

export default function useStudentFilters() {
  /* ----------------------------------------
   | Filter State
   ---------------------------------------- */
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all"); // paid | free | all

  /* ----------------------------------------
   | Column Filters (TanStack format)
   ---------------------------------------- */
  const columnFilters = useMemo(() => {
    const filters = [];

    if (classFilter !== "all") {
      filters.push({ id: "class", value: classFilter });
    }

    if (sectionFilter !== "all") {
      filters.push({ id: "section", value: sectionFilter });
    }

    if (feeFilter !== "all") {
      filters.push({ id: "fee", value: feeFilter });
    }

    return filters;
  }, [classFilter, sectionFilter, feeFilter]);

  /* ----------------------------------------
   | Filter Functions
   ---------------------------------------- */
  const filterFns = {
    class: (row, _columnId, filterValue) => {
      const student = row.original;

      if (!student.enrollments?.length) return false;

      return student.enrollments.some(
        (e) => String(e.class_id) === String(filterValue)
      );
    },

    section: (row, _columnId, filterValue) => {
      const student = row.original;

      if (!student.enrollments?.length) return false;

      return student.enrollments.some(
        (e) => String(e.section_id) === String(filterValue)
      );
    },

    fee: (row, _columnId, filterValue) => {
      const student = row.original;

      if (!student.enrollments?.length) return false;

      if (filterValue === "free") {
        return student.enrollments.some(
          (e) => e.student_type === "free"
        );
      }

      if (filterValue === "paid") {
        return student.enrollments.some(
          (e) => e.student_type !== "free"
        );
      }

      return true;
    },
  };

  /* ----------------------------------------
   | Reset
   ---------------------------------------- */
  function resetFilters() {
    setClassFilter("all");
    setSectionFilter("all");
    setFeeFilter("all");
  }

  /* ----------------------------------------
   | Public API
   ---------------------------------------- */
  return {
    classFilter,
    sectionFilter,
    feeFilter,

    setClassFilter,
    setSectionFilter,
    setFeeFilter,

    columnFilters,
    filterFns,
    resetFilters,
  };
}
