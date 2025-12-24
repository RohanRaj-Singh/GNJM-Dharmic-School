import { Head, Link } from "@inertiajs/react";

export default function AdminLayout({ title, children }) {
  return (
    <div className="min-h-screen flex bg-gray-100">
      <Head title={title} />

      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md hidden md:block">
        <div className="px-6 py-4 border-b">
          <h1 className="text-xl font-semibold text-gray-800">
            GNJM
          </h1>
          <p className="text-sm text-gray-500">
            Admin Panel
          </p>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          <SidebarLink href="/admin/dashboard" label="Dashboard" />
          <SidebarLink href="#" label="Classes" />
          <SidebarLink href="#" label="Sections" />
          <SidebarLink href="#" label="Students" />
          <SidebarLink href="#" label="Attendance" />
          <SidebarLink href="#" label="Fees" />
          <SidebarLink href="#" label="Reports" />
          <SidebarLink href="/admin/utilities" label="Utilities" />
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        {/* Top bar */}
        <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-800">
            {title}
          </h2>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
    >
      {label}
    </Link>
  );
}
