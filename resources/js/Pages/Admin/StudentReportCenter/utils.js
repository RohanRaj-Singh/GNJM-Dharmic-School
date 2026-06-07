/*
 * Shared formatting helpers for the Student Report Center.
 * Kept tiny and dependency-free so the same file can be reused by the
 * future PDF-rendering path if needed.
 */

export function formatPKR(amount) {
  const n = Number(amount || 0);
  return "Rs. " + n.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatPercent(value, decimals = 1) {
  const n = Number(value || 0);
  return n.toFixed(decimals) + "%";
}

export function monthShortLabel(year, month) {
  // 'Jan 2025'
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function monthLongLabel(year, month) {
  // 'January 2025'
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function statusLabel(status) {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusBgClass(status) {
  switch (status) {
    case "present": return "bg-green-100 text-green-700";
    case "absent":  return "bg-red-100 text-red-700";
    case "leave":   return "bg-yellow-100 text-yellow-700";
    default:        return "bg-gray-100 text-gray-400";
  }
}

export function statusShort(status) {
  if (status === "present") return "P";
  if (status === "absent")  return "A";
  if (status === "leave")   return "L";
  return "—";
}
