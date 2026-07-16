import AdminLayout from "@/Layouts/AdminLayout";
import { router, usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/Components/StatusBadge";

const STATUS_ALL = "all";
const STATUS_ACTIVE = "active";
const STATUS_INACTIVE = "inactive";
const STATUS_PROMOTED = "promoted";
const STATUS_PASSED_OUT = "passed_out";
const STATUS_LEFT = "left";

export default function StudentStatus() {
    const { flash } = usePage().props;

    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [classFilter, setClassFilter] = useState("");
    const [sectionFilter, setSectionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState(STATUS_ACTIVE);
    const [search, setSearch] = useState("");

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leftConfirmed, setLeftConfirmed] = useState(false);
    const [leaveDone, setLeaveDone] = useState(false);

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

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
    }, [flash?.success]);

    const filtered = useMemo(() => {
        let list = enrollments;
        if (statusFilter === STATUS_ACTIVE) {
            list = list.filter((e) => e.enrollment_status === "active");
        } else if (statusFilter === STATUS_INACTIVE) {
            list = list.filter((e) => e.enrollment_status === "inactive");
        } else if (statusFilter === STATUS_PROMOTED) {
            list = list.filter((e) => e.enrollment_status === "promoted");
        } else if (statusFilter === STATUS_PASSED_OUT) {
            list = list.filter((e) => e.enrollment_status === "passed_out");
        } else if (statusFilter === STATUS_LEFT) {
            list = list.filter((e) => e.enrollment_status === "left");
        } else if (statusFilter === STATUS_ALL) {
            list = list.filter((e) => e.enrollment_status !== "active");
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
            const allSelected = filtered.every((e) => prev.has(e.enrollment_id));
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

    const selectionHasOnlyInactive = useMemo(
        () =>
            selectedIds.size > 0 &&
            Array.from(selectedIds).every((id) => {
                const enrollment = enrollments.find((e) => e.enrollment_id === id);
                return enrollment && enrollment.enrollment_status === "inactive";
            }),
        [selectedIds, enrollments]
    );

    const setStatus = useCallback(
        (status) => {
            if (selectedIds.size === 0) return;
            setSaving(true);
            router.post(
                "/admin/utilities/student-status/bulk-update",
                { enrollment_ids: Array.from(selectedIds), status },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        clearSelection();
                        const params = new URLSearchParams();
                        if (classFilter) params.append("class_id", classFilter);
                        if (sectionFilter) params.append("section_id", sectionFilter);
                        fetch(`/admin/utilities/student-status/data?${params.toString()}`)
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

    const openLeaveModal = useCallback(() => {
        setShowLeaveModal(true);
        setLeftConfirmed(false);
        setLeaveDone(false);
    }, []);

    const handleLeaveConfirm = useCallback(() => {
        setLeaveDone(true);
    }, []);

    const closeLeaveModal = useCallback(() => {
        setShowLeaveModal(false);
        setLeftConfirmed(false);
        setLeaveDone(false);
        clearSelection();
    }, [clearSelection]);

    const stats = useMemo(() => {
        const active = enrollments.filter((e) => e.enrollment_status === "active").length;
        const inactive = enrollments.filter((e) => e.enrollment_status === "inactive").length;
        const promoted = enrollments.filter((e) => e.enrollment_status === "promoted").length;
        const passed_out = enrollments.filter((e) => e.enrollment_status === "passed_out").length;
        const left = enrollments.filter((e) => e.enrollment_status === "left").length;
        return { total: enrollments.length, active, inactive, promoted, passed_out, left };
    }, [enrollments]);

    return (
        <AdminLayout title="Student Status">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">Student Status</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage enrollment statuses. Inactive is temporary. Left is permanent.
                        </p>
                    </div>
                    <div className="flex gap-3 text-sm">
                        <StatBadge label="Total" value={stats.total} />
                        <StatBadge label="Active" value={stats.active} color="bg-green-100 text-green-800" />
                        <StatBadge label="Inactive" value={stats.inactive} color="bg-amber-100 text-amber-800" />
                        <StatBadge label="Completed" value={stats.promoted} color="bg-blue-100 text-blue-800" />
                        <StatBadge label="Passed Out" value={stats.passed_out} color="bg-purple-100 text-purple-800" />
                        <StatBadge label="Left" value={stats.left} color="bg-gray-200 text-gray-700" />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Class</label>
                        <select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="border rounded px-3 py-1.5 text-sm min-w-[140px]"
                        >
                            <option value="">All Classes</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Section</label>
                        <select
                            value={sectionFilter}
                            onChange={(e) => setSectionFilter(e.target.value)}
                            disabled={!classFilter}
                            className="border rounded px-3 py-1.5 text-sm min-w-[160px] disabled:bg-gray-100"
                        >
                            <option value="">All Sections</option>
                            {sections.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); clearSelection(); }}
                            className="border rounded px-3 py-1.5 text-sm min-w-[140px]"
                        >
                            <option value={STATUS_ALL}>All</option>
                            <option value={STATUS_ACTIVE}>Active</option>
                            <option value={STATUS_INACTIVE}>Inactive</option>
                            <option value={STATUS_PROMOTED}>Completed</option>
                            <option value={STATUS_PASSED_OUT}>Passed Out</option>
                            <option value={STATUS_LEFT}>Left</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs text-gray-500 mb-1">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); clearSelection(); }}
                            placeholder="Student or father name..."
                            className="border rounded px-3 py-1.5 text-sm w-full"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                        {filtered.length} enrollment(s) shown
                        {selectedIds.size > 0 && `, ${selectedIds.size} selected`}
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
                            onClick={openLeaveModal}
                            disabled={saving || !selectionHasOnlyInactive}
                            className="px-3 py-1.5 rounded text-sm bg-gray-700 text-white disabled:bg-gray-300"
                            title={!selectionHasOnlyInactive && selectedIds.size > 0 ? "Only inactive enrollments can be marked as Left" : ""}
                        >
                            Mark as Left
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

                {selectedIds.size > 0 && !selectionHasOnlyInactive && statusFilter !== STATUS_LEFT && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                        To mark as <strong>Left</strong>, first set the enrollment to <strong>Inactive</strong>. 
                        Left is permanent — unlike inactive, it cannot be reversed.
                    </div>
                )}

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No enrollments match the current filters.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-2 w-10">
                                        <input
                                            type="checkbox"
                                            checked={filtered.length > 0 && filtered.every((e) => selectedIds.has(e.enrollment_id))}
                                            onChange={toggleAll}
                                            className="w-4 h-4"
                                        />
                                    </th>
                                    <th className="px-4 py-2 text-left">Student Name</th>
                                    <th className="px-4 py-2 text-left">Father Name</th>
                                    <th className="px-4 py-2 text-left">Class</th>
                                    <th className="px-4 py-2 text-left">Section</th>
                                    <th className="px-4 py-2 text-left">Type</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((e) => (
                                    <tr
                                        key={e.enrollment_id}
                                        className={`${
                                            e.enrollment_status !== "active"
                                                ? "bg-gray-50"
                                                : ""
                                        } hover:bg-blue-50`}
                                    >
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(e.enrollment_id)}
                                                onChange={() => toggleOne(e.enrollment_id)}
                                                className="w-4 h-4"
                                            />
                                        </td>
                                        <td className="px-4 py-2 font-medium">{e.student_name}</td>
                                        <td className="px-4 py-2 text-gray-600">{e.father_name || "—"}</td>
                                        <td className="px-4 py-2">{e.class_name}</td>
                                        <td className="px-4 py-2">{e.section_name}</td>
                                        <td className="px-4 py-2 capitalize">{e.student_type}</td>
                                        <td className="px-4 py-2"><StatusBadge status={e.enrollment_status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showLeaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeLeaveModal}>
                    <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl w-full" onClick={(e) => e.stopPropagation()}>
                        {leaveDone ? (
                            <div className="text-center space-y-4">
                                <div className="text-5xl">📋</div>
                                <h2 className="text-lg font-semibold text-gray-800">Status Updated</h2>
                                <p className="text-sm text-gray-500">
                                    <strong>{selectedIds.size}</strong> enrollment(s) marked as <strong>Left</strong>.
                                </p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 text-left space-y-1">
                                    <p>✓ Enrollments closed permanently</p>
                                    <p>✓ All historical data preserved</p>
                                    <p>✓ Outstanding fees remain collectible</p>
                                    <p className="font-medium mt-1">This action cannot be undone.</p>
                                </div>
                                <button
                                    onClick={closeLeaveModal}
                                    className="px-5 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-800">Mark as Left</h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        This is a <strong>permanent action</strong>. Unlike inactive, Left cannot be reversed.
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg border divide-y text-sm">
                                    <div className="flex items-center gap-3 px-3 py-2">
                                        <span className="text-base">📋</span>
                                        <span className="text-gray-500 min-w-[80px]">Action</span>
                                        <span className="font-medium text-gray-800">Mark as Left</span>
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2">
                                        <span className="text-base">👤</span>
                                        <span className="text-gray-500 min-w-[80px]">Students</span>
                                        <span className="font-medium text-gray-800">{selectedIds.size} enrollment(s)</span>
                                    </div>
                                </div>

                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
                                    <p className="font-medium">What happens when an enrollment is marked as Left?</p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        <li>The enrollment is permanently closed</li>
                                        <li>The student cannot be re-enrolled under this enrollment</li>
                                        <li>No future attendance or fees will be generated</li>
                                        <li><strong>All historical data is preserved</strong></li>
                                        <li>Outstanding fees remain collectible</li>
                                    </ul>
                                </div>

                                <div className="flex items-start gap-3 pt-1">
                                    <input
                                        type="checkbox"
                                        id="leftConfirm"
                                        checked={leftConfirmed}
                                        onChange={(e) => setLeftConfirmed(e.target.checked)}
                                        className="mt-1 w-4 h-4"
                                    />
                                    <label htmlFor="leftConfirm" className="text-sm text-gray-700">
                                        I understand this is a <strong>permanent action</strong> for <strong>{selectedIds.size}</strong> enrollment(s) and cannot be undone.
                                    </label>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={closeLeaveModal}
                                        className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-white border hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleLeaveConfirm}
                                        disabled={!leftConfirmed}
                                        className="px-6 py-2 rounded text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

function StatBadge({ label, value, color = "bg-gray-100 text-gray-800" }) {
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
            {label}: {value}
        </span>
    );
}


