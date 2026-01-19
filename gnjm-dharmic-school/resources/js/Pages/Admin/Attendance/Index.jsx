import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
/*
|--------------------------------------------------------------------------
| Attendance – Admin
|--------------------------------------------------------------------------
| UX principles applied:
| - Never blank screen
| - Grid always visible
| - Disabled overlay instead of hiding UI
| - Safe defaults
| - Defensive rendering
*/

export default function Index({ classes = [] }) {
  /* ---------------------------------------
   | State
   --------------------------------------- */
  const today = new Date();

  const [classId, setClassId] = useState(
    classes.length ? classes[0].id : ""
  );
  const [sectionId, setSectionId] = useState("");
  const [sections, setSections] = useState([]);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0")
  );

  const [grid, setGrid] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(false);

  /* ---------------------------------------
   | Load sections when class changes
   --------------------------------------- */
   useEffect(() => {
  if (!classId) {
    setSections([]);
    setSectionId("");
    setGrid(null);
    return;
  }

  fetch(`/admin/sections/options?class_id=${classId}`)
    .then(r => {
      if (!r.ok) throw new Error("Failed to load sections");
      return r.json();
    })
    .then(data => {
      setSections(data);
      setSectionId(data.length ? String(data[0].id) : "");
    })
    .catch(() => {
      setSections([]);
      setSectionId("");
    });
}, [classId]);

  /* ---------------------------------------
   | Load attendance grid
   --------------------------------------- */
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

  /* ---------------------------------------
   | Toggle attendance cell
   --------------------------------------- */
  function toggleCell(studentId, date, enabled) {
    if (!enabled) return;

    const key = `${studentId}-${date}`;

    const current =
      draft[key] ??
      grid?.students
        ?.find(s => s.id === studentId)
        ?.records?.[key]?.status ??
      null;

    const next =
      current === null
        ? "present"
        : current === "present"
        ? "absent"
        : current === "absent"
        ? "leave"
        : null;

    setDraft(prev => ({ ...prev, [key]: next }));
  }

  /* ---------------------------------------
   | Save attendance
   --------------------------------------- */
  function saveAttendance() {
  setLoading(true);

  fetch("/admin/attendance/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": document
        .querySelector('meta[name="csrf-token"]')
        .getAttribute("content"),
    },
    body: JSON.stringify({
      section_id: sectionId,
      year,
      month: parseInt(month),
      records: draft,
    }),
  })
    .then(r => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then(() => {
      setDraft({});
      toast.success("Attendance saved"); // hot toast ✅

      // 🔥 FORCE GRID RELOAD
      fetch(
        `/admin/attendance/grid?section_id=${sectionId}&year=${year}&month=${parseInt(month)}`
      )
        .then(r => r.json())
        .then(setGrid);
    })
    .catch(() => {
      toast.error("Failed to save attendance");
    })
    .finally(() => setLoading(false));
}


  /* ---------------------------------------
   | Derived safe values
   --------------------------------------- */
  const days = grid?.days ?? [];
  const students = grid?.students ?? [];

  /* ---------------------------------------
   | Render
   --------------------------------------- */
  return (
    <AdminLayout title="Attendance">
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

        {grid && (
          <button
            onClick={saveAttendance}
            className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm"
          >
            Save Attendance
          </button>
        )}
      </div>

      {/* ================= Attendance Grid ================= */}
      <div className="relative bg-white border rounded overflow-x-auto">
        {/* Overlay */}
        {(!grid || loading) && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-30">
            <p className="text-sm text-gray-500">
              {loading
                ? "Loading attendance..."
                : "Attendance will appear here"}
            </p>
          </div>
        )}

        <table className="min-w-max text-sm border-collapse">
          {/* ---------- Header ---------- */}
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

          {/* ---------- Body ---------- */}
          <tbody>
            {students.map(student => (
              <tr key={student.id} className="border-b">
                <td className="px-3 py-2 sticky left-0 bg-white z-10 font-medium">
                  {student.name}
                </td>

                {days.map(d => {
                  const key = `${student.id}-${d.date}`;
                  const value =
                    draft[key] ??
                    student.records?.[key]?.status ??
                    null;

                  return (
                    <td
                      key={d.date}
                      onClick={() =>
                        toggleCell(student.id, d.date, d.enabled)
                      }
                      className={`px-2 py-2 text-center select-none
                        ${
                          !d.enabled
                            ? "bg-gray-100 text-gray-300"
                            : "cursor-pointer hover:bg-gray-100"
                        }`}
                    >
                      {value ? value[0].toUpperCase() : "—"}
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
