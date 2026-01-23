import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState } from "react";

/*
|--------------------------------------------------------------------------
| Attendance Report – Admin (READ ONLY)
|--------------------------------------------------------------------------
| - Calendar-based (same as marking page)
| - Uses /admin/attendance/grid
| - NO editing
| - NO saving
| - Summary cards included
*/

export default function AttendanceReport() {
  const today = new Date();

  /* ===============================
     STATE
  ================================ */
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0")
  );

  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedClass = useMemo(
  () => classes.find(c => String(c.id) === String(classId)),
  [classes, classId]
);

const isKirtan = selectedClass?.type === "Kirtan";




  /* ===============================
     LOAD CLASSES (ONCE)
  ================================ */
  useEffect(() => {
    fetch("/admin/classes/options")
      .then(r => r.json())
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  /* ===============================
     AUTO SELECT FIRST CLASS
  ================================ */
  useEffect(() => {
    if (classes.length && !classId) {
      setClassId(String(classes[0].id));
    }
  }, [classes]);

  /* ===============================
     LOAD SECTIONS
  ================================ */
  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId("");
      setGrid(null);
      return;
    }

    fetch(`/admin/sections/options?class_id=${classId}`)
      .then(r => r.json())
      .then(data => {
        setSections(data);
        setSectionId(data.length ? String(data[0].id) : "");
      })
      .catch(() => {
        setSections([]);
        setSectionId("");
      });
  }, [classId]);

  /* ===============================
     LOAD ATTENDANCE GRID (REPORT)
  ================================ */
  useEffect(() => {
    if (!sectionId) {
      setGrid(null);
      return;
    }

    setLoading(true);

    fetch(
      `/admin/attendance/grid?section_id=${sectionId}&year=${year}&month=${parseInt(
        month
      )}`
    )
      .then(r => r.json())
      .then(setGrid)
      .finally(() => setLoading(false));
  }, [sectionId, year, month]);

  /* ===============================
     DERIVED DATA
  ================================ */
  const days = grid?.days ?? [];
  const students = grid?.students ?? [];

  const allRecords = useMemo(() => {
    return students.flatMap(s =>
      Object.values(s.records ?? {})
    );
  }, [students]);

  const lessonLearnedCount = useMemo(() => {
  return students.flatMap(s =>
    Object.values(s.records ?? {})
  ).filter(r => r.lesson_learned).length;
}, [students]);

  const summary = useMemo(() => {
    return {
      total: allRecords.length,
      present: allRecords.filter(r => r.status === "present").length,
      absent: allRecords.filter(r => r.status === "absent").length,
      leave: allRecords.filter(r => r.status === "leave").length,
    };
  }, [allRecords]);

  const attendancePercentage =
    summary.total > 0
      ? Math.round((summary.present / summary.total) * 100)
      : 0;

  /* ===============================
     RENDER
  ================================ */
  return (
    <AdminLayout title="Attendance Report">
      {/* ================= Filters ================= */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={classId}
          onChange={e => setClassId(e.target.value)}
          className="border px-3 py-2 rounded text-sm"
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={sectionId}
          onChange={e => setSectionId(e.target.value)}
          className="border px-3 py-2 rounded text-sm"
          disabled={!sections.length}
        >
          {sections.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={`${year}-${month}`}
          onChange={e => {
            const [y, m] = e.target.value.split("-");
            setYear(parseInt(y));
            setMonth(m);
          }}
          className="border px-3 py-2 rounded text-sm"
        />
        <button
  onClick={() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/admin/reports/export/pdf";
    form.target = "_blank";

    const csrf = document.createElement("input");
    csrf.type = "hidden";
    csrf.name = "_token";
    csrf.value = document
      .querySelector('meta[name="csrf-token"]')
      .getAttribute("content");

    const payload = {
      report: "attendance",
      class_ids: classId ? [classId] : [],
      section_ids: sectionId ? [sectionId] : [],
      student_ids: students ? students.map(s => s.id) : [],
      status: null,
      month: parseInt(month),
      year: year,
    };

    Object.entries(payload).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = `${key}[]`;
          input.value = v;
          form.appendChild(input);
        });
      } else if (value !== null && value !== undefined) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }
    });

    form.appendChild(csrf);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }}
  disabled={!allRecords.length}
  className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
>
  Export PDF
</button>

      </div>

      {/* ================= SUMMARY ================= */}
      {grid && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Stat label="Total Records" value={summary.total} />
          <Stat label="Present" value={summary.present} />
          <Stat label="Absent" value={summary.absent} />
          <Stat label="Leave" value={summary.leave} />
          <Stat
            label="Attendance %"
            value={`${attendancePercentage}%`}
          />
          <Stat label="Lessons Learned" value={lessonLearnedCount} />

        </div>
      )}

      {/* ================= GRID ================= */}
      <div className="relative bg-white border rounded overflow-x-auto">
        {(loading || !grid) && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-30">
            <p className="text-sm text-gray-500">
              {loading
                ? "Loading attendance..."
                : "Attendance report will appear here"}
            </p>
          </div>
        )}

        <table className="min-w-max text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-3 py-2 sticky left-0 bg-gray-50 z-30 text-left">
                Student
              </th>

              {days.map(d => (
                <th
                  key={d.date}
                  className={`px-2 py-2 text-center ${
                    !d.enabled ? "text-gray-300" : ""
                  }`}
                >
                  {d.day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {students.map(student => (
              <tr key={student.id} className="border-b">
                <td className="px-3 py-2 sticky left-0 bg-white z-10 font-medium">
                  {student.name}
                </td>

                {days.map(d => {
                  const key = `${student.id}-${d.date}`;
                  const value = student.records?.[key]?.status ?? null;

                  const statusClass =
                    value === "present"
                      ? "bg-green-200 text-green-800"
                      : value === "absent"
                      ? "bg-red-200 text-red-800"
                      : value === "leave"
                      ? "bg-yellow-200 text-yellow-800"
                      : "";

                  return (
                    <td
  key={d.date}
  className={`px-2 py-2 text-center select-none ${statusClass}
    ${!d.enabled ? "bg-gray-100 text-gray-300" : ""}`}
>
  {value ? value[0].toUpperCase() : "—"}

  {isKirtan &&
  value === "present" &&
  Number(student.records?.[key]?.lesson_learned) === 1 && (
    <div className="mt-1 text-[10px] text-blue-700 font-semibold">
      Lesson ✓
    </div>
)}
</td>

                  );
                })}
              </tr>
            ))}

            {!students.length && (
              <tr>
                <td
                  colSpan={days.length + 1}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No students found in this section
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

/* ===============================
   STAT CARD
================================ */
function Stat({ label, value }) {
  return (
    <div className="bg-white border rounded p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
