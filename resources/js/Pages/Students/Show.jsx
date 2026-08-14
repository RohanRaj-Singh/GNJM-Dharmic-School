import SimpleLayout from "@/Layouts/SimpleLayout";
import useRoles from "@/Hooks/useRoles";
import FeeSection from "./FeeSection";
import { usePage, Link } from "@inertiajs/react";
import { useState, useMemo } from "react";
import { divisionMeta } from "@/utils/divisionType";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export default function StudentShow({ student, summary = [] }) {
    const { isTeacher, isAccountant, isAdmin } = useRoles();
    const { auth } = usePage().props;

    // Build the tab list dynamically from the summary items. The backend groups
    // enrollments by canonical class_type_key (DivisionTypeResolver), so each
    // item's key — for a third class as well as Gurmukhi/Kirtan — is one tab.
    // The tab label + color come from divisionMeta; the Kirtan Sunday-only UI
    // inside the tab is gated by item.class_type_key === 'kirtan' separately.
    const tabs = useMemo(() => {
        const makeTab = (item, idx) => {
            const meta = divisionMeta(item.class_type_key);
            return {
                key: item.class_type_key,
                label: meta.title,
                accent: meta.accent,
                pillBg: meta.pillBg,
                pillText: meta.pillText,
                index: idx,
            };
        };

        if (isTeacher) {
            const allowedSectionNames = auth?.user?.sections?.map((s) => s.name) ?? [];
            const seen = new Set();
            const tabs = [];
            summary.forEach((item, idx) => {
                if (!allowedSectionNames.includes(item.section)) return;
                if (seen.has(item.class_type_key)) return;
                seen.add(item.class_type_key);
                tabs.push(makeTab(item, idx));
            });
            return tabs;
        }

        if (isAccountant || isAdmin) {
            const seen = new Set();
            return summary
                .map((item, idx) => {
                    if (seen.has(item.class_type_key)) return null;
                    seen.add(item.class_type_key);
                    return makeTab(item, idx);
                })
                .filter(Boolean);
        }

        return [];
    }, [summary, isTeacher, isAccountant, isAdmin, auth]);

    const [activeTab, setActiveTab] = useState(0);
    const activeItem = tabs.length > 0 ? summary[tabs[activeTab]?.index] : null;

    // Fallback: render all summary items as individual cards when no tabs exist,
    // preventing data from being hidden when the tab logic can't resolve types.
    const renderFallback = tabs.length === 0 && summary.length > 0;

    return (
        <SimpleLayout title="Student Summary">
            <div className="space-y-5">
                <div className="bg-white rounded-xl shadow p-5">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {student.name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Father: {student.father_name}
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow p-5 space-y-4">
                    <h3 className="text-md font-semibold text-gray-700">
                        Parent Contact
                    </h3>
                    <ContactRow label="Father Phone" number={student.father_phone} />
                    <ContactRow label="Mother Phone" number={student.mother_phone} />
                </div>

                {/* Tabs — only show when more than one division is present */}
                {tabs.length > 1 && (
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {tabs.map((tab, idx) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(idx)}
                                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
                                    activeTab === idx
                                        ? `bg-white ${tab.accent} shadow`
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Active tab content (when tabs work) */}
                {!renderFallback && activeItem ? (
                    <TabContent
                        item={activeItem}
                        student={student}
                        isKirtanTab={activeItem.class_type_key === "kirtan"}
                        canViewFees={isAccountant || isAdmin}
                    />
                ) : null}

                {/* Fallback: render each summary item when no tabs were resolved */}
                {renderFallback ? summary.map((item, idx) => (
                    <TabContent
                        key={idx}
                        item={item}
                        student={student}
                        isKirtanTab={item.class_type_key === "kirtan"}
                        canViewFees={isAccountant || isAdmin}
                    />
                )) : null}

                {!renderFallback && !activeItem && !(tabs.length > 0) && (
                    <div className="text-center text-gray-400 text-sm py-8">
                        No accessible records
                    </div>
                )}

                {/* Academic History */}
                {(isAdmin || isAccountant) && summary.length > 0 && (
                    <AcademicHistory studentId={student.id} studentName={student.name} />
                )}
            </div>
        </SimpleLayout>
    );
}

/* ── Tab Content ── */
function TabContent({ item, student, isKirtanTab, canViewFees }) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    const yearOptions = useMemo(() => {
        const y = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => y - 2 + i);
    }, []);

    const monthDays = useMemo(() => {
        const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        return Array.from({ length: totalDays }, (_, i) =>
            new Date(selectedYear, selectedMonth, i + 1)
        );
    }, [selectedYear, selectedMonth]);

    const toDateKey = (value) => {
        if (!value) return "";
        const d = new Date(value);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const recentAttendance = Array.isArray(item.attendance?.recent)
        ? item.attendance.recent
        : Object.values(item.attendance?.recent ?? {});

    const recentMap = Object.fromEntries(
        recentAttendance.map((r) => [toDateKey(r.date), r])
    );

    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    const monthAttendance = recentAttendance.filter((r) => r.date?.startsWith(monthPrefix));
    const present = monthAttendance.filter((r) => r.status === "present").length;
    const absent = monthAttendance.filter((r) => r.status === "absent").length;
    const leave = monthAttendance.filter((r) => r.status === "leave").length;

    return (
        <div className="space-y-4">
            {/* Class & Section badge */}
            <div className="bg-white rounded-xl shadow p-5">
                <div className="flex flex-wrap gap-2">
                    <Pill bgClassName={divisionMeta(item.class_type_key).pillBg} textClassName={divisionMeta(item.class_type_key).pillText}>
                        {item.class}
                    </Pill>
                    <Pill bgClassName="bg-gray-100" textClassName="text-gray-700">{item.section}</Pill>
                </div>
            </div>

            {/* Attendance Summary */}
            <div className="bg-white rounded-xl shadow p-5 space-y-2">
                <h3 className="text-md font-semibold text-gray-700">Attendance Summary</h3>
                <StatRow label="Present" value={present} color="green" />
                <StatRow label="Absent" value={absent} color="red" />
                <StatRow label="Leave" value={leave} color="yellow" />
            </div>

            {/* Attendance Calendar */}
            <div className="bg-white rounded-xl shadow p-5">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-md font-semibold text-gray-700">Attendance</h3>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                    >
                        {MONTHS.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                    >
                        {yearOptions.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {isKirtanTab && (
                        <span className="text-[11px] text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded-full">
                            Kirtan · Sundays only
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</div>
                    ))}
                    {monthDays.map((day, i) => {
                        const dateStr = toDateKey(day);
                        const record = recentMap?.[dateStr];
                        const status = record?.status;
                        const isLessonLearned = record?.lesson_learned;
                        const lessonNote = record?.lesson_note;

                        const color =
                            status === "present" ? "bg-green-500"
                            : status === "absent" ? "bg-red-500"
                            : status === "leave" ? "bg-yellow-400"
                            : "bg-gray-200";

                        return (
                            <div key={`${dateStr}-${i}`} className="flex flex-col items-center gap-0.5">
                                <div
                                    className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center relative`}
                                    title={
                                        status
                                            ? `${dateStr} - ${status}${isLessonLearned && isKirtanTab ? " (lesson learned)" : ""}`
                                            : `${dateStr} - No record`
                                    }
                                >
                                    {isLessonLearned && isKirtanTab && (
                                        <svg className="w-4 h-4 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-[10px] text-gray-400">{day.getDate()}</span>
                            </div>
                        );
                    })}
                </div>

                {Object.keys(recentMap).length === 0 ? (
                    <p className="text-sm text-gray-500 mt-3 text-center">No attendance marked</p>
                ) : monthAttendance.length === 0 && (
                    <p className="text-sm text-gray-500 mt-3 text-center">
                        No records for {MONTHS[selectedMonth]} {selectedYear}
                    </p>
                )}
            </div>

            {/* Lesson Notes — Kirtan only, shown below the calendar as a list */}
            {isKirtanTab && (
                <div className="bg-white rounded-xl shadow p-5">
                    <h3 className="text-md font-semibold text-gray-700 mb-3">Lesson Notes</h3>
                    {(() => {
                        const notes = recentAttendance
                            .filter((r) => r.lesson_note)
                            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

                        return notes.length > 0 ? (
                            <div className="space-y-2">
                                {notes.map((r, i) => (
                                    <div key={i} className="border rounded-lg p-3 bg-purple-50/30">
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                            <span className="font-medium">{r.date}</span>
                                            {r.lesson_learned && (
                                                <span className="text-green-600 font-medium flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Lesson learned
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-700">{r.lesson_note}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">No lesson notes recorded.</p>
                        );
                    })()}
                </div>
            )}

            {/* Fees (accountant/admin only) */}
            {canViewFees && <FeeSection item={item} student={student} />}
        </div>
    );
}

/* ── Subcomponents ── */
function AcademicHistory({ studentId, studentName }) {
    // This will be replaced when enrollment-history API is connected
    return null;
}

function Pill({ children, bgClassName = "bg-gray-100", textClassName = "text-gray-700" }) {
    return (
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${bgClassName} ${textClassName}`}>
            {children}
        </span>
    );
}

function StatRow({ label, value, color }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold text-${color}-600`}>{value}</span>
        </div>
    );
}

function formatWhatsappNumber(number) {
    if (!number) return null;
    let cleaned = number.replace(/[^\d]/g, "");
    if (cleaned.startsWith("0")) cleaned = "92" + cleaned.slice(1);
    if (cleaned.startsWith("92") && cleaned.length >= 12) return cleaned;
    return null;
}

function ContactRow({ label, number }) {
    const waNumber = formatWhatsappNumber(number);
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{label}</span>
            {number ? (
                <div className="flex gap-3">
                    <a href={`tel:${number}`} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">Call</a>
                    {waNumber ? (
                        <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs">WhatsApp</a>
                    ) : (
                        <span className="px-3 py-1 rounded-lg bg-gray-200 text-gray-500 text-xs">WhatsApp</span>
                    )}
                </div>
            ) : (
                <span className="text-gray-400 italic">Not added</span>
            )}
        </div>
    );
}
