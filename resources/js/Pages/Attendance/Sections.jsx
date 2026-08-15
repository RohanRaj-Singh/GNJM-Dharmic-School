import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link, usePage } from "@inertiajs/react";
import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import useRoles from "@/Hooks/useRoles";
import { division, divisionMeta } from "@/utils/divisionType";
import { isAttendanceDay, attendanceDaysLabel } from "@/utils/attendanceDays";

export default function Sections({ sections = [], divisions = [] }) {
    const { isAccountant } = useRoles();
    const { flash } = usePage().props;

    // 🔔 SHOW FLASH TOAST (ONCE)
    useEffect(() => {
        if (flash?.error) {
            toast.error(flash.error);
        }

        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    // Accountant filter (UI only). The default is the first division key
    // the backend ships — never a hardcoded string. A school with no
    // accountant (teacher-only) starts unfiltered.
    const initialFilter = isAccountant && divisions.length > 0 ? divisions[0] : "all";
    const [classFilter, setClassFilter] = useState(initialFilter);
    const getClassObj = (section) => section?.school_class ?? section?.schoolClass ?? null;

    const visibleSections = useMemo(() => {
        if (!isAccountant) return sections;
        if (classFilter === "all") return sections;

        return sections.filter((s) => {
            const cls = getClassObj(s);
            return division(cls?.type, cls?.name, cls?.division) === classFilter;
        });
    }, [sections, classFilter, isAccountant]);

    // Config-driven day rule (Stage B): a section is markable when today falls
    // on its class's effective attendance days. The serialized payload always
    // carries attendance_days_effective; if it's missing we FAIL CLOSED
    // (section is not markable today) rather than guessing Kirtan via
    // string-compare. See docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §4.1.
    const canMarkToday = (section) => {
        const cls = getClassObj(section);
        const days = cls?.attendance_days_effective;
        if (Array.isArray(days) && days.length > 0) {
            return isAttendanceDay(days, new Date());
        }
        return false;
    };

    const dayRuleMessage = (section) => {
        const cls = getClassObj(section);
        const days = cls?.attendance_days_effective;
        if (Array.isArray(days) && days.length > 0 && !isAttendanceDay(days, new Date())) {
            return `Attendance for ${cls?.name ?? "Class"} opens only on ${attendanceDaysLabel(days)}`;
        }
        // Fail-closed message when the backend didn't ship attendance_days_effective.
        if (!Array.isArray(days) || days.length === 0) {
            return `Attendance schedule for ${cls?.name ?? "this class"} is not configured`;
        }
        return "";
    };

    return (
        <SimpleLayout title="Select Section">
            {/* FILTER PILLS (ACCOUNTANT ONLY) — driven by `divisions` from the
                backend. No hardcoded Gurmukhi/Kirtan pair; a third+ division
                surfaces automatically. */}
            {isAccountant && divisions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {divisions.map((key) => {
                        const meta = divisionMeta(key);
                        return (
                            <PillButton
                                key={key}
                                active={classFilter === key}
                                onClick={() => setClassFilter(key)}
                                pillBg={meta.pillBg}
                                pillText={meta.pillText}
                            >
                                {meta.title}
                            </PillButton>
                        );
                    })}
                </div>
            )}

            {/* SECTIONS LIST */}
            <div className="space-y-3">
                {visibleSections.map((section) => {
                    const allowed = canMarkToday(section);
                    const message = dayRuleMessage(section);

                    if (!allowed) {
                        return (
                            <div
                                key={section.id}
                                className="block bg-gray-50 border border-gray-200 rounded-xl p-4 opacity-80 cursor-not-allowed"
                            >
                                <p className="font-semibold text-gray-700">
                                    {getClassObj(section)?.name ?? "Class"}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {section.name}
                                </p>
                                <p className="text-xs text-amber-700 mt-2">
                                    {message}
                                </p>
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={section.id}
                            href={`/attendance/sections/${section.id}`}
                            className="block bg-white border rounded-xl p-4 hover:bg-gray-50"
                        >
                            <p className="font-semibold text-gray-800">
                                {getClassObj(section)?.name ?? "Class"}
                            </p>
                            <p className="text-sm text-gray-500">
                                {section.name}
                            </p>
                        </Link>
                    );
                })}

                {visibleSections.length === 0 && (
                    <p className="text-center text-sm text-gray-400">
                        No sections found
                    </p>
                )}
            </div>
        </SimpleLayout>
    );
}

/* ================= UI ================= */

// PillButton now takes pillBg/pillText Tailwind classes from divisionMeta()
// instead of a hardcoded "blue"/"purple" enum. Active state inverts; inactive
// state uses the meta's neutral classes. See docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §4.1.
function PillButton({ active, onClick, pillBg, pillText, children }) {
    const base = "px-4 py-1 rounded-full text-sm font-medium border transition";

    if (active) {
        // Solid fill on active. We can't dynamically interpolate Tailwind
        // classes here, but divisionMeta() returns concrete classes Tailwind
        // can detect (LEGACY_META + PALETTE are static strings).
        return (
            <button onClick={onClick} className={`${base} ${pillBg} ${pillText} ring-2 ring-offset-1 ring-current`}>
                {children}
            </button>
        );
    }

    return (
        <button onClick={onClick} className={`${base} bg-white text-gray-700 border-gray-300 hover:bg-gray-50`}>
            {children}
        </button>
    );
}