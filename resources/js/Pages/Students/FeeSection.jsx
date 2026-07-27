import RoleGate from "@/Components/RoleGate";
import useRoles from "@/Hooks/useRoles";
import { router } from "@inertiajs/react";

export default function FeeSection({ item, student }) {
    const { isTeacher } = useRoles();

    // 🚫 Teachers should not even see this section
    if (isTeacher) {
        return null;
    }

    const unpaidMonths = item.fees?.unpaid_months ?? [];
    const className = item.class || "";

    return (
        <div className="bg-white rounded-xl shadow p-5">
            <h3 className="text-md font-semibold text-gray-700 mb-2">
                {className} Fee Status
            </h3>

            {item.fees?.all_paid ? (
                <p className="text-green-600 text-sm">
                    ✔ All fees paid
                </p>
            ) : (
                <>
                    <ul className="text-red-600 text-sm space-y-1 mb-3">
                        {unpaidMonths.map((month, i) => (
                            <li key={i}>❌ {month}</li>
                        ))}
                    </ul>

                    {/* 🔒 Only Admin / Accountant can act */}
                    <RoleGate allow={["admin", "accountant"]}>
                        <button
                            onClick={() =>
                                router.get("/accountant/receive-fee", {
                                    student_id: student.id,
                                })
                            }
                            className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium"
                        >
                            Collect Fee
                        </button>
                    </RoleGate>
                </>
            )}
        </div>
    );
}
