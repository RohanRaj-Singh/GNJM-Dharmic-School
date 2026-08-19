import { Head, Link, router } from "@inertiajs/react";
import { useState, useCallback, useRef } from "react";
import SidebarGroup from "@/Components/SidebarGroup";
import Logo from "../../images/logo.png";
import LogoutModal from "@/Components/LogoutModal";

/**
 * AdminLayout - Main layout for admin dashboard
 *
 * Renders sidebar + header + content area, plus a LogoutModal that
 * confirms before sending POST /logout. Browser back-button is
 * delegated to the platform; in-page navigation is delegated to
 * Inertia (which already manages its own history stack).
 *
 * @param {string} title - Page title
 * @param {React.ReactNode} children - Page content
 */
export default function AdminLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const logoutButtonRef = useState(() => ({ current: null }))[0];

  const handleLogout = useCallback(() => {
    router.post("/logout", {}, {
      replace: true,
      preserveScroll: false,
      onSuccess: () => {
        window.location.replace("/");
      },
      onError: (error) => {
        console.error("Logout failed:", error);
      },
    });
  }, []);

  const openLogoutModal = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const closeLogoutModal = useCallback(() => {
    setShowLogoutModal(false);
    if (logoutButtonRef.current) {
      logoutButtonRef.current.focus();
    }
  }, [logoutButtonRef]);

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
          "fixed z-40 inset-y-0 left-0 w-auto bg-white border-r",
          "transform transition-all duration-200",
          "md:static md:translate-x-0",
          desktopSidebarCollapsed
            ? "md:w-0 md:overflow-hidden md:border-r-0"
            : "md:w-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="px-6 py-4 border-b">
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

        <nav className="flex-1 px-3 py-4 space-y-1">
          <SidebarLink href="/admin/dashboard" label="Dashboard" />
          <SidebarLink href="/admin/students" label="Students" />
          <SidebarLink href="/admin/classes" label="Classes" />
          <SidebarLink href="/admin/divisions" label="Divisions" />
          <SidebarLink href="/admin/sections" label="Sections" />
          <SidebarLink href="/admin/attendance" label="Attendance" />

          <SidebarGroup label="Fees Management">
            <SidebarSubLink href="/admin/fees/" label="Manage Fees" />
            <SidebarSubLink href="/admin/fees/custom" label="Fee Categories" />
          </SidebarGroup>

          <SidebarGroup label="Reports">
            <SidebarLink href="/admin/student-report-center" label="Student Center" />
            <SidebarSubLink href="/admin/reports/" label="Fees Report" />
            <SidebarSubLink href="/admin/reports/attendance" label="Attendance Report" />
          </SidebarGroup>

          <SidebarLink href="/admin/users" label="Users" />
          <SidebarLink href="/admin/utilities" label="Utilities" />
        </nav>

        <div className="px-4 py-3 border-t text-xs text-gray-400">
          <button
            ref={logoutButtonRef}
            onClick={openLogoutModal}
            className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-md p-1"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          </div>

          <div>
            <button
              className="hidden md:inline-flex items-center rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
            >
              {desktopSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={closeLogoutModal}
        title="Logout?"
        message="Are you sure you want to logout?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        closeButtonRef={logoutButtonRef}
      />
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
