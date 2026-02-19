import SimpleLayout from "@/Layouts/SimpleLayout";
import AttendanceCard from "@/Components/AttendanceCard";

export default function Dashboard() {
  return (
    <SimpleLayout title="Attendance Dashboard">
      <div className="space-y-4">

        <AttendanceCard
          emoji="📝"
          title="Mark Attendance"
          subtitle="Select section and mark daily attendance"
          href="/attendance/sections"
        />

      </div>
    </SimpleLayout>
  );
}
