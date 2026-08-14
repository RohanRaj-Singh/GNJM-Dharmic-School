/**
 * Front-end helpers for the per-class attendance-day configuration (Stage B).
 *
 * Days are ISO day-of-week numbers (0 = Sunday .. 6 = Saturday), the same
 * convention the backend `classes.attendance_days` column uses. Serialized
 * school_class objects carry the *effective* resolved days under
 * `attendance_days_effective` (explicit config or the legacy Kirtan fallback),
 * so the UI never has to re-derive kirtan/gurmukhi from type/name.
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6]; // Monday–Saturday

/** True when `date` (a JS Date) falls on one of the class's attendance days. */
export function isAttendanceDay(days, date) {
  const list = Array.isArray(days) && days.length > 0 ? days : null;
  if (!list) return true; // unconfigured → no restriction
  return list.includes(date.getDay());
}

/** Human-readable label, e.g. "Monday–Saturday", "Sunday", "Wednesday, Sunday". */
export function attendanceDaysLabel(days) {
  const list = Array.isArray(days) && days.length > 0 ? days : DEFAULT_DAYS;
  const sorted = [...list].sort((a, b) => a - b);

  if (JSON.stringify(sorted) === JSON.stringify(DEFAULT_DAYS)) {
    return "Monday–Saturday";
  }

  return sorted.map((d) => DAY_NAMES[d] ?? d).join(", ");
}
