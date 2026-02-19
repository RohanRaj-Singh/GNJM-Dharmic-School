import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link, usePage } from "@inertiajs/react";
import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import useRoles from "@/Hooks/useRoles";

export default function Sections({ sections = [] }) {
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

    // Accountant filter (UI only)
    const [classFilter, setClassFilter] = useState("gurmukhi");
    const getClassObj = (section) => section?.school_class ?? section?.schoolClass ?? null;
    const classTypeToken = (cls) => {
        const typeText = String(cls?.type ?? "").trim().toLowerCase();
        const nameText = String(cls?.name ?? "").trim().toLowerCase();
        const hay = `${typeText} ${nameText}`.trim();
        if (!hay) return "";
        if (hay.includes("kirtan")) return "kirtan";
        if (hay.includes("gurmukhi")) return "gurmukhi";
        return "";
    };

    const visibleSections = useMemo(() => {
        if (!isAccountant) return sections;

        return sections.filter((s) => classTypeToken(getClassObj(s)) === classFilter);
    }, [sections, classFilter, isAccountant]);
    const isSunday = new Date().getDay() === 0;
    const canMarkToday = (section) => {
        const token = classTypeToken(getClassObj(section));
        if (token === "gurmukhi") {
            return !isSunday;
        }
        if (token === "kirtan") {
            return isSunday;
        }
        return true;
    };
    const dayRuleMessage = (section) => {
        const token = classTypeToken(getClassObj(section));
        if (token === "gurmukhi" && isSunday) {
            return "Gurmukhi attendance is closed on Sunday";
        }
        if (token === "kirtan" && !isSunday) {
            return "Kirtan attendance opens only on Sunday";
        }
        return "";
    };
    return (
        <SimpleLayout title="Select Section">
            {/* FILTER PILLS (ACCOUNTANT ONLY) */}
            {isAccountant && (
                <div className="flex gap-2 mb-4">
                    <PillButton
                        active={classFilter === "gurmukhi"}
                        onClick={() => setClassFilter("gurmukhi")}
                        color="blue"
                    >
                        Gurmukhi
                    </PillButton>

                    <PillButton
                        active={classFilter === "kirtan"}
                        onClick={() => setClassFilter("kirtan")}
                        color="purple"
                    >
                        Kirtan
                    </PillButton>
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

function PillButton({ active, onClick, color, children }) {
    const colors = {
        blue: active
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700",
        purple: active
            ? "bg-purple-600 text-white"
            : "bg-white text-gray-700",
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-1 rounded-full text-sm font-medium border transition ${colors[color]}`}
        >
            {children}
        </button>
    );
}
