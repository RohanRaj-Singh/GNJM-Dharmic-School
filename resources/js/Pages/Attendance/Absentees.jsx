import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState, useMemo } from "react";
import { router } from "@inertiajs/react";

export default function Absentees({ students = [], today_absentees = [], filters = {} }) {

  // Parse filters from backend
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const defaultEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // Yesterday by default
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(filters.start_date || defaultStartDate);
  const [endDate, setEndDate] = useState(filters.end_date || defaultEndDate);
  const [includeToday, setIncludeToday] = useState(filters.include_today || false);

  // Check if custom filter is applied
  const hasCustomFilter = filters.has_custom_filter || false;

  // Collapsible states - FIRST category (absent_1) open by default, others closed
  const [absentOpen, setAbsentOpen] = useState(true); // First section open by default
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);

  // Track which sections/students are expanded
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedStudents, setExpandedStudents] = useState({});

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const toggleStudent = (studentKey) => {
    setExpandedStudents(prev => ({
      ...prev,
      [studentKey]: !prev[studentKey]
    }));
  };

  const applyFilter = () => {
    router.get('/attendance/absentees', {
      start_date: startDate,
      end_date: endDate,
      include_today: includeToday,
    }, { preserveState: true });
  };

  const resetFilter = () => {
    const defaultStart = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const defaultEnd = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setIncludeToday(false);

    router.get('/attendance/absentees', {}, { preserveState: true });
  };

  // Calculate days between dates
  const getDaysCount = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  const categories = {
    absent_1: { title: "Absent (1 Day)", icon: "❌", color: "red" },
    absent_2: { title: "Absent (2 Days)", icon: "❌❌", color: "red" },
    absent_3_plus: { title: "Absent (3+ Days)", icon: "❌❌❌", color: "red" },
    leave_1: { title: "Leave (1 Day)", icon: "🟡", color: "yellow" },
    leave_2_plus: { title: "Leave (2+ Days)", icon: "🟡🟡", color: "yellow" },
    absent_today: { title: "Absent Today", icon: "🔴", color: "red" },
  };

  const grouped = {};
  const todayGrouped = {};

  students.forEach((s) => {
    if (!grouped[s.category]) grouped[s.category] = {};
    if (!grouped[s.category][s.section]) {
      grouped[s.category][s.section] = [];
    }
    grouped[s.category][s.section].push(s);
  });

  today_absentees.forEach((s) => {
    if (!todayGrouped[s.section]) todayGrouped[s.section] = [];
    todayGrouped[s.section].push(s);
  });

  // Get days count for display
  const daysCount = getDaysCount(startDate, endDate);

  // Helper to render student list - handles both filtered and non-filtered views
  const renderStudentList = (list, sectionKey, category) => {
    // If custom filter is applied, show each student as collapsible accordion
    if (hasCustomFilter) {
      return list.map((s) => {
        const studentKey = `${s.id}-${s.category}`;
        const isExpanded = expandedStudents[studentKey] === true;

        // Combine and sort all dates (absent + leave) in descending order
        const allDates = [
          ...(s.all_absent_dates || []).map(d => ({ date: d, type: 'Absent' })),
          ...(s.all_leave_dates || []).map(d => ({ date: d, type: 'Leave' }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        return (
          <div key={studentKey} className="border rounded-lg overflow-hidden mb-2">
            <button
              onClick={() => toggleStudent(studentKey)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 bg-white"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500">Father: {s.father_name || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {allDates.length} day{allDates.length !== 1 ? 's' : ''}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                {allDates.map((item, idx) => (
                  <li
                    key={idx}
                    className="px-4 py-2 flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-700">{item.date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      item.type === 'Absent'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {item.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      });
    }

    // Default view (no filter): show simple list with section headers
    return (
      <div>
        {Object.entries(grouped[category] || {}).map(([sectionName, sectionList]) => {
          const sectionExpandKey = `${category}-${sectionName}`;
          const isSectionExpanded = expandedSections[sectionExpandKey] !== false;

          return (
            <div key={sectionExpandKey} className="mb-3">
              <button
                onClick={() => toggleSection(sectionExpandKey)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded"
              >
                <span className="text-sm font-medium text-gray-600">
                  📂 {sectionName}
                </span>
                <span className="text-xs text-gray-400">
                  {sectionList.length}
                </span>
              </button>

              {isSectionExpanded && (
                <ul className="border rounded mt-1">
                  {sectionList.map((s) => (
                    <li
                      key={s.id}
                      className="px-4 py-2 border-b last:border-b-0 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">Father: {s.father_name || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{s.date}</p>
                        {s.streak_days > 1 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            {s.streak_days} days
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <SimpleLayout title="Attendance – Absent & Leave Register">
      <div className="space-y-4">

        {/* Date Range Filter */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-medium text-gray-700 mb-3">Filter by Date Range</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
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
            {hasCustomFilter && (
              <button
                onClick={resetFilter}
                className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing students absent in last {daysCount} day{daysCount !== 1 ? 's' : ''} ({startDate} to {endDate})
            {hasCustomFilter && <span className="ml-2 text-blue-600">(Filtered View)</span>}
          </p>
        </div>

        {/* Absent Section - FIRST one open by default */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => setAbsentOpen(!absentOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-medium">Absent</span>
              <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full">
                {[grouped.absent_1, grouped.absent_2, grouped.absent_3_plus]
                  .filter(g => g && Object.keys(g).length > 0)
                  .flatMap(g => Object.values(g))
                  .flat()
                  .length || 0}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-red-600 transition-transform ${absentOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {absentOpen && (
            <div className="p-4 space-y-4">
              {['absent_1', 'absent_2', 'absent_3_plus'].map(catKey => {
                if (!grouped[catKey] || Object.keys(grouped[catKey]).length === 0) return null;
                const meta = categories[catKey];

                const list = Object.values(grouped[catKey]).flat();

                return (
                  <div key={catKey} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {meta.icon} {meta.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {list.length} student{list.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="p-3">
                      {renderStudentList(list, catKey, catKey)}
                    </div>
                  </div>
                );
              })}

              {['absent_1', 'absent_2', 'absent_3_plus'].every(k => !grouped[k] || Object.keys(grouped[k]).length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No absent students</p>
              )}
            </div>
          )}
        </div>

        {/* Leave Section - Closed by default */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => setLeaveOpen(!leaveOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-yellow-700 font-medium">Leave</span>
              <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full">
                {[grouped.leave_1, grouped.leave_2_plus]
                  .filter(g => g && Object.keys(g).length > 0)
                  .flatMap(g => Object.values(g))
                  .flat()
                  .length || 0}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-yellow-700 transition-transform ${leaveOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {leaveOpen && (
            <div className="p-4 space-y-4">
              {['leave_1', 'leave_2_plus'].map(catKey => {
                if (!grouped[catKey] || Object.keys(grouped[catKey]).length === 0) return null;
                const meta = categories[catKey];

                const list = Object.values(grouped[catKey]).flat();

                return (
                  <div key={catKey} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {meta.icon} {meta.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {list.length} student{list.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="p-3">
                      {renderStudentList(list, catKey, catKey)}
                    </div>
                  </div>
                );
              })}

              {['leave_1', 'leave_2_plus'].every(k => !grouped[k] || Object.keys(grouped[k]).length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No students on leave</p>
              )}
            </div>
          )}
        </div>

        {/* Absent Today Section - Closed by default, at the end */}
        {today_absentees && today_absentees.length > 0 && (
          <div className="bg-white border-2 border-red-500 rounded-lg overflow-hidden">
            <button
              onClick={() => setTodayOpen(!todayOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-100 hover:bg-red-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-700 font-medium">🔴 Absent Today</span>
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {today_absentees.length}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-red-700 transition-transform ${todayOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {todayOpen && (
              <div className="p-4">
                <div className="divide-y">
                  {Object.entries(todayGrouped).map(([sectionName, list]) => {
                    const sectionExpandKey = `today-${sectionName}`;
                    const isSectionExpanded = expandedSections[sectionExpandKey] !== false;

                    return (
                      <div key={sectionExpandKey} className="mb-3 last:mb-0">
                        <button
                          onClick={() => toggleSection(sectionExpandKey)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded"
                        >
                          <span className="text-sm font-medium text-gray-600">
                            📂 {sectionName}
                          </span>
                          <span className="text-xs text-gray-400">
                            {list.length}
                          </span>
                        </button>

                        {isSectionExpanded && (
                          <ul className="border rounded mt-1 bg-red-50">
                            {list.map((s) => (
                              <li
                                key={s.id}
                                className="px-4 py-2 border-b last:border-b-0 flex justify-between items-center"
                              >
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {s.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Father: {s.father_name || "—"}
                                  </p>
                                </div>
                                <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded">
                                  Today
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {students.length === 0 && (!today_absentees || today_absentees.length === 0) && (
          <p className="text-center text-sm text-gray-500 py-8">
            No absent or leave records found
          </p>
        )}

      </div>
    </SimpleLayout>
  );
}
