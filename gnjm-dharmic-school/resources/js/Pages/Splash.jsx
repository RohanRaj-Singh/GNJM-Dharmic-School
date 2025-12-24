import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import Logo from "../../images/logo.png";

export default function Splash() {
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogin(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-screen bg-white flex flex-col items-center justify-center overflow-hidden">
      
      {/* Logo Section */}
      <div
        className={`flex flex-col items-center transition-all duration-700 ease-in-out
        ${showLogin ? "-translate-y-24" : "translate-y-0"}`}
      >
        <img
          src={Logo}
          alt="Guru Nanak Ji Mission Dharmic School"
          className="w-32 h-32 mb-3"
        />

        <h1 className="text-2xl font-bold text-gray-800">
          Guru Nanak Ji Mission
        </h1>
        <p className="text-gray-500">
          Dharmic School
        </p>
      </div>

      {/* Login Buttons */}
      <div
        className={`mt-12 w-full max-w-sm px-6 transition-all duration-700 ease-in-out
        ${showLogin ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      >
        <DemoButton
          emoji="🛠️"
          label="Login as Admin"
          onClick={() => router.visit("/admin/dashboard")}
        />

        <DemoButton
          emoji="💰"
          label="Login as Accountant"
          onClick={() => router.visit("/accountant")}
        />

        <DemoButton
          emoji="🕒"
          label="Login as Attendance"
          onClick={() => router.visit("/attendance")}
        />

        <p className="text-xs text-gray-400 text-center mt-4">
          This is temporary login
        </p>
      </div>
    </div>
  );
}

function DemoButton({ emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl shadow p-4 flex items-center gap-4 mb-3 active:scale-95 transition-transform"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-lg font-semibold text-gray-800">
        {label}
      </span>
    </button>
  );
}
