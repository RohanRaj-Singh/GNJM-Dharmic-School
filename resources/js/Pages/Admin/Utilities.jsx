import AdminLayout from "@/Layouts/AdminLayout";
import { Link } from "@inertiajs/react";

export default function Utilities() {
  return (
    <AdminLayout title="Utilities">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Admin Utilities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bulk operations, setup tools, and maintenance tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <UtilityCard
          emoji="📥"
          title="Bulk Student Upload"
          description="Upload students using Excel file"
        />

        <UtilityCard
          emoji="✏️"
          title="Bulk Student Edit"
          description="Edit multiple students in table view"
        />

        <UtilityCard
          emoji="🧮"
          title="Pending Fees Setup"
          description="Set assumed pending months for new enrollments"
          href="/admin/utilities/pending-fees"
        />

        <UtilityCard
          emoji="🔄"
          title="Student Status"
          description="Activate or deactivate enrollments in bulk"
          href="/admin/utilities/student-status"
        />

        <UtilityCard
          emoji="📈"
          title="Student Progression"
          description="Promote, repeat, pass out, or mark a student as left school"
          href="/admin/utilities/student-progression"
          badge="New"
        />

        <UtilityCard
          emoji="📖"
          title="Master Directory"
          description="Browse all students by lifecycle status — promoted, passed out, inactive, left"
          href="/admin/utilities/master-directory"
        />

        <UtilityCard
          emoji="💾"
          title="Database Backup & Restore"
          description="Create, download, and restore database backups safely"
          href="/admin/utilities/backup"
          badge="New"
        />

      </div>
    </AdminLayout>
  );
}

function UtilityCard({ emoji, title, description, href, badge }) {
  const content = (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition relative">
      {badge && (
        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-4">
        <span className="text-3xl">{emoji}</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {description}
          </p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
