import AdminLayout from "@/Layouts/AdminLayout";
import DivisionLegend from "@/Components/DivisionLegend";
import { useState } from "react";

/*
 * Sprint 6.4 / L-1 — Admin division settings (read-only diagnostic).
 *
 * Lists every division the resolver surfaces with its business-rule
 * summary (attendance days, charges-monthly-fee toggle, default monthly
 * fee) and operational counts (classes, sections, students). Pure read —
 * no editing. Pinned by tests/Feature/AdminDivisionsPageTest.php.
 *
 * The page is data-driven: a third+ division (Music, Tabla, …) surfaces
 * automatically with no code change here. The palette colors come from
 * the same `divisionMeta()` utility the rest of the admin uses.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDays(days) {
  if (!Array.isArray(days) || days.length === 0) return "—";
  return days
    .slice()
    .sort()
    .map((d) => DAY_NAMES[d] ?? `Day ${d}`)
    .join(", ");
}

function formatFeeRange(min, max) {
  if (min === max) return `Rs. ${min}`;
  return `Rs. ${min} – ${max}`;
}

function StatPill({ label, value, tone = "bg-slate-600" }) {
  return (
    <div className="bg-white border rounded-lg px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`h-2 w-2 rounded-full ${tone}`} />
      </div>
      <p className="text-lg font-semibold text-slate-800 mt-1">{value}</p>
    </div>
  );
}

function DivisionCard({ division }) {
  return (
    <div
      data-testid={`division-card-${division.key}`}
      className="border rounded-xl bg-white overflow-hidden"
    >
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{division.title}</h3>
          <p className="text-xs text-slate-500">
            Key: <span className="font-mono">{division.key}</span>
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            division.charges_monthly_fee
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}
        >
          {division.charges_monthly_fee ? "Charges monthly fee" : "No monthly fee"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatPill label="Classes" value={division.classes_count} tone="bg-blue-600" />
          <StatPill label="Sections" value={division.sections_count} tone="bg-slate-600" />
          <StatPill label="Students" value={division.students_count} tone="bg-amber-500" />
          <StatPill label="Free" value={division.free_students_count} tone="bg-emerald-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="border rounded-lg px-3 py-2 bg-slate-50/50">
            <p className="text-xs uppercase text-slate-500 mb-1">Attendance Days</p>
            <p className="font-medium text-slate-800">{formatDays(division.attendance_days)}</p>
          </div>
          <div className="border rounded-lg px-3 py-2 bg-slate-50/50">
            <p className="text-xs uppercase text-slate-500 mb-1">Default Monthly Fee</p>
            <p className="font-medium text-slate-800">
              {formatFeeRange(division.default_monthly_fee_min, division.default_monthly_fee_max)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500 mb-1">
            Classes in this division ({division.classes.length})
          </p>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-white border-b text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Class</th>
                  <th className="text-left px-3 py-2">Attendance Days</th>
                  <th className="text-left px-3 py-2">Default Fee</th>
                  <th className="text-left px-3 py-2">Charges Fees?</th>
                  <th className="text-left px-3 py-2">Sections</th>
                  <th className="text-left px-3 py-2">Students</th>
                </tr>
              </thead>
              <tbody>
                {division.classes.map((cls) => (
                  <tr key={cls.id} className="border-b">
                    <td className="px-3 py-2 font-medium text-slate-800">{cls.name}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDays(cls.attendance_days)}</td>
                    <td className="px-3 py-2">Rs. {cls.default_monthly_fee}</td>
                    <td className="px-3 py-2">{cls.charges_monthly_fee ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">{cls.sections_count}</td>
                    <td className="px-3 py-2">
                      {cls.students_count}
                      {cls.free_students_count > 0 ? (
                        <span className="text-xs text-slate-500">
                          {" "}
                          (Free: {cls.free_students_count})
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {division.classes.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={6}>
                      No classes in this division.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DivisionsIndex({ divisions = [] }) {
  const [search, setSearch] = useState("");

  const filtered = divisions.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      d.key.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      (d.classes ?? []).some((c) => c.name.toLowerCase().includes(q))
    );
  });

  return (
    <AdminLayout title="Divisions">
      <div className="space-y-4">
        <div className="bg-white border rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Division Settings</h1>
            <p className="text-sm text-slate-500">
              Every division the resolver surfaces, with its business-rule
              summary and operational counts. Read-only.
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search division or class…"
            className="border rounded-md px-3 py-1.5 text-sm w-64"
          />
        </div>

        {/* L-3 — palette legend at the top of the page so admins know
            which color maps to which division. */}
        <div className="bg-white border rounded-xl px-4 py-3">
          <DivisionLegend divisions={divisions.map((d) => ({ key: d.key, title: d.title }))} />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border rounded-xl p-6 text-sm text-slate-500">
            No divisions match that filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((d) => (
              <DivisionCard key={d.key} division={d} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}