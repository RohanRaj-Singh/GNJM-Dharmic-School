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

export default function StudentShow({ student, summary = [], divisions = [] }) {
    const { isTeacher, isAccountant, isAdmin } = useRoles();
    const { auth } = usePage().props;

    // Build tabs from `divisions` (every distinct division the school has
    // configured — shipped by StudentController::show via the
    // DivisionTypeResolver seam) so a third+ class (Music, Tabla, …) shows
    // up as a tab even if the current student has no enrollment in it.
    // Each tab maps back to a summary item by class_type_key; tabs without
    // a match render a "Not enrolled in this class" placeholder so the
    // user sees the full configured surface instead of a 2-tab illusion.
    const tabs = useMemo(() => {
        const summaryByKey = new Map();
        summary.forEach((item, idx) => {
            summaryByKey.set(item.class_type_key, { item, idx });
        });

        const allowedSectionNames = isTeacher
            ? (auth?.user?.sections?.map((s) => s.name) ?? [])
            : null;

        // Build a de-duplicated ordered tab list. Prefer backend `divisions`
        // order (stable); fall back to summary keys when the prop wasn't
        // shipped (legacy payload shape).
        const orderedKeys = divisions.length > 0
            ? divisions
            : Array.from(summaryByKey.keys());

        const seen = new Set();
        const built = [];

        orderedKeys.forEach((key) => {
            if (seen.has(key)) return;
            const match = summaryByKey.get(key);
            const meta = divisionMeta(key);

            // Teacher access: skip divisions whose section is not in the
            // teacher's owned sections. Without a summary item to inspect,
            // a tab gets hidden unless division-level access policy says
            // otherwise — current behaviour preserves the "section-gated"
            // contract that the rest of the Students module already uses.
            if (isTeacher && match) {
                if (!allowedSectionNames.includes(match.item.section)) return;
            }

            seen.add(key);
            built.push({
                key,
                label: meta.title,
                accent: meta.accent,
                pillBg: meta.pillBg,
                pillText: meta.pillText,
                summaryIndex: match?.idx ?? -1,
                hasItem: Boolean(match),
            });
        });

        return built;
    }, [summary, divisions, isTeacher, auth]);

    const [activeTab, setActiveTab] = useState(0);
    const activeTabObj = tabs[Math.min(activeTab, Math.max(tabs.length - 1, 0))];
    const activeItem = activeTabObj?.hasItem ? summary[activeTabObj.summaryIndex] : null;

    // Empty state: no divisions configured AND no enrollments — the
    // per-student view has nothing to show.
    const noTabsAtAll = tabs.length === 0;

    return (
        <SimpleLayout title="Student Summary" divisions={divisions}>
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

                {/* Tabs — render whenever more than one division is configured,
                    regardless of enrollment. A single configured division still
                    shows as a non-tabbed "active section" via the content
                    below. */}
                {tabs.length > 1 && (
                    <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
                        {tabs.map((tab, idx) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(idx)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                    activeTab === idx
                                        ? `bg-white ${tab.accent} shadow`
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                {tab.label}
                                {!tab.hasItem && (
                                    <span className="ml-1 text-[10px] text-gray-400 font-normal">
                                        ·
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Active tab content: real data if enrolled, "Not enrolled"
                    placeholder if not. */}
                {noTabsAtAll ? (
                    <div className="text-center text-gray-400 text-sm py-8">
                        No accessible records
                    </div>
                ) : activeItem ? (
                    <TabContent
                        item={activeItem}
                        student={student}
                        divisionKey={activeTabObj.key}
                        canViewFees={isAccountant || isAdmin}
                    />
                ) : (
                    <NotEnrolledPlaceholder
                        divisionKey={activeTabObj.key}
                        student={student}
                    />
                )}

                {/* Academic History */}
                {(isAdmin || isAccountant) && summary.length > 0 && (
                    <AcademicHistory studentId={student.id} studentName={student.name} />
                )}
            </div>
        </SimpleLayout>
    );
}

/* ── Empty state: student is not enrolled in the active division ── */
function NotEnrolledPlaceholder({ divisionKey, student }) {
    const meta = divisionMeta(divisionKey);
    return (
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
            <div className="inline-flex flex-wrap gap-2 justify-center">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${meta.pillBg} ${meta.pillText}`}>
                    {meta.title}
                </span>
            </div>
            <p className="text-gray-700 text-sm font-medium">
                {student.name} is not enrolled in {meta.title}.
            </p>
            <p className="text-gray-400 text-xs">
                No attendance, fee, or lesson records exist for this division yet.
            </p>
        </div>
    );
}

/* ── Tab Content ── */
function TabContent({ item, student, divisionKey, canViewFees }) {
    const meta = divisionMeta(divisionKey);
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
                    <Pill bgClassName={meta.pillBg} textClassName={meta.pillText}>
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
                    {meta.hasLessonNotes && (
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${meta.pillBg} ${meta.pillText}`}>
                            {meta.title} · {meta.title === "Kirtan" ? "Sundays only" : "Lesson notes"}
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
                                            ? `${dateStr} - ${status}${isLessonLearned && meta.hasLessonNotes ? " (lesson learned)" : ""}`
                                            : `${dateStr} - No record`
                                    }
                                >
                                    {isLessonLearned && meta.hasLessonNotes && (
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

            {/* Lesson Notes — opt-in per division via meta.hasLessonNotes
                (kirtan keeps `true`; any third+ division defaults to `false`
                from divisionMeta — see utils/divisionType.js withDefaults()). */}
            {meta.hasLessonNotes && (
                <div className="bg-white rounded-xl shadow p-5">
                    <h3 className="text-md font-semibold text-gray-700 mb-3">Lesson Notes</h3>
                    {(() => {
                        const notes = recentAttendance
                            .filter((r) => r.lesson_note)
                            .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

                        return notes.length > 0 ? (
                            <div className="space-y-2">
                                {notes.map((r, i) => (
                                    <div key={i} className={`border rounded-lg p-3 ${meta.bg}/30`}>
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
