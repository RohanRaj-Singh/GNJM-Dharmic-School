import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useState } from "react";
import { formatPKR } from "@/utils/helper";

/* ===============================
   STAT CARD
================================ */
function StatCard({ label, value, sub, color = "text-gray-800" }) {
    return (
        <div className="bg-white border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-2xl font-semibold ${color}`}>
                {value}
            </div>
            {sub && (
                <div className="text-xs text-gray-400 mt-1">
                    {sub}
                </div>
            )}
        </div>
    );
}

/* ===============================
   DASHBOARD
================================ */
export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/admin/dashboard/summary")
            .then((r) => r.json())
            .then(setData)
            .finally(() => setLoading(false));
    }, []);

    return (
        <AdminLayout title="Dashboard">
            {loading && (
                <div className="bg-white border rounded p-6 text-gray-500">
                    Loading dashboard…
                </div>
            )}

            {!loading && data && (
                <div className="space-y-8">
                    {/* ===============================
                        FEES
                    ================================ */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-600 mb-3">
                            Fees Overview ({data.meta.year})
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <StatCard
                                label="Total Fees"
                                value={formatPKR(data.fees.total)}
                            />
                            <StatCard
                                label="Collected"
                                value={formatPKR(data.fees.collected)}
                                color="text-green-700"
                            />
                            <StatCard
                                label="Pending"
                                value={formatPKR(data.fees.pending)}
                                color="text-red-600"
                            />
                            <StatCard
                                label="Collection Rate"
                                value={`${data.fees.percentage}%`}
                                sub="Based on collected vs total"
                                color="text-blue-700"
                            />
                        </div>
                    </section>

                    {/* ===============================
                        ATTENDANCE
                    ================================ */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-600 mb-3">
                            Attendance Overview
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <StatCard
                                label="Attendance %"
                                value={`${data.attendance.percentage}%`}
                                color="text-green-700"
                            />
                            <StatCard
                                label="Present"
                                value={data.attendance.present}
                                color="text-green-600"
                            />
                            <StatCard
                                label="Absent"
                                value={data.attendance.absent}
                                color="text-red-600"
                            />
                            <StatCard
                                label="Leave"
                                value={data.attendance.leave}
                                color="text-yellow-600"
                            />
                        </div>
                    </section>

                    {/* ===============================
                        STUDENTS
                    ================================ */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-600 mb-3">
                            Students Snapshot
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard
                                label="Total Students"
                                value={data.students.total}
                            />
                            <StatCard
                                label="Active Students"
                                value={data.students.active}
                                color="text-green-700"
                            />
                            <StatCard
                                label="Total Enrollments"
                                value={data.students.enrollments}
                                sub="Student ↔ Class mappings"
                            />
                        </div>
                    </section>

                    {/* ===============================
                        FOOTER
                    ================================ */}
                    <div className="text-xs text-gray-400 text-right">
                        Last updated: {data.meta.generated_at}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
