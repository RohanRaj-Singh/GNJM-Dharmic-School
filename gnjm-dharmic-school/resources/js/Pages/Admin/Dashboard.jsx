import AdminLayout from "@/Layouts/AdminLayout";

export default function Dashboard() {
  return (
    <AdminLayout title="Dashboard">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-2">
          Welcome, Admin
        </h3>
        <p className="text-gray-600">
          GNJM Dharmic School administration panel
        </p>
      </div>
    </AdminLayout>
  );
}
