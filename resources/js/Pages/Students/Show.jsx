import SimpleLayout from "@/Layouts/SimpleLayout";
import useRoles from "@/Hooks/useRoles";
import FeeSection from "./FeeSection";
import { usePage, Link } from "@inertiajs/react";
import { useState, useMemo } from "react";

/* ── prototype mock data ── */
const MOCK_HISTORY = {
  5: [
    { className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted" },
  ],
  8: [
    { className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted" },
  ],
  15: [
    { className: "Gurmukhi Class 2", sectionName: "Doosri", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted" },
    { className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2022-04-01", transferredAt: "2023-03-31", outcome: "promoted" },
  ],
};
/* ── end mock ── */

/*
|--------------------------------------------------------------------------
| Student Show (Summary)
|--------------------------------------------------------------------------
| Accountant / Admin:
|   - Gurmukhi ONLY
|   - Attendance + Fees
|
| Teacher:
|   - Only assigned sections
|   - Attendance ONLY
|   - No fees
*/

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

export default function StudentShow({ student, summary = [] }) {
    const { isTeacher, isAccountant, isAdmin } = useRoles();
    const { auth } = usePage().props;

    // Current month/year defaults
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based

    // Selected month/year for the attendance calendar
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth); // 0-based

    // Year range: current year ± 2
    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = currentYear - 2; y <= currentYear + 2; y++) {
            years.push(y);
        }
        return years;
    }, [currentYear]);

    // Days in the selected month
    const monthDays = useMemo(() => {
        const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        return Array.from({ length: totalDays }, (_, i) =>
            new Date(selectedYear, selectedMonth, i + 1)
        );
    }, [selectedYear, selectedMonth]);

    const toDateKey = (value) => {
        const date = new Date(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    let visibleSummary = [];

    if (isAccountant || isAdmin) {
        visibleSummary = summary.filter(
            (item) => item.class?.toLowerCase() === "gurmukhi"
        );
    }

    if (isTeacher) {
        const allowedSectionNames =
            auth?.user?.sections?.map((s) => s.name) ?? [];

        visibleSummary = summary.filter((item) =>
            allowedSectionNames.includes(item.section)
        );
    }

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

                    <ContactRow
                        label="Father Phone"
                        number={student.father_phone}
                    />
                    <ContactRow
                        label="Mother Phone"
                        number={student.mother_phone}
                    />
                </div>

                {visibleSummary.map((item, index) => {
                    const recentAttendance = Array.isArray(item.attendance?.recent)
                        ? item.attendance.recent
                        : Object.values(item.attendance?.recent ?? {});

                    const recentMap = Object.fromEntries(
                        recentAttendance.map((record) => [
                            toDateKey(record.date),
                            record.status,
                        ])
                    );

                    // Calculate stats for the SELECTED month (not the current month)
                    const selectedMonthStr = String(selectedMonth + 1).padStart(2, "0");
                    const selectedMonthPrefix = `${selectedYear}-${selectedMonthStr}`;
                    const monthAttendance = recentAttendance.filter((r) =>
                        r.date && r.date.startsWith(selectedMonthPrefix)
                    );
                    const present = monthAttendance.filter((r) => r.status === "present").length;
                    const absent = monthAttendance.filter((r) => r.status === "absent").length;
                    const leave = monthAttendance.filter((r) => r.status === "leave").length;

                    return (
                        <div key={`${item.class}-${item.section}-${index}`} className="space-y-4">
                            <div className="bg-white rounded-xl shadow p-5">
                                <div className="flex flex-wrap gap-2">
                                    <Pill
                                        color={
                                            item.class === "Kirtan"
                                                ? "purple"
                                                : "blue"
                                        }
                                    >
                                        {item.class}
                                    </Pill>
                                    <Pill color="gray">{item.section}</Pill>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow p-5 space-y-2">
                                <h3 className="text-md font-semibold text-gray-700">
                                    Attendance Summary
                                </h3>

                                <StatRow
                                    label="Present"
                                    value={present}
                                    color="green"
                                />
                                <StatRow
                                    label="Absent"
                                    value={absent}
                                    color="red"
                                />
                                <StatRow
                                    label="Leave"
                                    value={leave}
                                    color="yellow"
                                />
                            </div>

                            <div className="bg-white rounded-xl shadow p-5">
                                {/* Month + Year selectors */}
                                <div className="flex flex-wrap items-center gap-3 mb-3">
                                    <h3 className="text-md font-semibold text-gray-700">
                                        Attendance
                                    </h3>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) =>
                                            setSelectedMonth(Number(e.target.value))
                                        }
                                        className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) =>
                                            setSelectedYear(Number(e.target.value))
                                        }
                                        className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                                    >
                                        {yearOptions.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-7 gap-2 text-center text-xs">
                                    {monthDays.map((day, i) => {
                                        const dateStr = toDateKey(day);
                                        const status = recentMap?.[dateStr];

                                        const color =
                                            status === "present"
                                                ? "bg-green-500"
                                                : status === "absent"
                                                ? "bg-red-500"
                                                : status === "leave"
                                                ? "bg-yellow-400"
                                                : "bg-gray-200";

                                        return (
                                            <div
                                                key={`${dateStr}-${i}`}
                                                className="flex flex-col items-center gap-1"
                                            >
                                                <span className="text-gray-500">
                                                    {day.toLocaleDateString(
                                                        "en-US",
                                                        { weekday: "short" }
                                                    )}
                                                </span>

                                                <div
                                                    className={`w-8 h-8 rounded-lg ${color}`}
                                                    title={
                                                        status
                                                            ? `${dateStr} - ${status}`
                                                            : `${dateStr} - No record`
                                                    }
                                                />

                                                <span className="text-[10px] text-gray-400">
                                                    {day.getDate()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {Object.keys(recentMap).length === 0 ? (
                                    <p className="text-sm text-gray-500 mt-3 text-center">
                                        No attendance marked
                                    </p>
                                ) : monthAttendance.length === 0 && (
                                    <p className="text-sm text-gray-500 mt-3 text-center">
                                        No records for {MONTHS[selectedMonth]} {selectedYear}
                                    </p>
                                )}
                            </div>

                            {(isAccountant || isAdmin) &&
                                item.class?.toLowerCase() === "gurmukhi" && (
                                    <FeeSection
                                        item={item}
                                        student={student}
                                    />
                                )}
                        </div>
                    );
                })}

                {visibleSummary.length === 0 && (
                    <div className="text-center text-gray-400 text-sm">
                        No accessible records
                    </div>
                )}

                {/* ═══════════════════════════════════════
                   Academic History (prototype)
                   ═══════════════════════════════════════ */}
                {(isAdmin || isAccountant) && (
                    <AcademicHistory
                        studentId={student.id}
                        studentName={student.name}
                    />
                )}
            </div>
        </SimpleLayout>
    );
}

/* ── Academic History Component (prototype) ── */
function AcademicHistory({ studentId, studentName }) {
    const history = MOCK_HISTORY[studentId] || [];

    if (history.length === 0) return null;

    const outcomeLabels = {
        promoted: { label: "Promoted", color: "bg-green-100 text-green-700" },
        repeated: { label: "Repeated", color: "bg-amber-100 text-amber-700" },
        passed_out: { label: "Passed Out", color: "bg-blue-100 text-blue-700" },
        left: { label: "Left School", color: "bg-red-100 text-red-700" },
    };

    return (
        <div className="bg-white rounded-xl shadow p-5 space-y-3">
            <h3 className="text-md font-semibold text-gray-700">Academic History</h3>

            <div className="space-y-2">
                {history.map((enr, i) => {
                    const outcome = outcomeLabels[enr.outcome] || { label: enr.outcome, color: "bg-gray-100 text-gray-700" };
                    return (
                        <div key={i} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                        {enr.className}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {enr.sectionName} · {enr.startedAt} → {enr.transferredAt}
                                    </p>
                                </div>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${outcome.color}`}>
                                    {outcome.label}
                                </span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <HistoryActionButton label="Student Report" color="blue" />
                                <HistoryActionButton label="Attendance" color="green" />
                                <HistoryActionButton label="Fees" color="amber" />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                Historical records for <strong>{studentName}</strong>. Each enrollment preserves its own fees, attendance, and reports.
            </div>
        </div>
    );
}

function HistoryActionButton({ label, color }) {
    const colors = {
        blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
        green: "bg-green-50 text-green-700 hover:bg-green-100",
        amber: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    };
    return (
        <button className={`px-2 py-1 rounded text-[11px] font-medium transition ${colors[color] || colors.blue}`}>
            {label}
        </button>
    );
}

function Pill({ children, color = "gray" }) {
    const map = {
        gray: "bg-gray-100 text-gray-700",
        blue: "bg-blue-100 text-blue-700",
        green: "bg-green-100 text-green-700",
        red: "bg-red-100 text-red-700",
        yellow: "bg-yellow-100 text-yellow-700",
        purple: "bg-purple-100 text-purple-700",
    };

    return (
        <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${map[color]}`}
        >
            {children}
        </span>
    );
}

function StatRow({ label, value, color }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold text-${color}-600`}>
                {value}
            </span>
        </div>
    );
}

function formatWhatsappNumber(number) {
    if (!number) return null;

    let cleaned = number.replace(/[^\d]/g, "");

    if (cleaned.startsWith("0")) {
        cleaned = "92" + cleaned.slice(1);
    }

    if (cleaned.startsWith("92") && cleaned.length >= 12) {
        return cleaned;
    }

    return null;
}

function ContactRow({ label, number }) {
    const waNumber = formatWhatsappNumber(number);

    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{label}</span>

            {number ? (
                <div className="flex gap-3">
                    <a
                        href={`tel:${number}`}
                        className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs"
                    >
                        Call
                    </a>

                    {waNumber ? (
                        <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs"
                        >
                            WhatsApp
                        </a>
                    ) : (
                        <span className="px-3 py-1 rounded-lg bg-gray-200 text-gray-500 text-xs">
                            WhatsApp
                        </span>
                    )}
                </div>
            ) : (
                <span className="text-gray-400 italic">Not added</span>
            )}
        </div>
    );
}
