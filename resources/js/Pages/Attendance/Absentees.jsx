import SimpleLayout from "@/Layouts/SimpleLayout";
import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";

import AbsenteesFiltersPanel from "./Absentees/AbsenteesFiltersPanel";
import AbsenteesStudentList from "./Absentees/AbsenteesStudentList";
import TodayAbsenteesPanel from "./Absentees/TodayAbsenteesPanel";
import {
  buildStudentRecords,
  filterAndSortStudentRecords,
  getDayName,
  getDaysCount,
  getDefaultDateRange,
  getFilteredSections,
} from "./Absentees/utils";

export default function Absentees({
  students = [],
  today_absentees = [],
  classes = [],
  sections = [],
  filters = {},
}) {
  const { startDate: defaultStartDate, endDate: defaultEndDate } = useMemo(
    () => getDefaultDateRange(),
    []
  );

  const [startDate, setStartDate] = useState(filters.start_date || defaultStartDate);
  const [endDate, setEndDate] = useState(filters.end_date || defaultEndDate);
  const [includeToday, setIncludeToday] = useState(!!filters.include_today);
  const [classId, setClassId] = useState(filters.class_id || "");
  const [sectionId, setSectionId] = useState(filters.section_id || "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("days_desc");
  const [hideZeroAbsentees, setHideZeroAbsentees] = useState(false);
  const [hideZeroLeaves, setHideZeroLeaves] = useState(false);

  const hasCustomFilter = !!filters.has_custom_filter;
  const hasActiveFilters = hasCustomFilter || !!classId || !!sectionId || includeToday;

  useEffect(() => {
    setStartDate(filters.start_date || defaultStartDate);
    setEndDate(filters.end_date || defaultEndDate);
    setIncludeToday(!!filters.include_today);
    setClassId(filters.class_id || "");
    setSectionId(filters.section_id || "");
  }, [
    defaultEndDate,
    defaultStartDate,
    filters.class_id,
    filters.end_date,
    filters.include_today,
    filters.section_id,
    filters.start_date,
  ]);

  const daysCount = useMemo(() => getDaysCount(startDate, endDate), [startDate, endDate]);
  const dateRangeError =
    startDate && endDate && daysCount === 0
      ? "To Date must be the same as or after From Date."
      : "";

  const filteredSections = useMemo(
    () => getFilteredSections(sections, classId),
    [sections, classId]
  );

  const studentRecords = useMemo(() => buildStudentRecords(students), [students]);

  const visibleStudentRecords = useMemo(
    () =>
      filterAndSortStudentRecords({
        studentRecords,
        searchTerm,
        sortBy,
        hideZeroAbsentees,
        hideZeroLeaves,
      }),
    [hideZeroAbsentees, hideZeroLeaves, searchTerm, sortBy, studentRecords]
  );

  const resetClientState = () => {
    setSearchTerm("");
    setSortBy("days_desc");
    setHideZeroAbsentees(false);
    setHideZeroLeaves(false);
    setExpandedStudents({});
  };

  const toggleStudent = (studentKey) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentKey]: !prev[studentKey],
    }));
  };

  const applyFilter = () => {
    if (dateRangeError) {
      return;
    }

    resetClientState();

    router.get(
      "/attendance/absentees",
      {
        start_date: startDate,
        end_date: endDate,
        include_today: includeToday,
        class_id: classId || undefined,
        section_id: sectionId || undefined,
      },
      { preserveScroll: true }
    );
  };

  const resetFilter = () => {
    const { startDate: nextStartDate, endDate: nextEndDate } = getDefaultDateRange();

    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setIncludeToday(false);
    setClassId("");
    setSectionId("");
    resetClientState();

    router.get("/attendance/absentees", {}, { preserveScroll: true });
  };

  return (
    <SimpleLayout title="Attendance - Absent & Leave Register">
      <div className="space-y-4">
        <AbsenteesFiltersPanel
          filterOpen={filterOpen}
          onToggleOpen={() => setFilterOpen((current) => !current)}
          hasActiveFilters={hasActiveFilters}
          startDate={startDate}
          endDate={endDate}
          classId={classId}
          sectionId={sectionId}
          includeToday={includeToday}
          classes={classes}
          filteredSections={filteredSections}
          daysCount={daysCount}
          dateRangeError={dateRangeError}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClassChange={(value) => {
            setClassId(value);
            setSectionId("");
          }}
          onSectionChange={setSectionId}
          onIncludeTodayChange={setIncludeToday}
          onApply={applyFilter}
          onReset={resetFilter}
        />

        <AbsenteesStudentList
          records={visibleStudentRecords}
          searchTerm={searchTerm}
          sortBy={sortBy}
          hideZeroAbsentees={hideZeroAbsentees}
          hideZeroLeaves={hideZeroLeaves}
          expandedStudents={expandedStudents}
          onSearchChange={setSearchTerm}
          onSortChange={setSortBy}
          onHideZeroAbsenteesChange={setHideZeroAbsentees}
          onHideZeroLeavesChange={setHideZeroLeaves}
          onToggleStudent={toggleStudent}
          getDayName={getDayName}
        />

        <TodayAbsenteesPanel
          students={today_absentees}
          isOpen={todayOpen}
          onToggle={() => setTodayOpen((current) => !current)}
        />

        {visibleStudentRecords.length === 0 && (!today_absentees || today_absentees.length === 0) && (
          <p className="text-center text-sm text-gray-500 py-8">No absent or leave records found</p>
        )}
      </div>
    </SimpleLayout>
  );
}
