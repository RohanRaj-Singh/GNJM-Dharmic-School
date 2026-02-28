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

  // Parse filters from backend
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  const defaultEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(filters.start_date || defaultStartDate);
  const [endDate, setEndDate] = useState(filters.end_date || defaultEndDate);
  const [includeToday, setIncludeToday] = useState(filters.include_today || false);
  const [classId, setClassId] = useState(filters.class_id || "");
  const [sectionId, setSectionId] = useState(filters.section_id || "");
  const [search, setSearch] = useState(filters.search || "");

  // Check if any filter is applied
  const hasCustomFilter = filters.has_custom_filter || false;

  // Collapsible states - first one open by default
  const [absentOpen, setAbsentOpen] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);

  // Track which sections/students are expanded
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedStudents, setExpandedStudents] = useState({});

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => {
      const newState = {};
      // Only set the clicked one to true, others to false
      newState[sectionKey] = !prev[sectionKey];
      return newState;
    });
  };

  const toggleStudent = (studentKey) => {
    setExpandedStudents(prev => {
      const newState = {};
      newState[studentKey] = !prev[studentKey];
      return newState;
    });
  };

  const applyFilter = () => {
    router.get('/attendance/absentees', {
      start_date: startDate,
      end_date: endDate,
      include_today: includeToday,
      class_id: classId || undefined,
      section_id: sectionId || undefined,
      search: search || undefined,
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
    setClassId("");
    setSectionId("");
    setSearch("");

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

  // Filter sections by selected class
  const filteredSections = useMemo(() => {
    if (!classId) return sections;
    return sections.filter(s => String(s.class_id) === String(classId));
  }, [sections, classId]);

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

  // Days count for display
  const daysCount = getDaysCount(startDate, endDate);

  // Helper to render student row
  const renderStudentRow = (s) => {
    const studentKey = `${s.id}-${s.category}`;
    const isStudentExpanded = expandedStudents[studentKey] === true;

    const allDates = [
      ...(s.all_absent_dates || []).map(d => ({ date: d, type: 'Absent' })),
      ...(s.all_leave_dates || []).map(d => ({ date: d, type: 'Leave' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
      <div key={studentKey} className="bg-white">
        <button
          onClick={() => toggleStudent(studentKey)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">{s.name}</p>
            <p className="text-xs text-gray-500">{s.section}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {allDates.length} day{allDates.length !== 1 ? 's' : ''}
            </span>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${isStudentExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isStudentExpanded && (
          <ul className="border-t bg-gray-50 divide-y px-4">
            {allDates.map((item, idx) => (
              <li key={idx} className="py-2 flex justify-between items-center">
                <span className="text-sm text-gray-700">{item.date}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${item.type === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {item.type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Get total student count
  const getTotalCount = () => {
    return [grouped.absent_1, grouped.absent_2, grouped.absent_3_plus]
      .filter(g => g && Object.keys(g).length > 0)
      .flatMap(g => Object.values(g))
      .flat()
      .length || 0;
  };

  return (
    <SimpleLayout title="Attendance – Absent & Leave Register">
      <div className="space-y-4">

        {/* Filters */}
        <div className="bg-white border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Date From */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
            {/* Date To */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
            {/* Class Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Class</label>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId(""); // Reset section when class changes
                }}
                className="border rounded px-3 py-2 text-sm w-full"
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Section Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
                disabled={!classId && sections.length > 0}
              >
                <option value="">All Sections</option>
                {filteredSections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">Student Name</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student name..."
                className="border rounded px-3 py-2 text-sm w-full"
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
            {(hasCustomFilter || classId || sectionId || search) && (
              <button
                onClick={resetFilter}
                className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing students absent in {daysCount} day{daysCount !== 1 ? 's' : ''} ({startDate} to {endDate})
            {hasCustomFilter && <span className="ml-2 text-blue-600">(Sorted by Days - Ascending)</span>}
          </p>
        </div>

        {/* Absent Section */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => {
              setAbsentOpen(!absentOpen);
              setLeaveOpen(false);
              setTodayOpen(false);
            }}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-medium">Absent</span>
              <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full">
                {getTotalCount()}
              </span>
            </div>
            <svg className={`w-5 h-5 text-red-600 transition-transform ${absentOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {absentOpen && (
            <div className="p-4">
              <div className="space-y-4">
                {['absent_1', 'absent_2', 'absent_3_plus'].map(catKey => {
                  if (!grouped[catKey] || Object.keys(grouped[catKey]).length === 0) return null;
                  const meta = categories[catKey];

                  const list = Object.values(grouped[catKey]).flat();

                  return (
                    <div key={catKey} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(catKey)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100"
                      >
                        <span className="font-medium text-gray-700">
                          {meta.icon} {meta.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                            {list.length}
                          </span>
                          <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections[catKey] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {expandedSections[catKey] && (
                        <div className="divide-y">
                          {Object.entries(grouped[catKey] || {}).map(([sectionName, sectionList]) => {
                            const sectionKey = `${catKey}-${sectionName}`;

                            return (
                              <div key={sectionKey}>
                                <button
                                  onClick={() => toggleSection(sectionKey)}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                                >
                                  <span className="text-sm text-gray-600">📂 {sectionName}</span>
                                  <span className="text-xs text-gray-400">{sectionList.length}</span>
                                </button>

                                {expandedSections[sectionKey] && (
                                  <ul className="border-t bg-gray-50">
                                    {sectionList.map((s) => (
                                      <li key={s.id} className="px-4 py-2 flex justify-between items-center">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                          <p className="text-xs text-gray-500">Father: {s.father_name || '—'}</p>
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
                      )}
                    </div>
                  );
                })}

                {['absent_1', 'absent_2', 'absent_3_plus'].every(k => !grouped[k] || Object.keys(grouped[k]).length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-2">No absent students</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Leave Section */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => {
              setLeaveOpen(!leaveOpen);
              setAbsentOpen(false);
              setTodayOpen(false);
            }}
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
            <svg className={`w-5 h-5 text-yellow-700 transition-transform ${leaveOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {leaveOpen && (
            <div className="p-4">
              <div className="space-y-4">
                {['leave_1', 'leave_2_plus'].map(catKey => {
                  if (!grouped[catKey] || Object.keys(grouped[catKey]).length === 0) return null;
                  const meta = categories[catKey];

                  const list = Object.values(grouped[catKey]).flat();

                  return (
                    <div key={catKey} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(catKey)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100"
                      >
                        <span className="font-medium text-gray-700">
                          {meta.icon} {meta.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                            {list.length}
                          </span>
                          <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections[catKey] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {expandedSections[catKey] && (
                        <div className="divide-y">
                          {Object.entries(grouped[catKey] || {}).map(([sectionName, sectionList]) => {
                            const sectionKey = `${catKey}-${sectionName}`;

                            return (
                              <div key={sectionKey}>
                                <button
                                  onClick={() => toggleSection(sectionKey)}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                                >
                                  <span className="text-sm text-gray-600">📂 {sectionName}</span>
                                  <span className="text-xs text-gray-400">{sectionList.length}</span>
                                </button>

                                {expandedSections[sectionKey] && (
                                  <ul className="border-t bg-gray-50">
                                    {sectionList.map((s) => (
                                      <li key={s.id} className="px-4 py-2 flex justify-between items-center">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                          <p className="text-xs text-gray-500">Father: {s.father_name || '—'}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs text-gray-500">{s.date}</p>
                                          {s.streak_days > 1 && (
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
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
                      )}
                    </div>
                  );
                })}

                {['leave_1', 'leave_2_plus'].every(k => !grouped[k] || Object.keys(grouped[k]).length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-2">No students on leave</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Absent Today Section */}
        {today_absentees && today_absentees.length > 0 && (
          <div className="bg-white border-2 border-red-500 rounded-lg overflow-hidden">
            <button
              onClick={() => {
                setTodayOpen(!todayOpen);
                setAbsentOpen(false);
                setLeaveOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-red-100 hover:bg-red-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-700 font-medium">🔴 Absent Today</span>
                <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {today_absentees.length}
                </span>
              </div>
              <svg className={`w-5 h-5 text-red-700 transition-transform ${todayOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {todayOpen && (
              <div className="p-4">
                <div className="divide-y">
                  {Object.entries(todayGrouped).map(([sectionName, list]) => {
                    const sectionKey = `today-${sectionName}`;

                    return (
                      <div key={sectionKey}>
                        <button
                          onClick={() => toggleSection(sectionKey)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded"
                        >
                          <span className="text-sm font-medium text-gray-600">📂 {sectionName}</span>
                          <span className="text-xs text-gray-400">{list.length}</span>
                        </button>

                        {expandedSections[sectionKey] && (
                          <ul className="border rounded mt-1 bg-red-50">
                            {list.map((s) => (
                              <li key={s.id} className="px-4 py-2 flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                                  <p className="text-xs text-gray-500">Father: {s.father_name || '—'}</p>
                                </div>
                                <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded">Today</span>
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
          <p className="text-center text-sm text-gray-500 py-8">No absent or leave records found</p>
        )}

      </div>
    </SimpleLayout>
  );
}
