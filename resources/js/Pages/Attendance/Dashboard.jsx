import SimpleLayout from "@/Layouts/SimpleLayout";
import AttendanceCard from "@/Components/AttendanceCard";
import useRoles from "@/Hooks/useRoles";

export default function Dashboard() {
  const { isAccountant } = useRoles();
  const sectionsHref = isAccountant ? "/accountant/attendance/sections" : "/attendance/sections";

  return (
    <SimpleLayout title="Attendance Dashboard">
      <div className="space-y-4">

        <AttendanceCard
          emoji="📝"
          title="Mark Attendance"
          subtitle="Select section and mark daily attendance"
          href={sectionsHref}
        />

      </div>
    </SimpleLayout>
  );
}
