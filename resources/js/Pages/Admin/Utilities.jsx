import AdminLayout from "@/Layouts/AdminLayout";

export default function Utilities() {
  return (
    <AdminLayout title="Utilities">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <UtilityCard
          emoji="📥"
          title="Bulk Student Upload"
          description="Upload students using Excel file"
        />

        <UtilityCard
          emoji="🧾"
          title="Bulk Student Edit"
          description="Edit multiple students in table view"
        />

        <UtilityCard
          emoji="🗂️"
          title="Data Cleanup"
          description="Fix or clean incorrect records"
        />

        <UtilityCard
          emoji="⚙️"
          title="System Settings"
          description="Basic system configurations"
        />

      </div>
    </AdminLayout>
  );
}

function UtilityCard({ emoji, title, description }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
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
}
