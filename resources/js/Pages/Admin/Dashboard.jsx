import AdminLayout from "@/Layouts/AdminLayout";
import { formatPKR } from "@/utils/helper";
import { useEffect, useMemo, useState } from "react";

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function classLabel(cls) {
  const name = String(cls?.name ?? "").trim();
  return name.length ? name : `Class #${num(cls?.id)}`;
}

function StatTile({ label, value, sub, accent = "bg-slate-700" }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      </div>
      <p className="text-xl font-semibold text-slate-800">{value}</p>
      {sub ? <p className="text-xs text-slate-500 mt-1">{sub}</p> : null}
    </div>
  );
}

function Meter({ label, value, total, tone = "bg-blue-600", suffix = "" }) {
  const safeValue = num(value);
  const safeTotal = num(total);
  const pct =
    safeTotal > 0 ? Math.max(0, Math.min(100, Math.round((safeValue / safeTotal) * 100))) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [divisionType, setDivisionType] = useState("gurmukhi");
  const [classId, setClassId] = useState("all");
  const [sectionId, setSectionId] = useState("all");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/admin/dashboard/summary?year=${year}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error("Failed to load dashboard summary");
        }
        return r.json();
      })
      .then((payload) => {
        setData(payload);
        if (!(payload?.divisions ?? []).some((d) => d.type === divisionType)) {
          setDivisionType(payload?.divisions?.[0]?.type ?? "gurmukhi");
        }
      })
      .catch((err) => {
        setError(err.message || "Unable to load dashboard data");
      })
      .finally(() => setLoading(false));
  }, [year]);

  const activeDivision = useMemo(
    () => (data?.divisions ?? []).find((d) => d.type === divisionType) ?? null,
    [data, divisionType]
  );

  const activeClass = useMemo(() => {
    if (!activeDivision) return null;
    if (classId === "all") return null;
    return activeDivision.classes.find((c) => String(c.id) === String(classId)) ?? null;
  }, [activeDivision, classId]);

  const sectionRows = activeClass ? activeClass.sections : [];
  const visibleSectionRows =
    sectionId === "all"
      ? sectionRows
      : sectionRows.filter((s) => String(s.id) === String(sectionId));

  useEffect(() => {
    if (!activeDivision) {
      setClassId("all");
      setSectionId("all");
      return;
    }

    if (
      classId !== "all" &&
      !activeDivision.classes.some((c) => String(c.id) === String(classId))
    ) {
      setClassId("all");
      setSectionId("all");
    }
  }, [activeDivision, classId]);

  useEffect(() => {
    if (!activeClass) {
      setSectionId("all");
      return;
    }

    if (
      sectionId !== "all" &&
      !activeClass.sections.some((s) => String(s.id) === String(sectionId))
    ) {
      setSectionId("all");
    }
  }, [activeClass, sectionId]);

  const filteredAbsentees = useMemo(() => {
    const rows = data?.insights?.top_absentees ?? [];
    return rows
      .filter((row) => row.division_type === divisionType)
      .filter((row) => classId === "all" || String(row.class_id) === String(classId))
      .filter((row) => sectionId === "all" || String(row.section_id) === String(sectionId))
      .sort((a, b) => num(b.absent_days) - num(a.absent_days));
  }, [data, divisionType, classId, sectionId]);

  const filteredPendingFees = useMemo(() => {
    const rows = data?.insights?.top_pending_fees ?? [];
    return rows
      .filter((row) => row.division_type === divisionType)
      .filter((row) => classId === "all" || String(row.class_id) === String(classId))
      .filter((row) => sectionId === "all" || String(row.section_id) === String(sectionId))
      .sort((a, b) => num(b.pending_amount) - num(a.pending_amount));
  }, [data, divisionType, classId, sectionId]);

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-4">
        <div className="bg-white border rounded-xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">School Admin Dashboard</h1>
              <p className="text-sm text-slate-500">
                Fees, attendance and division performance in one operational view.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase text-slate-500">Year</span>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-sm"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border rounded-xl p-6 text-sm text-slate-500">Loading dashboard...</div>
        ) : null}

        {!loading && error ? (
          <div className="bg-white border rounded-xl p-6 text-sm text-rose-600">{error}</div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <StatTile label="Total Fees" value={formatPKR(num(data.fees.total))} accent="bg-blue-600" />
              <StatTile label="Collected" value={formatPKR(num(data.fees.collected))} accent="bg-emerald-600" />
              <StatTile label="Pending" value={formatPKR(num(data.fees.pending))} accent="bg-rose-600" />
              <StatTile
                label="Collection Rate"
                value={`${num(data.fees.percentage)}%`}
                sub="Collected / Total"
                accent="bg-violet-600"
              />
              <StatTile
                label="Active Students"
                value={num(data.students.active)}
                sub={`${num(data.students.total)} total students`}
                accent="bg-amber-500"
              />
            </div>

            <div className="bg-white border rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="inline-flex border rounded-lg p-1 bg-slate-50">
                  {(data.divisions ?? []).map((d) => (
                    <button
                      key={d.type}
                      onClick={() => {
                        setDivisionType(d.type);
                        setClassId("all");
                        setSectionId("all");
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm border ${
                        divisionType === d.type
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {d.title}
                    </button>
                  ))}
                </div>

                {activeDivision ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={classId}
                      onChange={(e) => {
                        setClassId(e.target.value);
                        setSectionId("all");
                      }}
                      className="border rounded-md px-2 py-1.5 text-sm min-w-[220px] bg-white text-slate-800"
                    >
                      <option value="all">All Classes ({activeDivision.title})</option>
                      {activeDivision.classes.map((cls) => (
                        <option key={cls.id} value={String(cls.id)}>
                          {classLabel(cls)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      disabled={!activeClass}
                      className="border rounded-md px-2 py-1.5 text-sm min-w-[220px] bg-white text-slate-800 disabled:bg-slate-100"
                    >
                      <option value="all">
                        {activeClass ? `All Sections (${classLabel(activeClass)})` : "Select class first"}
                      </option>
                      {(activeClass?.sections ?? []).map((sec) => (
                        <option key={sec.id} value={String(sec.id)}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {activeDivision ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-1 border rounded-lg p-3 bg-slate-50/60">
                    <p className="text-xs uppercase text-slate-500 mb-3">{activeDivision.title} Overview</p>
                    <div className="space-y-3">
                      <Meter
                        label="Division Fee Collection"
                        value={num(activeDivision.fees.collected)}
                        total={Math.max(1, num(activeDivision.fees.total))}
                        tone="bg-emerald-600"
                        suffix=""
                      />
                      <Meter
                        label="Division Attendance (Present %)"
                        value={num(activeDivision.attendance.percentage)}
                        total={100}
                        tone="bg-blue-600"
                        suffix="%"
                      />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <StatTile label="Classes" value={num(activeDivision.stats.classes_count)} accent="bg-slate-600" />
                        <StatTile label="Sections" value={num(activeDivision.stats.sections_count)} accent="bg-slate-600" />
                        <StatTile label="Students" value={num(activeDivision.stats.students_count)} accent="bg-amber-500" />
                        <StatTile label="Active" value={num(activeDivision.stats.active_students_count)} accent="bg-emerald-600" />
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-2 space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium text-slate-700">
                        Class Performance
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white border-b text-slate-500">
                            <tr>
                              <th className="text-left px-3 py-2">Class</th>
                              <th className="text-left px-3 py-2">Students</th>
                              <th className="text-left px-3 py-2">Fees</th>
                              <th className="text-left px-3 py-2">Collection %</th>
                              <th className="text-left px-3 py-2">Attendance %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeDivision.classes
                              .filter((cls) => classId === "all" || String(cls.id) === String(classId))
                              .map((cls) => (
                                <tr key={cls.id} className="border-b">
                                  <td className="px-3 py-2 font-medium text-slate-800">{classLabel(cls)}</td>
                                  <td className="px-3 py-2">{num(cls.students_count)}</td>
                                  <td className="px-3 py-2">{formatPKR(num(cls.fees.total))}</td>
                                  <td className="px-3 py-2">{num(cls.fees.percentage)}%</td>
                                  <td className="px-3 py-2">{num(cls.attendance.percentage)}%</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {classId !== "all" ? (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium text-slate-700">
                          Section Summary{" "}
                          {activeClass ? `- ${classLabel(activeClass)}` : ""}
                          {sectionId !== "all"
                            ? ` / ${
                                activeClass?.sections.find((s) => String(s.id) === String(sectionId))
                                  ?.name ?? "Selected Section"
                              }`
                            : ""}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-white border-b text-slate-500">
                              <tr>
                                <th className="text-left px-3 py-2">Section</th>
                                <th className="text-left px-3 py-2">Students</th>
                                <th className="text-left px-3 py-2">Fees</th>
                                <th className="text-left px-3 py-2">Collection %</th>
                                <th className="text-left px-3 py-2">Attendance %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleSectionRows.map((sec) => (
                                <tr key={sec.id} className="border-b">
                                  <td className="px-3 py-2 font-medium text-slate-800">{sec.name}</td>
                                  <td className="px-3 py-2">{num(sec.students_count)}</td>
                                  <td className="px-3 py-2">{formatPKR(num(sec.fees.total))}</td>
                                  <td className="px-3 py-2">{num(sec.fees.percentage)}%</td>
                                  <td className="px-3 py-2">{num(sec.attendance.percentage)}%</td>
                                </tr>
                              ))}
                              {visibleSectionRows.length === 0 ? (
                                <tr>
                                  <td className="px-3 py-4 text-slate-400" colSpan={5}>
                                    No sections found for this class.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-3 bg-slate-50 text-sm text-slate-500">
                        Select a class to view section-level summaries.
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium text-slate-700">
                          Most Absent Students
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {filteredAbsentees.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-slate-400">No absent-student data for this filter.</p>
                          ) : (
                            filteredAbsentees.slice(0, 20).map((row) => (
                              <div key={`${row.enrollment_id}-abs`} className="px-3 py-2 border-b text-sm">
                                <div className="font-medium text-slate-800">{row.student_name}</div>
                                <div className="text-xs text-slate-500">
                                  {row.class_name}{row.section_name ? ` / ${row.section_name}` : ""} {row.father_name ? `• Father: ${row.father_name}` : ""}
                                </div>
                                <div className="text-xs text-rose-700 font-semibold mt-1">
                                  {num(row.absent_days)} absent day(s)
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium text-slate-700">
                          Highest Pending Fees
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {filteredPendingFees.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-slate-400">No pending-fee data for this filter.</p>
                          ) : (
                            filteredPendingFees.slice(0, 20).map((row) => (
                              <div key={`${row.enrollment_id}-fee`} className="px-3 py-2 border-b text-sm">
                                <div className="font-medium text-slate-800">{row.student_name}</div>
                                <div className="text-xs text-slate-500">
                                  {row.class_name}{row.section_name ? ` / ${row.section_name}` : ""} {row.father_name ? `• Father: ${row.father_name}` : ""}
                                </div>
                                <div className="text-xs text-amber-700 font-semibold mt-1">
                                  {formatPKR(num(row.pending_amount))} pending ({num(row.pending_fee_count)} fee item(s))
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No division data found.</div>
              )}
            </div>

            <div className="text-xs text-right text-slate-400">Last updated: {data.meta.generated_at}</div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
