const COLORS = {
  active:     "bg-green-100 text-green-800",
  inactive:   "bg-amber-100 text-amber-800",
  passed_out: "bg-purple-100 text-purple-800",
  left:       "bg-gray-200 text-gray-700",
};

const LABELS = {
  active:     "Active",
  inactive:   "Inactive",
  passed_out: "Passed Out",
  left:       "Left",
};

export default function StatusBadge({ status, size = "sm" }) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span className={`rounded-full font-medium ${sizeClass} ${COLORS[status] || "bg-gray-100 text-gray-500"}`}>
      {LABELS[status] || status}
    </span>
  );
}
