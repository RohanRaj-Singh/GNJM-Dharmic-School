import { useForm } from "@inertiajs/react";
import Logo from "../../images/logo.png";

export default function Splash() {
  const { data, setData, post, processing, errors } = useForm({
    login: "",
    password: "",
  });

  function submit(e) {
    e.preventDefault();
    post("/login", {
  onStart: () => {
    console.log("LOGIN: started");
  },
  onFinish: () => {
    console.log("LOGIN: finished");
  },
  onSuccess: () => {
    console.log("LOGIN: success");
  },
  onError: (errors) => {
    console.log("LOGIN: errors", errors);
  },
});

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
    </div>
  );
}
