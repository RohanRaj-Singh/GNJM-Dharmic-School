import SimpleLayout from "@/Layouts/SimpleLayout";
import AttendanceCard from "@/Components/AttendanceCard";
import useRoles from "@/Hooks/useRoles";
import { divisionMeta } from "@/utils/divisionType";

/**
 * Attendance front door.
 *
 * Routes here:
 *  - teacher:    see their assigned divisions + a per-division "Mark" tile.
 *  - accountant: see all divisions + Mark + View Absentees per tile.
 *  - admin:      same as accountant (admins can do everything).
 *
 * The `divisions` array is the distinct division keys shipped by the
 * backend (resolved through DivisionTypeResolver). The dashboard maps each
 * key through divisionMeta() to inherit the deterministic palette + title —
 * no JSX change needed to add a third+ class. See
 * docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §4.4 + §7.1.
 */
export default function Dashboard({ divisions = [] }) {
    const { isAccountant, isTeacher } = useRoles();

    return (
        <SimpleLayout title="Attendance" divisions={divisions}>
            <div className="space-y-4">

                {/* TEACHER VIEW: one tile per owned division, just a "Mark" link.
                    Teachers skip absentee review (their scope is already their
                    own sections), so we don't show "View Absentees" here. */}
                {isTeacher && divisions.length > 0 ? (
                    <>
                        {divisions.map((key) => {
                            const meta = divisionMeta(key);
                            return (
                                <AttendanceCard
                                    key={key}
                                    emoji="🕒"
                                    title={`Mark ${meta.title} Attendance`}
                                    subtitle={`Sections for ${meta.title}`}
                                    href="/attendance/sections"
                                />
                            );
                        })}
                    </>
                ) : null}

                {/* ACCOUNTANT (or admin) VIEW: a single-section picker to mark,
                    plus a direct link to the absentee review page. */}
                {isAccountant && !isTeacher ? (
                    <>
                        <AttendanceCard
                            emoji="📝"
                            title="Mark Attendance"
                            subtitle="Select section and mark daily attendance"
                            href="/attendance/sections"
                        />
                        <AttendanceCard
                            emoji="🚫"
                            title="Absentees"
                            subtitle="See who is absent across all sections"
                            href="/attendance/absentees"
                        />
                    </>
                ) : null}

                {/* FALLBACK (no role match or empty divisions): the legacy
                    single card keeps the page from rendering blank. */}
                {!isAccountant && !isTeacher && divisions.length === 0 ? (
                    <AttendanceCard
                        emoji="📝"
                        title="Mark Attendance"
                        subtitle="Select section and mark daily attendance"
                        href="/attendance/sections"
                    />
                ) : null}

            </div>
        </SimpleLayout>
    );
}