import { useForm, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import Logo from "../../../images/logo.png";
import LogoutModal from "../../Components/LogoutModal";

export default function Login({ user, returnTo }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    login: "",
    password: "",
    remember: false,
  });

  const [showLoggedInModal, setShowLoggedInModal] = useState(false);

  useEffect(() => {
    if (user) {
      setShowLoggedInModal(true);
    }
  }, [user]);

  const getRedirectUrl = (role) => {
    const routes = {
      admin: "/admin/dashboard",
      accountant: "/accountant",
      teacher: "/teacher",
    };
    return routes[role] || "/";
  };

  const handleLogoutConfirm = () => {
    post("/logout", {
      onSuccess: () => {
        window.location.href = "/";
      },
    });
  };

  const handleLogoutCancel = () => {
    const redirectUrl = returnTo || getRedirectUrl(user?.role);
    window.location.href = redirectUrl;
  };

  function submit(e) {
    e.preventDefault();
    const targetUrl = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
    post(targetUrl, {
      onFinish: () => {
        if (!errors.login && !errors.password) {
          const redirectUrl = returnTo || getRedirectUrl(data.role || "accountant");
          window.location.href = redirectUrl;
        }
      }
    });
  }

  return (
    <>
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
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

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Password
            </label>
            <input
              type="password"
              value={data.password}
              onChange={(e) => setData("password", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? "Logging inâ€¦" : "Login"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6">
          Â© {new Date().getFullYear()} Guru Nanak Ji Mission
        </p>
      </div>

      <LogoutModal
        isOpen={showLoggedInModal}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
        title="Already Logged In"
        message={`You are currently logged in as ${user?.name || user?.username || "a user"}. Would you like to log out and log in as a different user?`}
        confirmLabel="Log Out"
        cancelLabel="Stay Logged In"
      />
    </>
  );
}
