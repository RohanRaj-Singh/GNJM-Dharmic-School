import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState, useCallback } from "react";
import FeeFilterSelect from "@/Components/FeeFilterSelect";
import { formatPKR } from "@/utils/helper";

/*
|--------------------------------------------------------------------------
| Attendance Report
|--------------------------------------------------------------------------
| Per-student summary over a flexible date range, with top absentees.
| Replaces the old per-day calendar grid.
*/

const MONTHS = [
    { value: "01", label: "January" },   { value: "02", label: "February" },
    { value: "03", label: "March" },      { value: "04", label: "April" },
    { value: "05", label: "May" },        { value: "06", label: "June" },
    { value: "07", label: "July" },       { value: "08", label: "August" },
    { value: "09", label: "September" },  { value: "10", label: "October" },
    { value: "11", label: "November" },   { value: "12", label: "December" },
];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

function yearOptions(from = CURRENT_YEAR - 3, to = CURRENT_YEAR + 1) {
    const opts = [];
    for (let y = from; y <= to; y++) opts.push({ value: y, label: String(y) });
    return opts;
}

const PRESETS = [
    { key: "this_year", label: "This Year" },
    { key: "last_year", label: "Last Year" },
    { key: "last_12m",  label: "Last 12 Months" },
    { key: "all",       label: "All Time" },
];

function Stat({ label, value, color }) {
    return (
        <div className="bg-white border rounded p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-lg font-semibold ${color || ""}`}>{value}</div>
        </div>
    );
}

