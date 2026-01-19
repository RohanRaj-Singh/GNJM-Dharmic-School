import { Head, Link } from "@inertiajs/react";
import { useState } from "react";

export default function AdminLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Head
        title={title ? `${title} – GNJM Admin` : "GNJM Admin"}
      />

      {/* ================= Mobile Overlay ================= */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= Sidebar ================= */}
      <aside
        className={`
          fixed z-40 inset-y-0 left-0 w-64 bg-white border-r
          transform transition-transform duration-200
          md:static md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-4 border-b">
          <h1 className="text-xl font-semibold text-gray-800">
            GNJM
          </h1>
          <p className="text-sm text-gray-500">
            Admin Panel
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <SidebarLink href="/admin/dashboard" label="Dashboard" />
          <SidebarLink href="/admin/students" label="Students" />
          <SidebarLink href="/admin/classes" label="Classes" />
          <SidebarLink href="/admin/sections" label="Sections" />
          <SidebarLink href="/admin/attendance" label="Attendance" />
          <SidebarLink href="/admin/fees" label="Fees" />
          <SidebarLink href="/admin/reports" label="Reports" />
          <SidebarLink href="/admin/utilities" label="Utilities" />
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t text-xs text-gray-400">
          Guru Nanak Ji Mission Dharmic School
        </div>
      </aside>

      {/* ================= Main ================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="md:hidden text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>

            <h2 className="text-lg font-semibold text-gray-800">
              {title}
            </h2>
          </div>

          {/* Right side (future profile/logout) */}
          <div />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ---------------- Sidebar Link ---------------- */

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
