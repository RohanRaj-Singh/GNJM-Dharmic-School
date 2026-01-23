import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import MultiSelect from "@/Components/MultiSelect";

/*
|--------------------------------------------------------------------------
| Student Report (Performa)
|--------------------------------------------------------------------------
| - Full on-screen report
| - PDF optional
| - Color coded
| - Modular UI
*/

export default function StudentReport() {
    const currentYear = new Date().getFullYear();

    const [students, setStudents] = useState([]);
    const [studentId, setStudentId] = useState(null);
    const [year, setYear] = useState(currentYear);
    const [monthFrom, setMonthFrom] = useState(null);
    const [monthTo, setMonthTo] = useState(null);

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    /* ================= OPTIONS ================= */
    const studentOptions = useMemo(
        () =>
            students.map(s => ({
                value: s.id,
                label: `${s.name}${s.father_name ? ` (Father: ${s.father_name})` : ""}`,
            })),
        [students]
    );

    const yearOptions = useMemo(() => {
        return Array.from({ length: 5 }, (_, i) => {
            const y = currentYear - 3 + i;
            return { value: y, label: String(y) };
        });
    }, [currentYear]);

    const monthOptions = useMemo(() => {
        if (!year) return [];
        const months = [
            "January","February","March","April","May","June",
            "July","August","September","October","November","December",
        ];
        return months.map((name, i) => ({
            value: `${year}-${String(i + 1).padStart(2, "0")}`,
            label: name,
        }));
    }, [year]);

    /* ================= LOAD STUDENTS ================= */
    useEffect(() => {
        fetch("/admin/students/list", { headers: { Accept: "application/json" } })
            .then(r => r.json())
            .then(setStudents)
            .catch(() => setStudents([]));
    }, []);

    /* ================= BUILD REPORT ================= */
    async function buildReport() {
        if (!studentId || !year) return;

        if (monthFrom && monthTo && monthFrom > monthTo) {
            alert("From month cannot be after To month");
            return;
        }

        setLoading(true);
        setError(null);
        setReport(null);

        try {
            const res = await fetch("/admin/reports/build", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-CSRF-TOKEN": document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute("content"),
                },
                body: JSON.stringify({
                    report: "student",
                    student_id: studentId,
                    year,
                    month_from: monthFrom,
                    month_to: monthTo,
                }),
            });

            if (!res.ok) {
                setError("Failed to build report");
                return;
            }

            setReport(await res.json());
        } finally {
            setLoading(false);
        }
    }

    /* ================= PDF EXPORT ================= */
    function exportPdf() {
        if (!studentId || !year) return;

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/admin/reports/export/pdf";
        form.target = "_blank";

        const csrf = document.createElement("input");
        csrf.type = "hidden";
        csrf.name = "_token";
        csrf.value = document.querySelector('meta[name="csrf-token"]')?.content;
        form.appendChild(csrf);

        ["report","student_id","year","month_from","month_to"].forEach(key => {
            const val = { report: "student", student_id: studentId, year, month_from: monthFrom, month_to: monthTo }[key];
            if (val == null) return;
            const i = document.createElement("input");
            i.type = "hidden";
            i.name = key;
            i.value = val;
            form.appendChild(i);
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }

    /* ================= RENDER ================= */
    return (
        <AdminLayout title="Student Report">
            {/* FILTER BAR */}
            <FilterBar
                studentOptions={studentOptions}
                yearOptions={yearOptions}
                monthOptions={monthOptions}
                studentId={studentId}
                year={year}
                monthFrom={monthFrom}
                monthTo={monthTo}
                setStudentId={setStudentId}
                setYear={setYear}
                setMonthFrom={setMonthFrom}
                setMonthTo={setMonthTo}
                loading={loading}
                buildReport={buildReport}
                exportPdf={exportPdf}
                report={report}
            />

           {/* {error && <ErrorBox message={error} />} */}

            {report && (
                <>
                    <StudentHeader student={report.student} />
                    <SummaryCards report={report} />
                    <FeesSection title="Gurmukhi Fees" data={report.gurmukhi.fees} />
                    <AttendanceCalendar
    title="Gurmukhi"
    attendance={report.gurmukhi.attendance}
/>
                    <FeesSection title="Kirtan Fees" data={report.kirtan.fees} />


<AttendanceCalendar
    title="Kirtan"
    attendance={report.kirtan.attendance}
/>

                </>
            )}
        </AdminLayout>
    );
}

export function StudentHeader({ student }) {
    return (
        <div className="bg-white border rounded p-4 mb-4">
            <h2 className="text-xl font-semibold">{student.name}</h2>
            {student.father_name && (
                <p className="text-sm text-gray-500">Father: {student.father_name}</p>
            )}
        </div>
    );
}

export function SummaryCards({ report }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Gurmukhi Pending" color="text-red-600"
                value={`Rs. ${report.gurmukhi.fees.summary.pending}`} />
            <Stat label="Gurmukhi Attendance" color="text-green-600"
                value={`${report.gurmukhi.attendance.summary.percentage}%`} />
            <Stat label="Kirtan Attendance" color="text-green-600"
                value={`${report.kirtan.attendance.summary.percentage}%`} />
            <Stat label="Kirtan Performance" color="text-blue-600"
                value={`${report.kirtan.performance.percentage}% (${report.kirtan.performance.rating})`} />
        </div>
    );
}

