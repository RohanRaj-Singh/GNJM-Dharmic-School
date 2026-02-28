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

  // Check if any filter is applied
  const hasCustomFilter = filters.has_custom_filter || false;

  // Collapsible states
  const [filterOpen, setFilterOpen] = useState(false);
  const [absentOpen, setAbsentOpen] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);

  // Track which students are expanded
  const [expandedStudents, setExpandedStudents] = useState({});

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

    router.get('/attendance/absentees', {}, { preserveState: true });
  };

  // Calculate days between dates
  const getDaysCount = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  // Filter sections by selected class
  const filteredSections = useMemo(() => {
    if (!classId) return sections;
    return sections.filter(s => String(s.class_id) === String(classId));
  }, [sections, classId]);

  // Group students by category (absent vs leave)
  const absentStudents = [];
  const leaveStudents = [];

  students.forEach((s) => {
    const dates = [
      ...(s.all_absent_dates || []).map(d => ({ date: d, type: 'Absent' })),
      ...(s.all_leave_dates || []).map(d => ({ date: d, type: 'Leave' }))
    ];

    const hasAbsent = (s.all_absent_dates || []).length > 0;
    const hasLeave = (s.all_leave_dates || []).length > 0;

    if (hasAbsent) {
      absentStudents.push({ ...s, all_dates: dates.filter(d => d.type === 'Absent') });
    }
    if (hasLeave) {
      leaveStudents.push({ ...s, all_dates: dates.filter(d => d.type === 'Leave') });
    }
  });

  // Sort by total days (ascending)
  const sortByDays = (a, b) => {
    const aDays = (a.all_absent_dates?.length || 0) + (a.all_leave_dates?.length || 0);
    const bDays = (b.all_absent_dates?.length || 0) + (b.all_leave_dates?.length || 0);
    return aDays - bDays;
  };

  absentStudents.sort(sortByDays);
  leaveStudents.sort(sortByDays);

  // Days count for display
  const daysCount = getDaysCount(startDate, endDate);

  // Get day name from date
  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Render a student accordion
  const renderStudentAccordion = (student, type) => {
    const studentKey = `${student.id}-${type}`;
    const isExpanded = expandedStudents[studentKey] === true;
    const totalDays = student.all_dates.length;

    return (
      <div key={studentKey} className="border rounded-lg overflow-hidden mb-2">
        <button
          onClick={() => toggleStudent(studentKey)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">{student.name}</p>
            <p className="text-xs text-gray-500">Father: {student.father_name || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${type === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {totalDays} day{totalDays !== 1 ? 's' : ''}
            </span>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isExpanded && (
          <ul className="border-t bg-gray-50 divide-y">
            {student.all_dates.map((item, idx) => (
              <li key={idx} className="px-4 py-2 flex justify-between items-center">
                <span className="text-sm text-gray-700">{item.date}</span>
                <span className="text-xs text-gray-500">{getDayName(item.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Render student list section
  const renderStudentList = (studentList, title, bgClass, iconColor) => {
    const isOpen = title === 'Absent' ? absentOpen : leaveOpen;
    const setOpen = title === 'Absent' ? setAbsentOpen : setLeaveOpen;

    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setOpen(!isOpen);
            if (title === 'Absent') {
              setLeaveOpen(false);
              setTodayOpen(false);
            } else {
              setAbsentOpen(false);
              setTodayOpen(false);
            }
          }}
          className={`w-full flex items-center justify-between px-4 py-3 ${bgClass} hover:opacity-90 transition-opacity`}
        >
          <div className="flex items-center gap-2">
            <span className={`font-medium ${iconColor}`}>{title}</span>
            <span className={`text-xs ${iconColor.replace('text-', 'bg-').replace('600', '200').replace('700', '200')} ${iconColor.replace('600', '700').replace('700', '700')} px-2 py-0.5 rounded-full`}>
              {studentList.length}
            </span>
          </div>
          <svg className={`w-5 h-5 ${iconColor} transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="p-4">
            {studentList.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">
                No {title.toLowerCase()} students
              </p>
            ) : (
              <div className="space-y-2">
                {studentList.map(s => renderStudentAccordion(s, title))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <SimpleLayout title="Attendance – Absent & Leave Register">
      <div className="space-y-4">

        {/* Filters - Collapsible */}
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
            <svg className={`w-5 h-5 text-gray-500 transition-transform ${filterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {filterOpen && (
            <div className="p-4">
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
                      setSectionId("");
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
                Showing students absent in {daysCount} day{daysCount !== 1 ? 's' : ''} ({startDate} to {endDate})
                {hasCustomFilter && <span className="ml-2 text-blue-600">(Sorted by Days - Ascending)</span>}
              </p>
            </div>
          )}
        </div>

        {/* Absent Section */}
        {renderStudentList(absentStudents, 'Absent', 'bg-red-50', 'text-red-600')}

        {/* Leave Section */}
        {renderStudentList(leaveStudents, 'Leave', 'bg-yellow-50', 'text-yellow-700')}

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
              <ul className="divide-y">
                {today_absentees.map((s) => (
                  <li key={s.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">Father: {s.father_name || '—'}</p>
                    </div>
                    <span className="text-xs bg-red-200 text-red-700 px-2 py-1 rounded">Today</span>
                  </li>
                ))}
              </ul>
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
