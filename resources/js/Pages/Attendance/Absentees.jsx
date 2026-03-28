import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState, useMemo } from "react";
import { router } from "@inertiajs/react";

export default function Absentees({
  students = [],
  today_absentees = [],
  classes = [],
  sections = [],
  filters = {}
}) {
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);

  const defaultEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  const [startDate, setStartDate] = useState(filters.start_date || defaultStartDate);
  const [endDate, setEndDate] = useState(filters.end_date || defaultEndDate);
  const [includeToday, setIncludeToday] = useState(filters.include_today || false);
  const [classId, setClassId] = useState(filters.class_id || "");
  const [sectionId, setSectionId] = useState(filters.section_id || "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("days_desc");
  const [hideZeroAbsentees, setHideZeroAbsentees] = useState(false);
  const [hideZeroLeaves, setHideZeroLeaves] = useState(false);

  const hasCustomFilter = filters.has_custom_filter || false;

  const toggleStudent = (studentKey) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentKey]: !prev[studentKey],
    }));
  };

  const applyFilter = () => {
    router.get(
      "/attendance/absentees",
      {
        start_date: startDate,
        end_date: endDate,
        include_today: includeToday,
        class_id: classId || undefined,
        section_id: sectionId || undefined,
      },
      { preserveState: true }
    );
  };

  const resetFilter = () => {
    const defaultStart = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    })();

    const defaultEnd = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    })();

    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setIncludeToday(false);
    setClassId("");
    setSectionId("");

    router.get("/attendance/absentees", {}, { preserveState: true });
  };

  const getDaysCount = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  const filteredSections = useMemo(() => {
    if (!classId) return sections;
    return sections.filter((section) => String(section.class_id) === String(classId));
  }, [sections, classId]);

  const studentRecords = useMemo(() => {
    const toDateValue = (value) => new Date(value).getTime();

    return [...students]
      .map((student) => {
        const absentDates = (student.all_absent_dates || []).map((date) => ({
          date,
          type: "Absent",
          sortValue: toDateValue(date),
        }));
        const leaveDates = (student.all_leave_dates || []).map((date) => ({
          date,
          type: "Leave",
          sortValue: toDateValue(date),
        }));

        return {
          ...student,
          absentCount: absentDates.length,
          leaveCount: leaveDates.length,
          totalCount: absentDates.length + leaveDates.length,
          latestDateValue: Math.max(
            0,
            ...absentDates.map((item) => item.sortValue),
            ...leaveDates.map((item) => item.sortValue)
          ),
          allDates: [...absentDates, ...leaveDates].sort((a, b) => b.sortValue - a.sortValue),
        };
      });
  }, [students]);

  const visibleStudentRecords = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const filtered = studentRecords.filter((student) => {
      if (hideZeroAbsentees && student.absentCount === 0) {
        return false;
      }

      if (hideZeroLeaves && student.leaveCount === 0) {
        return false;
      }

      if (!needle) return true;

      const haystack = [
        student.name,
        student.father_name,
        student.section,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });

    const compareNames = (a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      });

    return filtered.sort((a, b) => {
      if (sortBy === "name_asc") {
        return compareNames(a, b);
      }

      if (sortBy === "name_desc") {
        return compareNames(b, a);
      }

      if (sortBy === "absent_desc") {
        if (b.absentCount !== a.absentCount) {
          return b.absentCount - a.absentCount;
        }

        if (b.leaveCount !== a.leaveCount) {
          return b.leaveCount - a.leaveCount;
        }

        if (b.latestDateValue !== a.latestDateValue) {
          return b.latestDateValue - a.latestDateValue;
        }

        return compareNames(a, b);
      }

      if (sortBy === "leave_desc") {
        if (b.leaveCount !== a.leaveCount) {
          return b.leaveCount - a.leaveCount;
        }

        if (b.absentCount !== a.absentCount) {
          return b.absentCount - a.absentCount;
        }

        if (b.latestDateValue !== a.latestDateValue) {
          return b.latestDateValue - a.latestDateValue;
        }

        return compareNames(a, b);
      }

      if (sortBy === "days_desc") {
        if (b.totalCount !== a.totalCount) {
          return b.totalCount - a.totalCount;
        }

        if (b.latestDateValue !== a.latestDateValue) {
          return b.latestDateValue - a.latestDateValue;
        }

        return compareNames(a, b);
      }

      if (a.totalCount !== b.totalCount) {
        return a.totalCount - b.totalCount;
      }

      if (b.latestDateValue !== a.latestDateValue) {
        return b.latestDateValue - a.latestDateValue;
      }

      return compareNames(a, b);
    });
  }, [hideZeroAbsentees, hideZeroLeaves, searchTerm, sortBy, studentRecords]);

  const daysCount = getDaysCount(startDate, endDate);

  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <SimpleLayout title="Attendance - Absent & Leave Register">
      <div className="space-y-4">
        <div className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Filters</span>
              {(hasCustomFilter || classId || sectionId) && (
                <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${filterOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {filterOpen && (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Class</label>
                  <select
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setSectionId("");
                    }}
                    className="border rounded px-3 py-2 text-sm w-full"
                  >
                    <option value="">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Section</label>
                  <select
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                    disabled={!classId && sections.length > 0}
                  >
                    <option value="">All Sections</option>
                    {filteredSections.map((section) => (
                      <option key={section.id} value={section.id}>{section.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeToday"
                    checked={includeToday}
                    onChange={(e) => setIncludeToday(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="includeToday" className="text-sm text-gray-600">
                    Include Today
                  </label>
                </div>

                <button
                  onClick={applyFilter}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >
                  Apply Filter
                </button>

                {(hasCustomFilter || classId || sectionId) && (
                  <button
                    onClick={resetFilter}
                    className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                  >
                    Reset
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Showing students absent in {daysCount} day{daysCount !== 1 ? "s" : ""} ({startDate} to {endDate})
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">Student Attendance List</p>
              <p className="text-xs text-gray-500">
                Each student shows absent and leave totals
              </p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {visibleStudentRecords.length}
            </span>
          </div>

          <div className="p-4">
            <div className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search student, father, or section"
                    className="border rounded px-3 py-2 text-sm w-full"
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full md:w-56"
                  >
                    <option value="days_desc">Sort: Total Days High to Low</option>
                    <option value="days_asc">Sort: Total Days Low to High</option>
                    <option value="name_asc">Sort: Name A to Z</option>
                    <option value="name_desc">Sort: Name Z to A</option>
                    <option value="absent_desc">Sort: Most Absents</option>
                    <option value="leave_desc">Sort: Most Leaves</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={hideZeroAbsentees}
                      onChange={(e) => setHideZeroAbsentees(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Hide 0 Absentees
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={hideZeroLeaves}
                      onChange={(e) => setHideZeroLeaves(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Hide 0 Leaves
                  </label>
                </div>

                {visibleStudentRecords.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No students match the current search and sort.
              </p>
                ) : (
              <div className="space-y-2">
                {visibleStudentRecords.map((student) => {
                  const isExpanded = expandedStudents[student.id] === true;

                  return (
                    <div key={student.id} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleStudent(student.id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50"
                      >
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">
                            Father: {student.father_name || "-"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 min-w-8 text-center">
                            {student.absentCount}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 min-w-8 text-center">
                            {student.leaveCount}
                          </span>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <ul className="border-t bg-gray-50 divide-y">
                          {student.allDates.map((item, index) => (
                            <li key={`${student.id}-${item.date}-${item.type}-${index}`} className="px-4 py-2 flex items-center justify-between">
                              <div>
                                <p className="text-sm text-gray-700">{item.date}</p>
                                <p className="text-xs text-gray-500">{getDayName(item.date)}</p>
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  item.type === "Absent"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {item.type}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
                )}
              </div>
          </div>
        </div>

        {today_absentees && today_absentees.length > 0 && (
          <div className="bg-white border-2 border-red-500 rounded-lg overflow-hidden">
            <button
              onClick={() => setTodayOpen(!todayOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-100 hover:bg-red-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-700 font-medium">Absent Today</span>
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {today_absentees.length}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-red-700 transition-transform ${todayOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {todayOpen && (
              <ul className="divide-y">
                {today_absentees.map((student) => (
                  <li key={student.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-500">Father: {student.father_name || "-"}</p>
                    </div>
                    <span className="text-xs bg-red-200 text-red-700 px-2 py-1 rounded">Today</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {visibleStudentRecords.length === 0 && (!today_absentees || today_absentees.length === 0) && (
          <p className="text-center text-sm text-gray-500 py-8">No absent or leave records found</p>
        )}
      </div>
    </SimpleLayout>
  );
}
