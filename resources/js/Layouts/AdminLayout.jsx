import { Head, Link, router } from "@inertiajs/react";
import { useState } from "react";
import SidebarGroup from "@/Components/SidebarGroup";
import Logo from "../../images/logo.png";

export default function AdminLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Head title={title ? `${title} - GNJM Admin` : "GNJM Admin"} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed z-40 inset-y-0 left-0 w-72 bg-white border-r",
          "transform transition-all duration-200",
          "md:static md:translate-x-0",
          desktopSidebarCollapsed
            ? "md:w-0 md:min-w-0 md:overflow-hidden md:border-r-0"
            : "md:w-72 md:min-w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="px-6 py-4 border-b min-w-[240px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <img src={Logo} alt="GNJM Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-semibold text-gray-800">GNJM</h1>
              <p className="text-sm text-gray-500">Admin Panel</p>
            </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 min-w-[240px]">
          <SidebarLink href="/admin/dashboard" label="Dashboard" />
          <SidebarLink href="/admin/students" label="Students" />
          <SidebarLink href="/admin/classes" label="Classes" />
          <SidebarLink href="/admin/sections" label="Sections" />
          <SidebarLink href="/admin/attendance" label="Attendance" />

          <SidebarGroup label="Fees Management">
            <SidebarSubLink href="/admin/fees/" label="Manage Fees" />
            <SidebarSubLink href="/admin/fees/custom" label="Fee Categories" />
          </SidebarGroup>

          <SidebarGroup label="Reports">
            <SidebarLink href="/admin/reports/" label="Fees Report" />
            <SidebarLink href="/admin/reports/attendance" label="Attendance Report" />
            <SidebarLink href="/admin/reports/student" label="Student Report" />
          </SidebarGroup>

          <SidebarLink href="/admin/users" label="Users" />
          <SidebarLink href="/admin/utilities" label="Utilities" />
        </nav>

        <div className="px-4 py-3 border-t text-xs text-gray-400 min-w-[240px]">
          <button
            onClick={() => router.post("/logout")}
            className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-sm"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              Menu
            </button>

            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          </div>

          <div>
            <button
              className="hidden md:inline-flex items-center rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
            >
              {desktopSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
    >
      {label}
    </Link>
  );
}

function SidebarSubLink({ href, label }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100 transition"
    >
      {label}
    </Link>
  );
}
