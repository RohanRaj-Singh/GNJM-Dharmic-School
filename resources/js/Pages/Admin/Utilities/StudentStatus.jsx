import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

/*
|--------------------------------------------------------------------------
| Student Status Management (Enrollment-Level)
|--------------------------------------------------------------------------
| Admin-only utility page to activate / deactivate student enrollments
| (student_sections) in bulk.
|
| A student can be inactive in one class/section but active in another.
| Inactive enrollments are hidden from all active workflows (attendance,
| fees, reports, teacher screens, accountant screens).
|
| Features:
|  - Class filter (dropdown)
|  - Section filter (dropdown, populated when class is selected)
|  - Student search (name or father name)
|  - Status filter (All / Active / Inactive)
|  - Select all → bulk set active/inactive
*/

const STATUS_ALL = "all";
const STATUS_ACTIVE = "active";
const STATUS_INACTIVE = "inactive";

export default function StudentStatus() {
    const { flash } = usePage().props;

    /* Data */
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    /* Filters */
    const [classFilter, setClassFilter] = useState("");
    const [sectionFilter, setSectionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState(STATUS_ACTIVE);
    const [search, setSearch] = useState("");

    /* Selection */
    const [selectedIds, setSelectedIds] = useState(new Set());

    /* Load classes on mount */
    useEffect(() => {
        fetch("/admin/classes/options")
            .then((r) => r.json())
            .then((data) => {
                const unique = data.filter(
                    (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
                );
                setClasses(unique);
            })
            .catch(() => setClasses([]));
    }, []);

    /* Load sections when class changes */
    useEffect(() => {
        if (!classFilter) {
            setSections([]);
            setSectionFilter("");
            return;
        }

        fetch(`/admin/sections/options?class_id=${classFilter}`)
            .then((r) => r.json())
            .then((data) => {
                setSections(data);
                setSectionFilter("");
            })
            .catch(() => {
                setSections([]);
                setSectionFilter("");
            });
    }, [classFilter]);

    /* Load enrollments when filters change */
    useEffect(() => {
        setLoading(true);

        const params = new URLSearchParams();
        if (classFilter) params.append("class_id", classFilter);
        if (sectionFilter) params.append("section_id", sectionFilter);

        fetch(`/admin/utilities/student-status/data?${params.toString()}`)
            .then((r) => r.json())
            .then(setEnrollments)
            .catch(() => setEnrollments([]))
            .finally(() => {
                setLoading(false);
                setSelectedIds(new Set());
            });
    }, [classFilter, sectionFilter]);

    /* Flash success */
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash?.success]);

    /* Client-side filtering (status + search) */
    const filtered = useMemo(() => {
        let list = enrollments;

        if (statusFilter === STATUS_ACTIVE) {
            list = list.filter((e) => e.enrollment_status === "active");
        } else if (statusFilter === STATUS_INACTIVE) {
            list = list.filter((e) => e.enrollment_status === "inactive");
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (e) =>
                    e.student_name.toLowerCase().includes(q) ||
                    (e.father_name && e.father_name.toLowerCase().includes(q))
            );
        }

        return list;
    }, [enrollments, statusFilter, search]);

    /* Selection helpers */
    const toggleOne = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        setSelectedIds((prev) => {
            const visibleIds = new Set(filtered.map((e) => e.enrollment_id));
            const allSelected = filtered.every((e) =>
                prev.has(e.enrollment_id)
            );
            if (allSelected) {
                const next = new Set(prev);
                visibleIds.forEach((id) => next.delete(id));
                return next;
            } else {
                const next = new Set(prev);
                visibleIds.forEach((id) => next.add(id));
                return next;
            }
        });
    }, [filtered]);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    /* Bulk action */
    const setStatus = useCallback(
        (status) => {
            if (selectedIds.size === 0) return;
            setSaving(true);
            router.post(
                "/admin/utilities/student-status/bulk-update",
                {
                    enrollment_ids: Array.from(selectedIds),
                    status,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        clearSelection();
                        // Refresh enrollments
                        const params = new URLSearchParams();
                        if (classFilter)
                            params.append("class_id", classFilter);
                        if (sectionFilter)
                            params.append("section_id", sectionFilter);
                        fetch(
                            `/admin/utilities/student-status/data?${params.toString()}`
                        )
                            .then((r) => r.json())
                            .then(setEnrollments)
                            .catch(() => setEnrollments([]))
                            .finally(() => setSaving(false));
                    },
                    onError: () => setSaving(false),
                }
            );
        },
        [selectedIds, clearSelection, classFilter, sectionFilter]
    );

    const setInactive = useCallback(() => setStatus("inactive"), [setStatus]);
    const setActive = useCallback(() => setStatus("active"), [setStatus]);

    /* Stats */
    const stats = useMemo(() => {
        const active = enrollments.filter(
            (e) => e.enrollment_status === "active"
        ).length;
        const inactive = enrollments.filter(
            (e) => e.enrollment_status === "inactive"
        ).length;
        return { total: enrollments.length, active, inactive };
    }, [enrollments]);

    return (
        <AdminLayout title="Student Status">
            <div className="space-y-4">
                {/* Header + Stats */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">
                            Student Status
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Activate or deactivate student enrollments.
                            Inactive enrollments are hidden from attendance,
                            fees, and reports.
                        </p>
                    </div>

                    <div className="flex gap-3 text-sm">
                        <StatBadge label="Total" value={stats.total} />
                        <StatBadge
                            label="Active"
                            value={stats.active}
                            color="bg-green-100 text-green-800"
                        />
                        <StatBadge
                            label="Inactive"
                            value={stats.inactive}
                            color="bg-red-100 text-red-800"
                        />
                    </div>
                </div>

                {/* Filters bar */}
                <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
                    {/* Class filter */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
                            Class
                        </label>
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="border rounded px-3 py-1.5 text-sm min-w-[140px]"
                        >
                            <option value="">All Classes</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Section filter */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
                            Section
                        </label>
                        <select
                            value={sectionFilter}
                            onChange={(e) => setSectionFilter(e.target.value)}
                            disabled={!classFilter}
                            className="border rounded px-3 py-1.5 text-sm min-w-[160px] disabled:bg-gray-100"
                        >
                            <option value="">All Sections</option>
                            {sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status filter */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">
                            Status
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                clearSelection();
                            }}
                            className="border rounded px-3 py-1.5 text-sm min-w-[140px]"
                        >
                            <option value={STATUS_ALL}>All</option>
                            <option value={STATUS_ACTIVE}>Active</option>
                            <option value={STATUS_INACTIVE}>Inactive</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-gray-500 mb-1">
                            Search
                        </label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                clearSelection();
                            }}
                            placeholder="Student or father name…"
                            className="border rounded px-3 py-1.5 text-sm w-full"
                        />
                    </div>
                </div>

                {/* Bulk actions bar */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                        {filtered.length} enrollment(s) shown
                        {selectedIds.size > 0 &&
                            `, ${selectedIds.size} selected`}
                    </span>
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={setInactive}
                            disabled={saving || selectedIds.size === 0}
                            className="px-3 py-1.5 rounded text-sm bg-red-600 text-white disabled:bg-gray-300"
                        >
                            Set Inactive
                        </button>
                        <button
                            onClick={setActive}
                            disabled={saving || selectedIds.size === 0}
                            className="px-3 py-1.5 rounded text-sm bg-green-600 text-white disabled:bg-gray-300"
                        >
                            Set Active
                        </button>
                        <button
                            onClick={clearSelection}
                            disabled={selectedIds.size === 0}
                            className="px-3 py-1.5 rounded text-sm border bg-white disabled:text-gray-300"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            Loading…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No enrollments match the current filters.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 w-10">
                                        <input
                                            type="checkbox"
                                            checked={
                                                filtered.length > 0 &&
                                                filtered.every((e) =>
                                                    selectedIds.has(
                                                        e.enrollment_id
                                                    )
                                                )
                                            }
                                            onChange={toggleAll}
                                            className="w-4 h-4"
                                        />
                                    </th>
                                    <th className="px-4 py-2 text-left">
                                        Student Name
                                    </th>
                                    <th className="px-4 py-2 text-left">
                                        Father Name
                                    </th>
                                    <th className="px-4 py-2 text-left">
                                        Class
                                    </th>
                                    <th className="px-4 py-2 text-left">
                                        Section
                                    </th>
                                    <th className="px-4 py-2 text-left">
                                        Type
                                    </th>
                                    <th className="px-4 py-2 text-left">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((e) => (
                                    <tr
                                        key={e.enrollment_id}
                                        className={`${
                                            e.enrollment_status === "inactive"
                                                ? "bg-gray-50"
                                                : ""
                                        } hover:bg-blue-50`}
                                    >
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(
                                                    e.enrollment_id
                                                )}
                                                onChange={() =>
                                                    toggleOne(e.enrollment_id)
                                                }
                                                className="w-4 h-4"
                                            />
                                        </td>
                                        <td className="px-4 py-2 font-medium">
                                            {e.student_name}
                                        </td>
                                        <td className="px-4 py-2 text-gray-600">
                                            {e.father_name || "—"}
                                        </td>
                                        <td className="px-4 py-2">
                                            {e.class_name}
                                        </td>
                                        <td className="px-4 py-2">
                                            {e.section_name}
                                        </td>
                                        <td className="px-4 py-2 capitalize">
                                            {e.student_type}
                                        </td>
                                        <td className="px-4 py-2">
                                            <StatusBadge
                                                status={e.enrollment_status}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatBadge({ label, value, color = "bg-gray-100 text-gray-800" }) {
    return (
        <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}
        >
            {label}: {value}
        </span>
    );
}

function StatusBadge({ status }) {
    if (status === "inactive") {
        return (
            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 font-medium">
                Inactive
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 font-medium">
            Active
        </span>
    );
}
