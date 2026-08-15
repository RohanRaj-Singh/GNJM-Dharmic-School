import SimpleLayout from "@/Layouts/SimpleLayout";
import { useEffect, useMemo, useState, useCallback } from "react";
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

// Server-round-tripped filter state (5 fields: dates, include_today, class,
// section). Set on Apply; read back via `filters` prop on next navigation.
const blankServerFilters = (startDate, endDate) => ({
  start_date: startDate,
  end_date: endDate,
  include_today: false,
  class_id: "",
  section_id: "",
});

// UI-only state (7 fields: collapsible panels + per-row sort/search prefs).
// Reset every time the user hits Apply/Reset, since the row set changes.
const blankUiState = () => ({
  filterOpen: false,
  todayOpen: false,
  expandedStudents: {},
  searchTerm: "",
  sortBy: "days_desc",
  hideZeroAbsentees: false,
  hideZeroLeaves: false,
});

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

  const [serverFilters, setServerFilters] = useState(() =>
    blankServerFilters(
      filters.start_date || defaultStartDate,
      filters.end_date || defaultEndDate
    )
  );
  const [ui, setUi] = useState(blankUiState);

  // Re-hydrate server filter state from the next-page props (when the user
  // navigates back/forward or re-applies). UI state intentionally NOT
  // re-hydrated — it resets on every server round-trip.
  useEffect(() => {
    setServerFilters(
      blankServerFilters(
        filters.start_date || defaultStartDate,
        filters.end_date || defaultEndDate
      )
    );
    setServerFilters((current) => ({
      ...current,
      include_today: !!filters.include_today,
      class_id: filters.class_id || "",
      section_id: filters.section_id || "",
    }));
    setUi(blankUiState());
  }, [
    defaultEndDate,
    defaultStartDate,
    filters.class_id,
    filters.end_date,
    filters.include_today,
    filters.section_id,
    filters.start_date,
  ]);

  const { startDate, endDate, includeToday, classId, sectionId } = serverFilters;
  const {
    filterOpen,
    todayOpen,
    expandedStudents,
    searchTerm,
    sortBy,
    hideZeroAbsentees,
    hideZeroLeaves,
  } = ui;

  // Single source of truth for "are any filters user-visible active?".
  // Both the panel badge and the page-level UX read this — no duplicate.
  const hasActiveFilters = useMemo(
    () =>
      !!filters.has_custom_filter ||
      includeToday ||
      !!classId ||
      !!sectionId,
    [filters.has_custom_filter, includeToday, classId, sectionId]
  );

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

  const setField = (field, value) =>
    setServerFilters((current) => ({ ...current, [field]: value }));

  const setUiField = (field, value) =>
    setUi((current) => ({ ...current, [field]: value }));

  const applyFilter = useCallback(() => {
    if (dateRangeError) return;
    setUi(blankUiState());

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
  }, [dateRangeError, startDate, endDate, includeToday, classId, sectionId]);

  const resetFilter = useCallback(() => {
    const { startDate: nextStartDate, endDate: nextEndDate } = getDefaultDateRange();
    setServerFilters(blankServerFilters(nextStartDate, nextEndDate));
    setUi(blankUiState());

    router.get("/attendance/absentees", {}, { preserveScroll: true });
  }, []);

  return (
    <SimpleLayout title="Attendance - Absent & Leave Register">
      <div className="space-y-4">
        <AbsenteesFiltersPanel
          filterOpen={filterOpen}
          onToggleOpen={() => setUiField("filterOpen", !filterOpen)}
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
          onStartDateChange={(value) => setField("start_date", value)}
          onEndDateChange={(value) => setField("end_date", value)}
          onClassChange={(value) => {
            setField("class_id", value);
            setField("section_id", "");
          }}
          onSectionChange={(value) => setField("section_id", value)}
          onIncludeTodayChange={(value) => setField("include_today", value)}
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
          onSearchChange={(value) => setUiField("searchTerm", value)}
          onSortChange={(value) => setUiField("sortBy", value)}
          onHideZeroAbsenteesChange={(value) => setUiField("hideZeroAbsentees", value)}
          onHideZeroLeavesChange={(value) => setUiField("hideZeroLeaves", value)}
          onToggleStudent={(studentKey) =>
            setUiField("expandedStudents", {
              ...expandedStudents,
              [studentKey]: !expandedStudents[studentKey],
            })
          }
          getDayName={getDayName}
        />

        <TodayAbsenteesPanel
          students={today_absentees}
          isOpen={todayOpen}
          onToggle={() => setUiField("todayOpen", !todayOpen)}
        />

        {visibleStudentRecords.length === 0 && (!today_absentees || today_absentees.length === 0) && (
          <p className="text-center text-sm text-gray-500 py-8">No absent or leave records found</p>
        )}
      </div>
    </SimpleLayout>
  );
}