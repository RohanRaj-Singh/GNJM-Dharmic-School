import SimpleLayout from "@/Layouts/SimpleLayout";
import useRoles from "@/Hooks/useRoles";
import FeeSection from "./FeeSection";
import { usePage } from "@inertiajs/react";

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

export default function StudentShow({ student, summary = [] }) {
    const { isTeacher, isAccountant, isAdmin } = useRoles();
    const { auth } = usePage().props;

    /* ================= RECENT DAYS (14) ================= */

    const days = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return d;
    });

    /* ================= FILTER SUMMARY ================= */

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

                {/* ================= STUDENT INFO ================= */}
                <div className="bg-white rounded-xl shadow p-5">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {student.name}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Father: {student.father_name}
                    </p>
                </div>

                {/* ================= CONTACT ================= */}
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

                {/* ================= ENROLLMENTS ================= */}
                {visibleSummary.map((item, index) => {
                    /* 🔒 SAFE RECENT MAP PER ITEM */
                    const recentMap = Object.fromEntries(
                        (item.attendance?.recent ?? []).map((r) => [
                            r.date,
                            r.status,
                        ])
                    );

                    return (
                        <div key={`${item.class}-${item.section}-${index}`} className="space-y-4">

                            {/* CLASS / SECTION */}
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

                            {/* ATTENDANCE SUMMARY */}
                            <div className="bg-white rounded-xl shadow p-5 space-y-2">
                                <h3 className="text-md font-semibold text-gray-700">
                                    Attendance Summary
                                </h3>

                                <StatRow
                                    label="Present"
                                    value={item.attendance.present}
                                    color="green"
                                />
                                <StatRow
                                    label="Absent"
                                    value={item.attendance.absent}
                                    color="red"
                                />
                                <StatRow
                                    label="Leave"
                                    value={item.attendance.leave}
                                    color="yellow"
                                />
                            </div>

                            {/* ================= MINI CALENDAR ================= */}
                            <div className="bg-white rounded-xl shadow p-5">
                                <h3 className="text-md font-semibold text-gray-700 mb-3">
                                    Recent Attendance
                                </h3>

                                <div className="grid grid-cols-7 gap-2 text-center text-xs">
                                    {days.map((day, i) => {
                                        const dateStr = day
                                            .toISOString()
                                            .slice(0, 10);

                                        const status =
                                            recentMap?.[dateStr];

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
                                                            ? `${dateStr} — ${status}`
                                                            : `${dateStr} — No record`
                                                    }
                                                />

                                                <span className="text-[10px] text-gray-400">
                                                    {day.getDate()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {Object.keys(recentMap).length === 0 && (
                                    <p className="text-sm text-gray-500 mt-3 text-center">
                                        No attendance marked recently
                                    </p>
                                )}
                            </div>

                            {/* ================= FEES ================= */}
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

                {/* EMPTY STATE */}
                {visibleSummary.length === 0 && (
                    <div className="text-center text-gray-400 text-sm">
                        No accessible records
                    </div>
                )}
            </div>
        </SimpleLayout>
    );
}

/* =========================================================
   UI HELPERS
========================================================= */

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

/* =========================================================
   CONTACT HELPERS
========================================================= */

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
                        📞 Call
                    </a>

                    {waNumber ? (
                        <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs"
                        >
                            💬 WhatsApp
                        </a>
                    ) : (
                        <span className="px-3 py-1 rounded-lg bg-gray-200 text-gray-500 text-xs">
                            💬 WhatsApp
                        </span>
                    )}
                </div>
            ) : (
                <span className="text-gray-400 italic">Not added</span>
            )}
        </div>
    );
}
