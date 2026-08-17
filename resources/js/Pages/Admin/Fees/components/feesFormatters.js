/**
 * Formatters used by the admin fees page components.
 *
 * Kept fees-local because the format choices ("short" month, "2-digit day")
 * match the dense admin layout; the shared `utils/helper.js#formatMonth`
 * uses "long" month, which is wrong for inline labels in this page.
 *
 * Extracted from resources/js/Pages/Admin/Fees/Index.jsx:17-33 as part of
 * Phase 0 (pure extraction, no behavior change).
 */

export function formatMonthLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}-01`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function formatCollectionDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
