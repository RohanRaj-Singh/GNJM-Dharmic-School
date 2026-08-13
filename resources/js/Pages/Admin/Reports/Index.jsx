import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState, useCallback } from "react";
import DataTable from "@/Components/DataTable";
import FeeFilterSelect from "@/Components/FeeFilterSelect";
import { formatPKR, formatMonth } from "@/utils/helper";

/* ===============================
   COLUMN OPTIONS
================================ */
const COLUMN_OPTIONS = [
    { key: "student_name", label: "Student Name" },
    { key: "father_name", label: "Father Name" },
    { key: "class_name", label: "Class" },
    { key: "section_name", label: "Section" },
    { key: "fee_title", label: "Fee Title" },
    { key: "month", label: "Month" },
    { key: "amount", label: "Amount" },
    { key: "is_paid", label: "Paid Status" },
];

/* ===============================
   CONSTANTS
================================ */
const MONTHS = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1; // 1-based

function yearOptions() {
    const opts = [];
    for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 1; y++) {
        opts.push({ value: y, label: String(y) });
    }
    return opts;
}

/* ===============================
   STAT CARD
================================ */
function Stat({ label, value, color }) {
    return (
        <div className="bg-white border rounded p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-lg font-semibold ${color || ""}`}>{value}</div>
        </div>
    );
}

/* ===============================
   PRESETS
================================ */
const PRESETS = [
    { key: "this_year", label: "This Year" },
    { key: "last_year", label: "Last Year" },
    { key: "last_12m", label: "Last 12 Months" },
    { key: "all", label: "All Time" },
];

