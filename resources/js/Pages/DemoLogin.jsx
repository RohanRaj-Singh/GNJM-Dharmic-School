import SimpleLayout from "@/Layouts/SimpleLayout";
import { router } from "@inertiajs/react";

export default function DemoLogin() {
  return (
    <SimpleLayout title="Demo Login">
      <div className="space-y-4">

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

      </div>
    </SimpleLayout>
  );
}

function DemoButton({ emoji, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl shadow p-5 flex items-center gap-4 active:scale-95 transition-transform"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-lg font-semibold text-gray-800">
        {label}
      </span>
    </button>
  );
}
