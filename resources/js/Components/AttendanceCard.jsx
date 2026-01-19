import { Link } from "@inertiajs/react";

export default function AttendanceCard({
  title,
  subtitle,
  href,
  emoji = "📝",
}) {
  return (
    <Link
      href={href}
      className="block bg-white border rounded-xl p-5 hover:bg-gray-50 transition"
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="text-3xl">
          {emoji}
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-800">
            {title}
          </p>

          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="text-gray-400 text-lg">
          →
        </div>
      </div>
    </Link>
  );
}