export default function AttendanceReport() {
    /* ===============================
       FILTER STATE
    ================================ */
    const [classIds, setClassIds]       = useState([]);
    const [sectionIds, setSectionIds]   = useState([]);
    const [studentIds, setStudentIds]   = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);

    const [fromYear, setFromYear]       = useState(CURRENT_YEAR);
    const [fromMonth, setFromMonth]     = useState(null);
    const [toYear, setToYear]           = useState(CURRENT_YEAR);
    const [toMonth, setToMonth]         = useState(null);

    const [report, setReport]           = useState(null);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState(null);

    /* Data */
    const [classes, setClasses]         = useState([]);
    const [sections, setSections]       = useState([]);
    const [students, setStudents]       = useState([]);

    const yrs = useMemo(() => yearOptions(), []);

    /* Load classes */
    useEffect(() => {
        fetch("/admin/classes/options")
            .then((r) => r.json()).then((data) => {
                const unique = data.filter((c,i,a) => a.findIndex(x => x.id === c.id) === i);
                setClasses(unique);
                setClassIds(unique.map((c) => c.id));
            })
            .catch(() => setClasses([]));
    }, []);

    /* Load sections */
    useEffect(() => {
        if (!classIds.length) { setSections([]); setSectionIds([]); return; }
        const qs = classIds.map((id) => `class_ids[]=${id}`).join("&");
        fetch(`/admin/sections/options?${qs}`)
            .then((r) => r.json()).then(setSections)
            .catch(() => setSections([]));
    }, [classIds]);

    /* Load students */
    useEffect(() => {
        if (!classIds.length) { setStudents([]); setStudentIds([]); return; }
        const params = new URLSearchParams();
        classIds.forEach((id) => params.append("class_ids[]", id));
        sectionIds.forEach((id) => params.append("section_ids[]", id));
        fetch(`/admin/students/options?${params.toString()}`)
            .then((r) => r.json()).then(setStudents)
            .catch(() => setStudents([]));
    }, [classIds, sectionIds]);

    /* Build payload */
    const buildPayload = useCallback(() => {
        const p = {
            report: "attendance",
            class_ids: classIds,
            section_ids: sectionIds,
            student_ids: studentIds,
            status: statusFilter,
        };
        if (fromYear) p.year_from = fromYear;
        if (toYear)   p.year_to   = toYear;
        if (fromMonth) p.month_from = `${fromYear}-${fromMonth}`;
        if (toMonth)   p.month_to   = `${toYear}-${toMonth}`;
        return p;
    }, [classIds, sectionIds, studentIds, statusFilter, fromYear, fromMonth, toYear, toMonth]);

    /* Build */
    async function buildReport() {
        if (!classIds.length) return;
        setError(null);
        setLoading(true);
        setReport(null);
        try {
            const res = await axios.post("/admin/reports/build",
                buildPayload(),
                { headers: { Accept: "application/json" } }
            );
            setReport(res.data);
        } catch (err) {
            if (err.response?.status === 419) {
                setError("Session expired. Please refresh the page and try again.");
            } else if (err.response?.status === 422) {
                setError("Invalid filter values. Please check your selections.");
            } else {
                setError(err.response ? `Build failed: ${err.response.status}` : String(err));
            }
        } finally { setLoading(false); }
    }

    /* Export PDF */
    function exportPdf() {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/admin/reports/export/pdf";
        const csrf = document.createElement("input");
        csrf.type = "hidden"; csrf.name = "_token";
        csrf.value = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        form.appendChild(csrf);
        const payload = buildPayload();
        Object.entries(payload).forEach(([k, v]) => {
            if (Array.isArray(v)) { v.forEach((x) => { const i = document.createElement("input"); i.type = "hidden"; i.name = `${k}[]`; i.value = x; form.appendChild(i); }); }
            else if (v != null) { const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = v; form.appendChild(i); }
        });
        document.body.appendChild(form); form.submit(); form.remove();
    }

    /* Presets */
    function applyPreset(key) {
        switch (key) {
            case "this_year":    setFromYear(CURRENT_YEAR); setToYear(CURRENT_YEAR); setFromMonth(null); setToMonth(null); break;
            case "last_year":    setFromYear(CURRENT_YEAR-1); setToYear(CURRENT_YEAR-1); setFromMonth(null); setToMonth(null); break;
            case "last_12m": {
                const d = new Date(CURRENT_YEAR, CURRENT_MONTH-12, 1);
                setFromYear(d.getFullYear()); setFromMonth(String(d.getMonth()+1).padStart(2,"0"));
                setToYear(CURRENT_YEAR); setToMonth(String(CURRENT_MONTH).padStart(2,"0"));
                break;
            }
            case "all":          setFromYear(CURRENT_YEAR-3); setFromMonth(null); setToYear(CURRENT_YEAR+1); setToMonth(null); break;
        }
    }

    /* ===============================
       DERIVED
    ================================ */
    const summary   = report?.summary ?? null;
    const studentsList = report?.students ?? [];
    const topAbsentees = report?.top_absentees ?? [];

    return (
        <AdminLayout title="Attendance Report">
            {/* FILTERS */}
            <div className="bg-white p-4 rounded border mb-4 space-y-3">
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Class(es)</label>
                        <FeeFilterSelect options={classes.map(c=>({value:c.id,label:c.name}))} value={classIds} onChange={setClassIds} width="min-w-[220px]" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Section(s)</label>
                        <FeeFilterSelect options={sections.map(s=>({value:s.id,label:s.name}))} value={sectionIds} onChange={setSectionIds} disabled={!classIds.length} width="min-w-[200px]" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Student(s)</label>
                        <FeeFilterSelect options={students.map(s=>({value:s.id,label: s.father_name ? `${s.name} (Father: ${s.father_name})` : s.name}))} value={studentIds} onChange={setStudentIds} disabled={!classIds.length} width="min-w-[200px]" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <FeeFilterSelect options={[{value:"present",label:"Present"},{value:"absent",label:"Absent"},{value:"leave",label:"Leave"}]} value={statusFilter} onChange={setStatusFilter} width="min-w-[140px]" />
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">From Year</label>
                        <FeeFilterSelect options={yrs} value={[fromYear]} onChange={ids => setFromYear(ids[0]??CURRENT_YEAR)} single width="min-w-[120px]" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">From Month</label>
                        <FeeFilterSelect options={MONTHS.map(m=>({value:m.value,label:`${m.label} ${fromYear}`}))} value={fromMonth?[fromMonth]:[]} placeholder="All months" onChange={ids=>setFromMonth(ids[0]??null)} single width="min-w-[160px]" />
                    </div>
                    <div className="text-xs text-gray-400 self-center pb-2">→</div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">To Year</label>
                        <FeeFilterSelect options={yrs} value={[toYear]} onChange={ids=>setToYear(ids[0]??CURRENT_YEAR)} single width="min-w-[120px]" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">To Month</label>
                        <FeeFilterSelect options={MONTHS.map(m=>({value:m.value,label:`${m.label} ${toYear}`}))} value={toMonth?[toMonth]:[]} placeholder="All months" onChange={ids=>setToMonth(ids[0]??null)} single width="min-w-[160px]" />
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <button onClick={buildReport} disabled={!classIds.length||loading} className="px-4 py-2 rounded text-sm text-white bg-blue-600 disabled:bg-gray-400">{loading ? "Building…" : "Build Report"}</button>
                        <button onClick={exportPdf} disabled={!studentsList.length} className={`px-3 py-2 rounded text-sm font-medium border ${studentsList.length ? "bg-white hover:bg-gray-50 text-gray-800" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>Export PDF</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    <span className="text-xs text-gray-500">Quick range:</span>
                    {PRESETS.map(p => (
                        <button key={p.key} onClick={()=>applyPreset(p.key)} className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-700">{p.label}</button>
                    ))}
                </div>
            </div>

            {/* ERROR */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
                    {error}
                    {error.includes("Session expired") && (
                        <button
                            onClick={() => window.location.reload()}
                            className="ml-2 underline font-medium"
                        >
                            Refresh page
                        </button>
                    )}
                </div>
            )}

            {/* SUMMARY CARDS */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <Stat label="Students" value={summary.student_count} />
                    <Stat label="Present" value={summary.present} color="text-green-700" />
                    <Stat label="Absent" value={summary.absent} color={summary.absent > 0 ? "text-red-600" : "text-gray-700"} />
                    <Stat label="Leave" value={summary.leave} />
                    <Stat label="Attendance %" value={`${summary.attendance_percentage}%`}
                        color={summary.attendance_percentage >= 85 ? "text-green-700" : summary.attendance_percentage >= 70 ? "text-amber-600" : "text-red-600"} />
                    <Stat label="Calendar Days" value={`${summary.total_days} days (${summary.total_months} mo)`} />
                    <Stat label="Working Days" value={summary.working_days} color="text-blue-700" />
                    <Stat label="Total Records" value={summary.total_records} />
                </div>
            )}

            {/* PER-STUDENT TABLE */}
            {studentsList.length > 0 && (
                <div className="bg-white border rounded overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-2 text-left">Student</th>
                                <th className="px-4 py-2 text-left">Father</th>
                                <th className="px-4 py-2 text-left">Class</th>
                                <th className="px-4 py-2 text-left">Section</th>
                                <th className="px-4 py-2 text-right">Present</th>
                                <th className="px-4 py-2 text-right">Absent</th>
                                <th className="px-4 py-2 text-right">Leave</th>
                                <th className="px-4 py-2 text-right">Marked</th>
                                <th className="px-4 py-2 text-center">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {studentsList.map((s) => (
                                <tr key={s.student_id} className="hover:bg-blue-50">
                                    <td className="px-4 py-2 font-medium">{s.student_name}</td>
                                    <td className="px-4 py-2 text-gray-600">{s.father_name || "—"}</td>
                                    <td className="px-4 py-2">{s.class_name}</td>
                                    <td className="px-4 py-2">{s.section_name}</td>
                                    <td className="px-4 py-2 text-right text-green-700 font-medium">{s.present}</td>
                                    <td className={`px-4 py-2 text-right font-medium ${s.absent > 0 ? "text-red-600" : "text-gray-600"}`}>{s.absent}</td>
                                    <td className="px-4 py-2 text-right">{s.leave}</td>
                                    <td className="px-4 py-2 text-right text-gray-600">{s.total}</td>
                                    <td className={`px-4 py-2 text-center font-semibold ${
                                        s.percentage >= 85 ? "text-green-700" : s.percentage >= 70 ? "text-amber-600" : "text-red-600"
                                    }`}>
                                        {s.percentage}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TOP ABSENTEES */}
            {topAbsentees.length > 0 && (
                <div className="bg-white border rounded">
                    <div className="px-4 py-3 border-b bg-red-50">
                        <h3 className="font-semibold text-red-800">Top Absentees</h3>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left w-10">#</th>
                                <th className="px-4 py-2 text-left">Student</th>
                                <th className="px-4 py-2 text-left">Father</th>
                                <th className="px-4 py-2 text-left">Class</th>
                                <th className="px-4 py-2 text-left">Section</th>
                                <th className="px-4 py-2 text-right">Absent Days</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {topAbsentees.map((s, i) => (
                                <tr key={s.student_id} className="hover:bg-red-50">
                                    <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                                    <td className="px-4 py-2 font-medium">{s.student_name}</td>
                                    <td className="px-4 py-2 text-gray-600">{s.father_name || "—"}</td>
                                    <td className="px-4 py-2">{s.class_name}</td>
                                    <td className="px-4 py-2">{s.section_name}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-red-600">{s.absent}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* EMPTY */}
            {!loading && !report && (
                <div className="bg-white border rounded p-6 text-center text-sm text-gray-400">
                    Select classes and a date range, then click <b>Build Report</b>.
                </div>
            )}
        </AdminLayout>
    );
}
