import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";

export default function Dashboard() {
  return (
    <SimpleLayout title="Accountant">
      <div className="space-y-4">

        {/* <ActionCard
          href="/accountant/students/create"
          emoji="🧑‍🎓"
          title="Add Student"
          description="Register a new student"
        /> */}

        <ActionCard
          href="/accountant/students"
          emoji="📋"
          title="Students"
          description="View all students"
        />

        <ActionCard
          href="/accountant/attendance"
          emoji="🕒"
          title="Attendance"
          description="Check attendance records"
        />

        <ActionCard
          href="/accountant/late-fees"
          emoji="❗"
          title="Late Fees"
          description="See overdue payments"
          highlight
        />

        {/* <ActionCard
  href="/accountant/mark-attendance"
  emoji="📝"
  title="Mark Attendance"
  description="Mark daily attendance by section"
/> */}


      </div>
    </SimpleLayout>
  );
}

function ActionCard({ href, emoji, title, description, highlight }) {
  return (
    <Link
      href={href}
      className={`block rounded-xl shadow p-5 active:scale-95 transition-transform
        ${highlight ? "bg-red-50 border border-red-200" : "bg-white"}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>

        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {title}
          </h3>
          <p className="text-sm text-gray-500">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
