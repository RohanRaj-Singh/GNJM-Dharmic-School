export const DEFAULT_LOOKBACK_DAYS = 30;

const DATE_INPUT_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateInputValue(date) {
  return DATE_INPUT_FORMATTER.format(date);
}

export function getDefaultDateRange() {
  const start = new Date();
  start.setDate(start.getDate() - DEFAULT_LOOKBACK_DAYS);

  const end = new Date();
  end.setDate(end.getDate() - 1);

  return {
    startDate: formatDateInputValue(start),
    endDate: formatDateInputValue(end),
  };
}

export function getDaysCount(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, 0);
}

export function getDayName(dateStr) {
  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function getTimestamp(dateStr) {
  const timestamp = new Date(dateStr).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function buildStudentRecords(students = []) {
  return students.map((student) => {
    const absentDates = (student.all_absent_dates || []).map((date) => ({
      date,
      type: "Absent",
      sortValue: getTimestamp(date),
    }));
    const leaveDates = (student.all_leave_dates || []).map((date) => ({
      date,
      type: "Leave",
      sortValue: getTimestamp(date),
    }));
    const allDates = [...absentDates, ...leaveDates].sort(
      (a, b) => b.sortValue - a.sortValue
    );

    return {
      ...student,
      recordKey: `${student.id}-${student.section || "no-section"}`,
      absentCount: absentDates.length,
      leaveCount: leaveDates.length,
      totalCount: absentDates.length + leaveDates.length,
      latestDateValue: allDates[0]?.sortValue || 0,
      allDates,
    };
  });
}

export function getFilteredSections(sections = [], classId) {
  const pool = !classId
    ? sections
    : sections.filter((section) => String(section.class_id) === String(classId));

  return [...pool].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
    })
  );
}

export function sortStudentRecords(records, sortBy) {
  const compareNames = (a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base",
    });

  return [...records].sort((a, b) => {
    if (sortBy === "name_asc") return compareNames(a, b);
    if (sortBy === "name_desc") return compareNames(b, a);

    if (sortBy === "absent_desc") {
      if (b.absentCount !== a.absentCount) return b.absentCount - a.absentCount;
      if (b.leaveCount !== a.leaveCount) return b.leaveCount - a.leaveCount;
      if (b.latestDateValue !== a.latestDateValue) return b.latestDateValue - a.latestDateValue;
      return compareNames(a, b);
    }

    if (sortBy === "leave_desc") {
      if (b.leaveCount !== a.leaveCount) return b.leaveCount - a.leaveCount;
      if (b.absentCount !== a.absentCount) return b.absentCount - a.absentCount;
      if (b.latestDateValue !== a.latestDateValue) return b.latestDateValue - a.latestDateValue;
      return compareNames(a, b);
    }

    if (sortBy === "days_asc") {
      if (a.totalCount !== b.totalCount) return a.totalCount - b.totalCount;
      if (b.latestDateValue !== a.latestDateValue) return b.latestDateValue - a.latestDateValue;
      return compareNames(a, b);
    }

    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    if (b.latestDateValue !== a.latestDateValue) return b.latestDateValue - a.latestDateValue;
    return compareNames(a, b);
  });
}

export function filterAndSortStudentRecords({
  studentRecords,
  searchTerm,
  sortBy,
  hideZeroAbsentees,
  hideZeroLeaves,
}) {
  const needle = searchTerm.trim().toLowerCase();

  const filtered = studentRecords.filter((student) => {
    if (hideZeroAbsentees && student.absentCount === 0) return false;
    if (hideZeroLeaves && student.leaveCount === 0) return false;
    if (!needle) return true;

    const haystack = [student.name, student.father_name, student.section]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });

  return sortStudentRecords(filtered, sortBy);
}
