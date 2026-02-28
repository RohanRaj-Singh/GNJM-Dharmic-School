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
  const [filterOpen, setFilterOpen] = useState(false); // Filters collapsible
  const [absentOpen, setAbsentOpen] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);

  // Track which category sections are expanded (absent_1, absent_2, etc.)
  const [expandedCategories, setExpandedCategories] = useState({});
  // Track which inner sections are expanded
  const [expandedSections, setExpandedSections] = useState({});

  const toggleCategory = (catKey) => {
    setExpandedCategories(prev => {
      const newState = {};
      newState[catKey] = !prev[catKey];
      return newState;
    });
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => {
      const newState = {};
      newState[sectionKey] = !prev[sectionKey];
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

  // Get total student count
  const getTotalCount = () => {
    return [grouped.absent_1, grouped.absent_2, grouped.absent_3_plus]
      .filter(g => g && Object.keys(g).length > 0)
      .flatMap(g => Object.values(g))
      .flat()
      .length || 0;
  };

  // Helper to render category section (Absent or Leave)
  const renderCategorySection = (categoryKeys, groupKey, title, bgClass, iconColor) => {
    const hasData = categoryKeys.some(k => grouped[k] && Object.keys(grouped[k]).length > 0);

    return (
      <div className="bg-white border rounded-lg overflow-hidden">
        <button
          onClick={() => {
            if (groupKey === 'absent') {
              setAbsentOpen(!absentOpen);
              setLeaveOpen(false);
              setTodayOpen(false);
            } else if (groupKey === 'leave') {
              setLeaveOpen(!leaveOpen);
              setAbsentOpen(false);
              setTodayOpen(false);
            } else {
              setTodayOpen(!todayOpen);
              setAbsentOpen(false);
              setLeaveOpen(false);
            }
          }}
          className={`w-full flex items-center justify-between px-4 py-3 ${bgClass} hover:opacity-90 transition-opacity`}
        >
          <div className="flex items-center gap-2">
            <span className={`font-medium ${iconColor}`}>{title}</span>
            <span className={`text-xs ${iconColor.replace('text-', 'bg-').replace('600', '200').replace('700', '200')} ${iconColor.replace('600', '700').replace('700', '700')} px-2 py-0.5 rounded-full`}>
              {categoryKeys.reduce((sum, k) => sum + (grouped[k] ? Object.values(grouped[k]).flat().length : 0), 0)}
            </span>
          </div>
          <svg className={`w-5 h-5 ${iconColor} transition-transform ${(groupKey === 'absent' ? absentOpen : groupKey === 'leave' ? leaveOpen : todayOpen) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {(groupKey === 'absent' ? absentOpen : groupKey === 'leave' ? leaveOpen : todayOpen) && hasData && (
          <div className="p-4">
            <div className="space-y-4">
              {categoryKeys.map(catKey => {
                if (!grouped[catKey] || Object.keys(grouped[catKey]).length === 0) return null;
                const meta = categories[catKey];
                const list = Object.values(grouped[catKey]).flat();

                return (
                  <div key={catKey} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(catKey)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="font-medium text-gray-700">
                        {meta.icon} {meta.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                          {list.length}
                        </span>
                        <svg className={`w-5 h-5 text-gray-500 transition-transform ${expandedCategories[catKey] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedCategories[catKey] && (
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
            </div>
          </div>
        )}

        {(groupKey === 'absent' ? absentOpen : groupKey === 'leave' ? leaveOpen : todayOpen) && !hasData && (
          <div className="p-4">
            <p className="text-sm text-gray-500 text-center py-2">
              {groupKey === 'absent' ? 'No absent students' : groupKey === 'leave' ? 'No students on leave' : 'No absent today'}
            </p>
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
        {renderCategorySection(['absent_1', 'absent_2', 'absent_3_plus'], 'absent', 'Absent', 'bg-red-50', 'text-red-600')}

        {/* Leave Section */}
        {renderCategorySection(['leave_1', 'leave_2_plus'], 'leave', 'Leave', 'bg-yellow-50', 'text-yellow-700')}

        {/* Absent Today Section */}
        {today_absentees && today_absentees.length > 0 && (
          renderCategorySection(['absent_today'], 'today', '🔴 Absent Today', 'bg-red-100', 'text-red-700')
        )}

        {students.length === 0 && (!today_absentees || today_absentees.length === 0) && (
          <p className="text-center text-sm text-gray-500 py-8">No absent or leave records found</p>
        )}

      </div>
    </SimpleLayout>
  );
}
