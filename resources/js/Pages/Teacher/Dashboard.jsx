import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";

export default function Dashboard() {
  return (
    <SimpleLayout title="Teacher">
      <div className="space-y-4">


      <ActionCard
          href="/students"
          emoji="📋"
          title="Students"
          description="View all students"
        />
        <ActionCard
            href="/attendance/absentees"
            emoji="❌"
            title="Absentees"
            description="See absent students"
        />
        <ActionCard
          href="/attendance"
          emoji="🕒"
          title="Attendance"
          description="Mark and view attendance"
        />

      </div>
    </SimpleLayout>
  );
}

function ActionCard({ href, emoji, title, description }) {
  return (
    <Link
      href={href}
      className="block rounded-xl shadow p-5 bg-white active:scale-95 transition-transform"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </Link>
  );
}
