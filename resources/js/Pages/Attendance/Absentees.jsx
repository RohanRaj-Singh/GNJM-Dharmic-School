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

  // Collapsible states - Absent open by default
  const [absentOpen, setAbsentOpen] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);

  // Track which sections are expanded within each category
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const applyFilter = () => {
    router.get('/attendance/absentees', {
      start_date: startDate,
      end_date: endDate,
      include_today: includeToday,
    }, { preserveState: true });
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
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing students absent in last {daysCount} day{daysCount !== 1 ? 's' : ''} ({startDate} to {endDate})
          </p>
        </div>

        {/* Absent Section - Collapsible, open by default */}
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

                return (
                  <div key={catKey} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {meta.icon} {meta.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Object.values(grouped[catKey]).flat().length} student{Object.values(grouped[catKey]).flat().length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="divide-y">
                      {Object.entries(grouped[catKey]).map(([sectionName, list]) => {
                        const sectionKey = `${catKey}-${sectionName}`;
                        const isSectionExpanded = expandedSections[sectionKey] !== false;

                        return (
                          <div key={sectionKey}>
                            <button
                              onClick={() => toggleSection(sectionKey)}
                              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                            >
                              <span className="text-sm text-gray-600">
                                📂 {sectionName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {list.length} student{list.length !== 1 ? 's' : ''}
                              </span>
                            </button>

                            {isSectionExpanded && (
                              <ul className="border-t">
                                {list.map((s) => (
                                  <li
                                    key={s.id}
                                    className="px-4 py-2 flex justify-between items-center"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {s.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Father: {s.father_name || "—"}
                                      </p>
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
                  </div>
                );
              })}

              {['absent_1', 'absent_2', 'absent_3_plus'].every(k => !grouped[k] || Object.keys(grouped[k]).length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No absent students</p>
              )}
            </div>
          )}
        </div>

        {/* Leave Section - Collapsible */}
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

                return (
                  <div key={catKey} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {meta.icon} {meta.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Object.values(grouped[catKey]).flat().length} student{Object.values(grouped[catKey]).flat().length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="divide-y">
                      {Object.entries(grouped[catKey]).map(([sectionName, list]) => {
                        const sectionKey = `${catKey}-${sectionName}`;
                        const isSectionExpanded = expandedSections[sectionKey] !== false;

                        return (
                          <div key={sectionKey}>
                            <button
                              onClick={() => toggleSection(sectionKey)}
                              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                            >
                              <span className="text-sm text-gray-600">
                                📂 {sectionName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {list.length} student{list.length !== 1 ? 's' : ''}
                              </span>
                            </button>

                            {isSectionExpanded && (
                              <ul className="border-t">
                                {list.map((s) => (
                                  <li
                                    key={s.id}
                                    className="px-4 py-2 flex justify-between items-center"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {s.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Father: {s.father_name || "—"}
                                      </p>
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
                  </div>
                );
              })}

              {['leave_1', 'leave_2_plus'].every(k => !grouped[k] || Object.keys(grouped[k]).length === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No students on leave</p>
              )}
            </div>
          )}
        </div>

        {/* Absent Today Section - Collapsible, at the end */}
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
                    const sectionKey = `today-${sectionName}`;
                    const isSectionExpanded = expandedSections[sectionKey] !== false;

                    return (
                      <div key={sectionKey}>
                        <button
                          onClick={() => toggleSection(sectionKey)}
                          className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                        >
                          <span className="text-sm text-gray-600">
                            📂 {sectionName}
                          </span>
                          <span className="text-xs text-gray-400">
                            {list.length} student{list.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {isSectionExpanded && (
                          <ul className="border-t bg-red-50">
                            {list.map((s) => (
                              <li
                                key={s.id}
                                className="px-4 py-2 flex justify-between items-center"
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
