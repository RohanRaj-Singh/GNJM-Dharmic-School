import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";
import { divisionMeta } from "@/utils/divisionType";

export default function Dashboard({ myDivisions = [] }) {
  // Tailor the action cards by what the teacher owns. A teacher who only
  // marks one division gets a division-tagged "Attendance" card. A multi-
  // division teacher keeps the generic card and relies on /attendance/sections
  // for the per-division flow. See
  // docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §3.1.
  const ownedCount = myDivisions.length;
  const onlyDivision = ownedCount === 1 ? myDivisions[0] : null;
  const onlyDivisionMeta = onlyDivision ? divisionMeta(onlyDivision) : null;

  return (
    <SimpleLayout title="Teacher" divisions={myDivisions}>
      <div className="space-y-4">

        <ActionCard
          href="/students"
          emoji="📋"
          title="Students"
          description="View all students"
        />

        <ActionCard
          href="/attendance/absentees"
          emoji="🚫"
          title="Absentees"
          description="See absent students"
        />

        {onlyDivisionMeta ? (
          <ActionCard
            href="/attendance/sections"
            emoji="🕒"
            title={`Attendance — ${onlyDivisionMeta.title}`}
            description={`Mark & view attendance for ${onlyDivisionMeta.title}`}
          />
        ) : (
          <ActionCard
            href="/attendance/sections"
            emoji="🕒"
            title="Attendance"
            description="Mark and view attendance"
          />
        )}

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