function Stat({ label, value, color }) {
    return (
        <div className="border rounded p-3 bg-white">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-lg font-semibold ${color}`}>{value}</div>
        </div>
    );
}

function AttendanceCalendar({ title, attendance }) {
    if (
        !attendance ||
        !attendance.calendar ||
        Object.keys(attendance.calendar).length === 0
    ) {
        return (
            <div className="bg-white border rounded p-4 text-sm text-gray-400">
                {title}: No attendance data
            </div>
        );
    }

    const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

    return (
        <div className="bg-white border rounded p-4 space-y-6">
            <h3 className="font-semibold text-sm text-gray-700">
                {title} Attendance
            </h3>

            {/* 3 months per row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(attendance.calendar).map(([month, days]) => {
                    // days is {1:{}, 2:{}, ...}
                    const year = attendance.year ?? new Date().getFullYear();

                    // JS month index (0–11)
                    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();

                    // Day of week for 1st of month (0 = Sunday)
                    const firstDayWeekday = new Date(
                        year,
                        monthIndex,
                        1
                    ).getDay();

                    const totalDays = Object.keys(days).length;

                    return (
                        <div key={month} className="border rounded p-2">
                            {/* Month title */}
                            <div className="text-center font-semibold text-xs mb-1">
                                {month}
                            </div>

                            {/* Day headers */}
                            <div className="grid grid-cols-7 text-[10px] text-center text-gray-500 mb-1">
                                {dayLabels.map((d, i) => (
                                    <div key={`${month}-day-${i}`}>{d}</div>
                                ))}
                            </div>

                            {/* Calendar grid */}
                            <div className="grid grid-cols-7 gap-1 text-[10px]">
                                {/* Leading empty cells */}
                                {Array.from({ length: firstDayWeekday }).map(
                                    (_, i) => (
                                        <div
                                            key={`${month}-empty-${i}`}
                                            className="h-10"
                                        />
                                    )
                                )}

                                {/* Actual days */}
                                {Array.from(
                                    { length: totalDays },
                                    (_, i) => {
                                        const day = i + 1;
                                        const cell = days[day];

                                        let bg = "bg-gray-100 text-gray-400";
                                        let label = "—";

                                        if (cell?.status === "present") {
                                            bg = "bg-green-100 text-green-700";
                                            label = "P";
                                        } else if (cell?.status === "absent") {
                                            bg = "bg-red-100 text-red-700";
                                            label = "A";
                                        } else if (cell?.status === "leave") {
                                            bg = "bg-yellow-100 text-yellow-700";
                                            label = "L";
                                        }

                                        return (
                                            <div
                                                key={`${month}-${day}`}
                                                className={`relative h-10 rounded ${bg} flex items-center justify-center`}
                                            >
                                                {/* Date number */}
                                                <div className="absolute top-0.5 right-1 text-[9px] opacity-60">
                                                    {day}
                                                </div>

                                                {/* Status */}
                                                <div className="font-semibold">
                                                    {label}
                                                </div>

                                                {/* Lesson learned */}
                                                {cell?.lesson_learned && (
                                                    <div className="absolute bottom-0.5 left-1 text-blue-700 font-bold">
                                                        ✓
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span><strong>P</strong> = Present</span>
                <span><strong>A</strong> = Absent</span>
                <span><strong>L</strong> = Leave</span>
                <span><strong>✓</strong> = Lesson Learned</span>
            </div>
        </div>
    );
}




function FilterBar({
    studentOptions,
    yearOptions,
    monthOptions,

    studentId,
    year,
    monthFrom,
    monthTo,

    setStudentId,
    setYear,
    setMonthFrom,
    setMonthTo,

    loading,
    buildReport,
    exportPdf,
    report,
}) {
    return (
        <div className="bg-white p-4 rounded border mb-4">
            <div className="flex flex-wrap gap-4 items-center">
                {/* STUDENT */}
                <MultiSelect
                    options={studentOptions}
                    value={studentId ? [studentId] : []}
                    placeholder="Select student"
                    onChange={ids => setStudentId(ids[0] ?? null)}
                    single
                />

                {/* YEAR */}
                <MultiSelect
                    options={yearOptions}
                    value={[year]}
                    placeholder="Year"
                    onChange={ids => {
                        setYear(ids[0]);
                        setMonthFrom(null);
                        setMonthTo(null);
                    }}
                    single
                />

                {/* FROM MONTH */}
                <MultiSelect
                    options={monthOptions}
                    value={monthFrom ? [monthFrom] : []}
                    placeholder="From month (optional)"
                    onChange={ids => setMonthFrom(ids[0] ?? null)}
                    single
                    disabled={!year}
                />

                {/* TO MONTH */}
                <MultiSelect
                    options={monthOptions}
                    value={monthTo ? [monthTo] : []}
                    placeholder="To month (optional)"
                    onChange={ids => setMonthTo(ids[0] ?? null)}
                    single
                    disabled={!year}
                />

                {/* BUILD */}
                <button
                    onClick={buildReport}
                    disabled={!studentId || !year || loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:bg-gray-400"
                >
                    {loading ? "Building…" : "Build Report"}
                </button>

                {/* PDF (OPTIONAL) */}
                <button
                    onClick={exportPdf}
                    disabled={!report}
                    className={`px-4 py-2 rounded text-sm border ${
                        report
                            ? "bg-white hover:bg-gray-50 text-gray-800"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                >
                    Export PDF
                </button>
            </div>
        </div>
    );
}

/* ===============================
   FEES SECTION
================================ */
function FeesSection({ title, fees }) {
    // HARD GUARD — prevents crashes
    if (!fees || !fees.summary) {
        return (
            <div className="bg-white border rounded p-4">
                <h3 className="text-sm font-semibold text-gray-700">
                    {title} Fees
                </h3>
                <div className="text-sm text-gray-400 mt-2">
                    No fee data available
                </div>
            </div>
        );
    }

    const { summary, rows } = fees;

    return (
        <div className="bg-white border rounded p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
                {title} Fees
            </h3>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 text-sm">
                <Stat label="Total" value={`Rs. ${summary.total}`} />
                <Stat label="Paid" value={`Rs. ${summary.paid}`} />
                <Stat label="Pending" value={`Rs. ${summary.pending}`} />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm border mt-2">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-2 text-left">Fee</th>
                            <th className="p-2 text-left">Month</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="p-3 text-center text-gray-400"
                                >
                                    No fee records
                                </td>
                            </tr>
                        )}

                        {rows.map((row, i) => (
                            <tr key={i} className="border-t">
                                <td className="p-2">{row.title}</td>
                                <td className="p-2">
                                    {row.month ?? "—"}
                                </td>
                                <td className="p-2 text-right">
                                    Rs. {row.amount}
                                </td>
                                <td
                                    className={`p-2 text-center font-semibold ${
                                        row.is_paid
                                            ? "text-green-600"
                                            : "text-red-600"
                                    }`}
                                >
                                    {row.is_paid ? "Paid" : "Unpaid"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

