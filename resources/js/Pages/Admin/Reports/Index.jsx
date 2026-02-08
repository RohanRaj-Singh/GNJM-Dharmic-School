import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import MultiSelect from "@/Components/MultiSelect";
import { formatPKR, formatMonth, generateMonthOptions } from "@/utils/helper";

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
   STAT CARD
================================ */
function Stat({ label, value }) {
    return (
        <div className="bg-white border rounded p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
        </div>
    );
}

export default function ReportsIndex() {
    /* ===============================
       STATE
    ================================ */
    const [filters, setFilters] = useState({
        class_ids: [],
        section_ids: [],
        student_ids: [],
        paid_status: ["paid", "unpaid"],
    });

    const [columns, setColumns] = useState([
        "student_name",
        "class_name",
        "section_name",
        "fee_title",
        "month",
        "amount",
        "is_paid",
    ]);

    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [byClass, setByClass] = useState([]);
    const [loading, setLoading] = useState(false);

    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [students, setStudents] = useState([]);

    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(null);

    /* ===============================
       OPTIONS (STABLE)
    ================================ */
    const classOptions = useMemo(
        () => classes.map((c) => ({ value: c.id, label: c.name })),
        [classes],
    );

    const sectionOptions = useMemo(
        () => sections.map((s) => ({ value: s.id, label: s.name })),
        [sections],
    );

    const studentOptions = useMemo(
        () => students.map((s) => ({ value: s.id, label: s.name })),
        [students],
    );

    const yearOptions = useMemo(() => {
        return Array.from({ length: 5 }, (_, i) => {
            const y = currentYear - 3 + i;
            return { value: y, label: String(y) };
        });
    }, [currentYear]);

    const monthOptions = useMemo(() => generateMonthOptions(year), [year]);

    /* ===============================
       LOAD OPTIONS
    ================================ */
    useEffect(() => {
        fetch("/admin/classes/options")
            .then((r) => r.json())
            .then(setClasses)
            .catch(() => setClasses([]));
    }, []);

    useEffect(() => {
        if (!filters.class_ids.length) {
            setSections([]);
            return;
        }

        const qs = filters.class_ids.map((id) => `class_ids[]=${id}`).join("&");

        fetch(`/admin/sections/options?${qs}`)
            .then((r) => r.json())
            .then(setSections)
            .catch(() => setSections([]));
    }, [filters.class_ids]);

    useEffect(() => {
        if (!filters.class_ids.length) {
            setStudents([]);
            return;
        }

        const qs = [
            ...filters.class_ids.map((id) => `class_ids[]=${id}`),
            ...filters.section_ids.map((id) => `section_ids[]=${id}`),
        ].join("&");

        fetch(`/admin/students/options?${qs}`)
            .then((r) => r.json())
            .then(setStudents)
            .catch(() => setStudents([]));
    }, [filters.class_ids, filters.section_ids]);

    /* ===============================
       BUILD REPORT
    ================================ */
    async function buildReport() {
        if (!filters.class_ids.length) return;

        setLoading(true);

        try {
            const res = await fetch("/admin/reports/build", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute("content"),
                },
                body: JSON.stringify({
                    report: "fees",
                    ...filters,
                    columns,
                    year,
                    month,
                }),
            });

            const json = await res.json();

            setSummary(json.summary ?? null);
            setByClass(json.breakdowns?.by_class ?? []);
            setRows(json.tables?.rows ?? []);
        } finally {
            setLoading(false);
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
            })),
        [columns],
    );

    const table = useReactTable({
        data: rows,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
    });

    const paidCount = rows.filter((r) => r.is_paid).length;
    const unpaidCount = rows.filter((r) => !r.is_paid).length;

    /* ===============================
       RENDER
    ================================ */
    return (
        <AdminLayout title="Reports">
            {/* FILTER BAR */}
            <div className="bg-white p-4 rounded border mb-4 space-y-4">
                <div className="flex flex-wrap gap-4">
                    <MultiSelect
                        options={classOptions}
                        value={filters.class_ids}
                        placeholder="Select class(es)"
                        onChange={(ids) =>
                            setFilters({
                                ...filters,
                                class_ids: ids,
                                section_ids: [],
                                student_ids: [],
                            })
                        }
                    />

                    <MultiSelect
                        options={yearOptions}
                        value={[year]}
                        placeholder="Select year"
                        onChange={(ids) => {
                            setYear(ids[0] ?? currentYear);
                            setMonth(null);
                        }}
                    />

                    <MultiSelect
                        options={monthOptions}
                        value={month ? [month] : []}
                        placeholder="Select month (optional)"
                        onChange={(ids) => setMonth(ids[0] ?? null)}
                    />

                    <MultiSelect
                        options={sectionOptions}
                        value={filters.section_ids}
                        placeholder="Select section(s)"
                        onChange={(ids) =>
                            setFilters({
                                ...filters,
                                section_ids: ids,
                                student_ids: [],
                            })
                        }
                    />

                    {/* <MultiSelect
                        options={studentOptions}
                        value={filters.student_ids}
                        placeholder="Select student(s)"
                        onChange={(ids) =>
                            setFilters({ ...filters, student_ids: ids })
                        }
                    /> */}

                    <button
                        onClick={buildReport}
                        disabled={!filters.class_ids.length || loading}
                        className="px-4 py-2 rounded text-sm text-white bg-blue-600 disabled:bg-gray-400"
                    >
                        {loading ? "Building…" : "Build Report"}
                    </button>

                    <button
    disabled={!rows.length}
    onClick={() => {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/admin/reports/export/csv";

        // CSRF
        const csrf = document.createElement("input");
        csrf.type = "hidden";
        csrf.name = "_token";
        csrf.value = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        form.appendChild(csrf);

        // payload
        const payload = {
            report: "fees",
            ...filters,
            columns,
            year,
            month,
        };

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
    }}
    className={`px-4 py-2 rounded text-sm font-medium border
        ${
            rows.length
                ? "bg-white hover:bg-gray-50 text-gray-800"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
>
    Export CSV
</button>

<button
    disabled={!rows.length}
    onClick={() => {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/admin/reports/export/pdf";

        const csrf = document.createElement("input");
        csrf.type = "hidden";
        csrf.name = "_token";
        csrf.value = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        form.appendChild(csrf);

        const payload = {
            report: "fees",
            ...filters,
            columns,
            year,
            month,
        };

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
    }}
    className={`px-4 py-2 rounded text-sm font-medium border
        ${
            rows.length
                ? "bg-white hover:bg-gray-50 text-gray-800"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
>
    Export PDF
</button>



                </div>
            </div>

            {/* SUMMARY */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <Stat
                        label="Total Fees"
                        value={formatPKR(summary.total_fees)}
                    />
                    <Stat
                        label="Collected"
                        value={formatPKR(summary.total_collected)}
                    />
                    <Stat
                        label="Pending"
                        value={formatPKR(summary.total_pending)}
                    />
                    <Stat
                        label="Collection %"
                        value={`${summary.collection_percentage}%`}
                    />
                </div>
            )}

            {/* PAID / UNPAID LISTS */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* PAID */}
                    <div className="bg-white border rounded">
                        <div className="px-4 py-3 border-b flex justify-between">
                            <span className="font-semibold text-green-700">
                                Paid Students
                            </span>
                            <span className="bg-green-600 text-white px-2 rounded">
                                {paidCount}
                            </span>
                        </div>

                        <ul className="divide-y text-sm max-h-96 overflow-y-auto">
                            {rows
                                .filter((r) => r.is_paid)
                                .map((r, i) => (
                                    <li
                                        key={i}
                                        className="px-4 py-3 flex justify-between"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {r.student_name}
                                            </div>
                                            {r.father_name && (
                                                <div className="text-xs text-gray-500">
                                                    Father: {r.father_name}
                                                </div>
                                            )}
                                            <div className="text-xs text-gray-500">
                                                {r.fee_title}
                                            </div>
                                        </div>
                                        <div className="text-green-700 font-medium">
                                            {formatPKR(r.amount)}
                                        </div>
                                    </li>
                                ))}
                        </ul>
                    </div>

                    {/* UNPAID */}
                    <div className="bg-white border rounded">
                        <div className="px-4 py-3 border-b flex justify-between">
                            <span className="font-semibold text-red-600">
                                Unpaid Students
                            </span>
                            <span className="bg-red-600 text-white px-2 rounded">
                                {unpaidCount}
                            </span>
                        </div>

                        <ul className="divide-y text-sm max-h-96 overflow-y-auto">
                            {rows
                                .filter((r) => !r.is_paid)
                                .map((r, i) => (
                                    <li
                                        key={i}
                                        className="px-4 py-3 flex justify-between"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {r.student_name}
                                            </div>
                                            {r.father_name && (
                                                <div className="text-xs text-gray-500">
                                                    Father: {r.father_name}
                                                </div>
                                            )}
                                            <div className="text-xs text-gray-500">
                                                {r.fee_title}
                                            </div>
                                        </div>
                                        <div className="text-red-600 font-medium">
                                            {formatPKR(r.amount)}
                                        </div>
                                    </li>
                                ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* DATA TABLE */}
            <div className="bg-white border rounded overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((h) => (
                                    <th
                                        key={h.id}
                                        className="px-3 py-2 text-left"
                                    >
                                        {flexRender(
                                            h.column.columnDef.header,
                                            h.getContext(),
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>

                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="border-b">
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-3 py-2">
                                        {cell.column.id === "student_name" ? (
                                            <div>
                                                <div className="font-medium">
                                                    {cell.getValue()}
                                                </div>
                                                {row.original.father_name && (
                                                    <div className="text-xs text-gray-500">
                                                        Father:{" "}
                                                        {
                                                            row.original
                                                                .father_name
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        ) : cell.column.id === "amount" ? (
                                            formatPKR(cell.getValue())
                                        ) : cell.column.id === "month" ? (
                                            formatMonth(cell.getValue())
                                        ) : cell.column.id === "is_paid" ? (
                                            cell.getValue() ? (
                                                <span className="text-green-700 font-medium">
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="text-red-600 font-medium">
                                                    Unpaid
                                                </span>
                                            )
                                        ) : (
                                            String(cell.getValue() ?? "")
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}

                        {!rows.length && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="p-6 text-center text-gray-500"
                                >
                                    No data
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