/* ===============================
   MAIN COMPONENT
================================ */
export default function ReportsIndex() {
    /* ===============================
       FILTER STATE
    ================================ */
    const [classIds, setClassIds] = useState([]);
    const [sectionIds, setSectionIds] = useState([]);
    const [studentIds, setStudentIds] = useState([]);
    const [paidStatus, setPaidStatus] = useState(["paid", "unpaid"]);

    const [columns] = useState([
        "student_name",
        "class_name",
        "section_name",
        "fee_title",
        "month",
        "amount",
        "is_paid",
    ]);

    // Date range: from
    const [fromYear, setFromYear] = useState(CURRENT_YEAR);
    const [fromMonth, setFromMonth] = useState(null);

    // Date range: to
    const [toYear, setToYear] = useState(CURRENT_YEAR);
    const [toMonth, setToMonth] = useState(null);

    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [byClass, setByClass] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [students, setStudents] = useState([]);

    /* ===============================
       OPTIONS (with deduplication)
    ================================ */
    const classOptions = useMemo(
        () => {
            const seen = new Map();
            for (const c of classes) {
                if (!seen.has(c.id)) seen.set(c.id, { value: c.id, label: c.name });
            }
            return Array.from(seen.values());
        },
        [classes],
    );

    const sectionOptions = useMemo(
        () => sections.map((s) => ({ value: s.id, label: s.name })),
        [sections],
    );

    const studentOptions = useMemo(
        () => students.map((s) => ({
            value: s.id,
            label: s.father_name ? `${s.name} (Father: ${s.father_name})` : s.name,
        })),
        [students],
    );

    const yrs = useMemo(() => yearOptions(), []);

    /* ===============================
       LOAD OPTIONS
    ================================ */
    useEffect(() => {
        fetch("/admin/classes/options")
            .then((r) => r.json())
            .then((data) => {
                // Deduplicate by id
                const unique = data.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
                setClasses(unique);
                // Default: select all classes
                setClassIds(unique.map((c) => c.id));
            })
            .catch(() => setClasses([]));
    }, []);

    // Load sections when classes change
    useEffect(() => {
        if (!classIds.length) {
            setSections([]);
            setSectionIds([]);
            return;
        }

        const qs = classIds.map((id) => `class_ids[]=${id}`).join("&");
        fetch(`/admin/sections/options?${qs}`)
            .then((r) => r.json())
            .then((data) => {
                setSections(data);
                // Reset section selection when classes change
                setSectionIds([]);
            })
            .catch(() => {
                setSections([]);
                setSectionIds([]);
            });
    }, [classIds]);

    // Load students when classes change (sections filter is optional)
    useEffect(() => {
        if (!classIds.length) {
            setStudents([]);
            setStudentIds([]);
            return;
        }

        const params = new URLSearchParams();
        classIds.forEach((id) => params.append("class_ids[]", id));
        // Only add section_ids if any are actually selected
        sectionIds.forEach((id) => params.append("section_ids[]", id));

        fetch(`/admin/students/options?${params.toString()}`)
            .then((r) => r.json())
            .then(setStudents)
            .catch(() => setStudents([]));
    }, [classIds, sectionIds]);

    /* ===============================
       BUILD REPORT
    ================================ */
    const buildPayload = useCallback(() => {
        const payload = {
            report: "fees",
            class_ids: classIds,
            section_ids: sectionIds,
            student_ids: studentIds,
            paid_status: paidStatus,
            columns,
        };

        // Date range: year_from / year_to
        if (fromYear) payload.year_from = fromYear;
        if (toYear) payload.year_to = toYear;

        // Date range: month_from / month_to
        if (fromMonth) payload.month_from = `${fromYear}-${fromMonth}`;
        if (toMonth) payload.month_to = `${toYear}-${toMonth}`;

        return payload;
    }, [classIds, sectionIds, studentIds, paidStatus, columns, fromYear, fromMonth, toYear, toMonth]);

    async function buildReport() {
        if (!classIds.length) return;

        setLoading(true);
        setError(null);
        setRows([]);
        setSummary(null);
        setByClass([]);

        try {
            const res = await axios.post("/admin/reports/build",
                buildPayload(),
                { headers: { Accept: "application/json" } }
            );
            setSummary(res.data.summary ?? null);
            setByClass(res.data.breakdowns?.by_class ?? []);
            setRows(res.data.tables?.rows ?? []);
        } catch (err) {
            if (err.response?.status === 419) {
                setError("Session expired. Please refresh the page and try again.");
            } else if (err.response?.status === 422) {
                setError("Invalid filter values. Please check your selections.");
            } else {
                setError(err.response ? `Build failed: ${err.response.status}` : String(err));
            }
        } finally {
            setLoading(false);
        }
    }

    /* ===============================
       EXPORT (CSV / PDF)
    ================================ */
    function submitExport(action) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = action;

        const csrf = document.createElement("input");
        csrf.type = "hidden";
        csrf.name = "_token";
        csrf.value = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        form.appendChild(csrf);

        const payload = buildPayload();
        Object.entries(payload).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((v) => {
                    const input = document.createElement("input");
                    input.type = "hidden";
                    input.name = `${key}[]`;
                    input.value = v;
                    form.appendChild(input);
                });
            } else if (value !== null && value !== undefined) {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = key;
                input.value = value;
                form.appendChild(input);
            }
        });

        document.body.appendChild(form);
        form.submit();
        form.remove();
    }

    /* ===============================
       PRESETS
    ================================ */
    function applyPreset(key) {
        switch (key) {
            case "this_year":
                setFromYear(CURRENT_YEAR);
                setToYear(CURRENT_YEAR);
                setFromMonth(null);
                setToMonth(null);
                break;
            case "last_year":
                setFromYear(CURRENT_YEAR - 1);
                setToYear(CURRENT_YEAR - 1);
                setFromMonth(null);
                setToMonth(null);
                break;
            case "last_12m": {
                const d = new Date(CURRENT_YEAR, CURRENT_MONTH - 12, 1);
                setFromYear(d.getFullYear());
                setFromMonth(String(d.getMonth() + 1).padStart(2, "0"));
                setToYear(CURRENT_YEAR);
                setToMonth(String(CURRENT_MONTH).padStart(2, "0"));
                break;
            }
            case "all":
                setFromYear(CURRENT_YEAR - 3);
                setFromMonth(null);
                setToYear(CURRENT_YEAR + 1);
                setToMonth(null);
                break;
        }
    }

    /* ===============================
       TABLE
    ================================ */
    const tableColumns = useMemo(
        () =>
            columns.map((key) => ({
                accessorKey: key,
                header: COLUMN_OPTIONS.find((c) => c.key === key)?.label ?? key,
                cell: ({ row, getValue }) => {
                    if (key === "student_name") {
                        return (
                            <div>
                                <div className="font-medium">{getValue()}</div>
                                {row.original.father_name && (
                                    <div className="text-xs text-gray-500">Father: {row.original.father_name}</div>
                                )}
                            </div>
                        );
                    }
                    if (key === "amount") {
                        return formatPKR(getValue());
                    }
                    if (key === "month") {
                        return formatMonth(getValue());
                    }
                    if (key === "is_paid") {
                        return getValue() ? (
                            <span className="text-green-700 font-medium">Paid</span>
                        ) : (
                            <span className="text-red-600 font-medium">Unpaid</span>
                        );
                    }
                    return String(getValue() ?? "");
                },
            })),
        [columns],
    );

    const paidCount = rows.filter((r) => r.is_paid).length;
    const unpaidCount = rows.filter((r) => !r.is_paid).length;

    /* ===============================
       RENDER
    ================================ */
    return (
        <AdminLayout title="Fees Report">
            {/* FILTER BAR */}
            <div className="bg-white p-4 rounded border mb-4 space-y-3">
                {/* Row 1: Scope filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Class(es)</label>
                        <FeeFilterSelect
                            options={classOptions}
                            value={classIds}
                            placeholder="Select class(es)"
                            onChange={setClassIds}
                            width="min-w-[220px]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Section(s)</label>
                        <FeeFilterSelect
                            options={sectionOptions}
                            value={sectionIds}
                            placeholder="All sections"
                            onChange={setSectionIds}
                            disabled={!classIds.length}
                            width="min-w-[200px]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Student(s)</label>
                        <FeeFilterSelect
                            options={studentOptions}
                            value={studentIds}
                            placeholder="All students"
                            onChange={setStudentIds}
                            disabled={!classIds.length}
                            width="min-w-[200px]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <FeeFilterSelect
                            options={[
                                { value: "paid", label: "Paid" },
                                { value: "unpaid", label: "Unpaid" },
                            ]}
                            value={paidStatus}
                            placeholder="All"
                            onChange={(vals) => setPaidStatus(vals.length ? vals : ["paid", "unpaid"])}
                            width="min-w-[140px]"
                        />
                    </div>
                </div>

                {/* Row 2: Date range */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">From Year</label>
                        <FeeFilterSelect
                            options={yrs}
                            value={[fromYear]}
                            onChange={(ids) => setFromYear(ids[0] ?? CURRENT_YEAR)}
                            single
                            width="min-w-[120px]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">From Month</label>
                        <FeeFilterSelect
                            options={MONTHS.map((m) => ({ value: m.value, label: `${m.label} ${fromYear}` }))}
                            value={fromMonth ? [fromMonth] : []}
                            placeholder="All months"
                            onChange={(ids) => setFromMonth(ids[0] ?? null)}
                            single
                            width="min-w-[160px]"
                        />
                    </div>

                    <div className="text-xs text-gray-400 self-center pb-2">→</div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">To Year</label>
                        <FeeFilterSelect
                            options={yrs}
                            value={[toYear]}
                            onChange={(ids) => setToYear(ids[0] ?? CURRENT_YEAR)}
                            single
                            width="min-w-[120px]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">To Month</label>
                        <FeeFilterSelect
                            options={MONTHS.map((m) => ({ value: m.value, label: `${m.label} ${toYear}` }))}
                            value={toMonth ? [toMonth] : []}
                            placeholder="All months"
                            onChange={(ids) => setToMonth(ids[0] ?? null)}
                            single
                            width="min-w-[160px]"
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={buildReport}
                            disabled={!classIds.length || loading}
                            className="px-4 py-2 rounded text-sm text-white bg-blue-600 disabled:bg-gray-400"
                        >
                            {loading ? "Building…" : "Build Report"}
                        </button>

                        <button
                            disabled={!rows.length}
                            onClick={() => submitExport("/admin/reports/export/csv")}
                            className={`px-3 py-2 rounded text-sm font-medium border ${
                                rows.length
                                    ? "bg-white hover:bg-gray-50 text-gray-800"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            Export CSV
                        </button>

                        <button
                            disabled={!rows.length}
                            onClick={() => submitExport("/admin/reports/export/pdf")}
                            className={`px-3 py-2 rounded text-sm font-medium border ${
                                rows.length
                                    ? "bg-white hover:bg-gray-50 text-gray-800"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                            Export PDF
                        </button>
                    </div>
                </div>

                {/* Row 3: Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                    <span className="text-xs text-gray-500">Quick range:</span>
                    {PRESETS.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => applyPreset(p.key)}
                            className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-700"
                        >
                            {p.label}
                        </button>
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

            {/* SUMMARY */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <Stat label="Total Fees" value={formatPKR(summary.total_fees)} />
                    <Stat label="Collected" value={formatPKR(summary.total_collected)} color="text-green-700" />
                    <Stat
                        label="Pending"
                        value={formatPKR(summary.total_pending)}
                        color={summary.total_pending > 0 ? "text-red-600" : "text-gray-700"}
                    />
                    <Stat
                        label="Collection %"
                        value={`${summary.collection_percentage}%`}
                        color={summary.collection_percentage >= 75 ? "text-green-700" : summary.collection_percentage >= 50 ? "text-amber-600" : "text-red-600"}
                    />
                </div>
            )}

            {/* PAID / UNPAID LISTS */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white border rounded">
                        <div className="px-4 py-3 border-b flex justify-between">
                            <span className="font-semibold text-green-700">Paid</span>
                            <span className="bg-green-600 text-white px-2 rounded">{paidCount}</span>
                        </div>
                        <ul className="divide-y text-sm max-h-96 overflow-y-auto">
                            {rows.filter((r) => r.is_paid).map((r, i) => (
                                <li key={i} className="px-4 py-3 flex justify-between">
                                    <div>
                                        <div className="font-medium">{r.student_name}</div>
                                        {r.father_name && <div className="text-xs text-gray-500">Father: {r.father_name}</div>}
                                        <div className="text-xs text-gray-500">{r.fee_title}</div>
                                    </div>
                                    <div className="text-green-700 font-medium">{formatPKR(r.amount)}</div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white border rounded">
                        <div className="px-4 py-3 border-b flex justify-between">
                            <span className="font-semibold text-red-600">Unpaid</span>
                            <span className="bg-red-600 text-white px-2 rounded">{unpaidCount}</span>
                        </div>
                        <ul className="divide-y text-sm max-h-96 overflow-y-auto">
                            {rows.filter((r) => !r.is_paid).map((r, i) => (
                                <li key={i} className="px-4 py-3 flex justify-between">
                                    <div>
                                        <div className="font-medium">{r.student_name}</div>
                                        {r.father_name && <div className="text-xs text-gray-500">Father: {r.father_name}</div>}
                                        <div className="text-xs text-gray-500">{r.fee_title}</div>
                                    </div>
                                    <div className="text-red-600 font-medium">{formatPKR(r.amount)}</div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* DATA TABLE */}
            <DataTable
                data={rows}
                columns={tableColumns}
                emptyMessage="No data"
                emptyClassName="p-6 text-center text-gray-500"
                containerClassName="bg-white border rounded overflow-x-auto"
                tableClassName="min-w-full text-sm"
                theadClassName="bg-gray-50 border-b"
            />
        </AdminLayout>
    );
}
