import { formatPKR } from "../utils";

/*
 * The "Student Snapshot" — the data shown in the report header.
 * Mirrors the `StudentIdentity` value object's `toArray()` shape 1:1.
 */
export default function IdentityBlock({ identity }) {
  if (!identity) return null;

  return (
    <div className="bg-white border rounded mb-4">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-800">{identity.name}</h2>
        {identity.father_name && (
          <p className="text-sm text-gray-500">
            S/o {identity.father_name}
            {identity.father_phone ? ` · ${identity.father_phone}` : ""}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">
        <Cell label="Student ID"    value={String(identity.id)} />
        <Cell label="Status"        value={identity.status_label} tone={statusTone(identity.status)} />
        <Cell label="Student Type"  value={identity.student_type_label} tone={identity.student_type === "free" ? "blue" : null} />
        <Cell label="Division"      value={identity.division_label} />
        <Cell label="Current Class" value={currentClassLine(identity.enrollments)} />
        <Cell label="Enrolled Since" value={identity.enrollment_date || "—"} />
        <Cell label="Last Attendance" value={identity.last_attendance_date || "—"} />
        <Cell label="Last Payment"   value={identity.last_payment_date || "—"} />
        <Cell
          label="Outstanding"
          value={`${formatPKR(identity.outstanding_amount)} (${identity.outstanding_months} mo)`}
          tone={identity.outstanding_amount > 0 ? "red" : null}
        />
        <Cell label="Generated"      value={new Date().toLocaleDateString("en-PK")} />
      </div>
    </div>
  );
}

function Cell({ label, value, tone }) {
  const tones = {
    red:   "text-red-700",
    blue:  "text-blue-700",
    green: "text-green-700",
    amber: "text-amber-700",
  };
  return (
    <div className="bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${tones[tone] || "text-gray-800"}`}>{value}</div>
    </div>
  );
}

function statusTone(status) {
  if (status === "active")     return "green";
  if (status === "inactive")   return "amber";
  if (status === "graduated")  return "blue";
  if (status === "transferred") return "amber";
  if (status === "dropped")    return "red";
  return null;
}

function currentClassLine(enrollments) {
  if (!enrollments || enrollments.length === 0) return "Not enrolled";
  return enrollments
    .map((e) => `${e.class_name} - ${e.section_name}`)
    .join(", ");
}
