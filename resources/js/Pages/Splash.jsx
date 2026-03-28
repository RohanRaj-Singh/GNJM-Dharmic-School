import { useForm } from "@inertiajs/react";
import { useState, useEffect } from "react";
import Logo from "../../images/logo.png";
import LogoutModal from "@/Components/LogoutModal";

/**
 * Splash - Login page component
 * 
 * If user is already logged in, shows a modal asking if they want to:
 * - Logout and login as different user
 * - Stay on current session
 */
export default function Splash({ user }) {
  const { data, setData, post, processing, errors } = useForm({
    login: "",
    password: "",
    remember: false,
  });

  const [showSwitchAccountModal, setShowSwitchAccountModal] = useState(false);

  // If user is already logged in, show modal to switch accounts
  useEffect(() => {
    if (user) {
      setShowSwitchAccountModal(true);
    }
  }, [user]);

  const handleLogoutAndSwitch = async () => {
    try {
      // Post to logout
      await window.axios.post('/logout');
      // Reload to show fresh login
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
      // Force reload anyway
      window.location.reload();
    }
  };

  const handleStayOnCurrentSession = () => {
    // Redirect to user's dashboard based on role
    const routes = {
      admin: '/admin/dashboard',
      accountant: '/accountant',
      teacher: '/teacher',
    };
    window.location.href = routes[user?.role] || '/';
  };

  function submit(e) {
    e.preventDefault();
    post("/login");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src={Logo}
          alt="Guru Nanak Ji Mission Dharmic School"
          className="w-28 h-28 mx-auto mb-3"
        />
        <h1 className="text-2xl font-bold text-gray-800">
          Guru Nanak Ji Mission
        </h1>
        <p className="text-gray-500 text-sm">
          Dharmic School Management
        </p>
      </div>

      {/* Login Card */}
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border rounded-xl shadow p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-gray-800 text-center">
          Login
        </h2>

        {(errors.auth || errors.login) && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errors.auth || errors.login}
          </div>
        )}

        {/* Username / Email */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Username or Email
          </label>
          <input
            type="text"
            value={data.login}
            onChange={(e) => setData("login", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
            placeholder="username or email"
          />
          {errors.login && (
            <p className="text-xs text-red-600 mt-1">
              {errors.login}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Password
          </label>
          <input
            type="password"
            value={data.password}
            onChange={(e) => setData("password", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-xs text-red-600 mt-1">
              {errors.password}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={data.remember}
            onChange={(e) => setData("remember", e.target.checked)}
          />
          Remember me
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={processing}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? "Logging in…" : "Login"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-xs text-gray-400 mt-6">
        © {new Date().getFullYear()} Guru Nanak Ji Mission
      </p>

      {/* Modal for logged-in user trying to access login page */}
      <LogoutModal
        isOpen={showSwitchAccountModal}
        onConfirm={handleLogoutAndSwitch}
        onCancel={handleStayOnCurrentSession}
        title="Already Logged In"
        message={`You are currently logged in as ${user?.name || 'a user'}. Do you want to logout and login as a different user?`}
        confirmLabel="Logout & Switch"
        cancelLabel="Stay Logged In"
        preventBackButton={false}
      />
    </div>
  );
}
