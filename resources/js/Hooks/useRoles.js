import { usePage } from "@inertiajs/react";

export default function useRoles() {
    const { auth } = usePage().props;

    const role = auth?.user?.role ?? null;

    return {
        role,
        isAdmin: role === "admin",
        isAccountant: role === "accountant",
        isTeacher: role === "teacher",
    };
}
