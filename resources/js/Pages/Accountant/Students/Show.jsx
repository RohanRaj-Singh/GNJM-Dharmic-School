import SimpleLayout from "@/Layouts/SimpleLayout";

export default function StudentShow({ student, summary }) {
  console.log(student);

  return (
    <SimpleLayout title="Student Summary">
      <div className="space-y-4">

        {/* Student Basic Info */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-xl font-semibold text-gray-800">
            {student.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Father: {student.father_name}
          </p>
        </div>

        {/* Contact Info */}
<div className="bg-white rounded-xl shadow p-5 space-y-4">
  <h3 className="text-md font-semibold text-gray-700">
    Parent Contact
  </h3>

  <ContactRow
    label="Father Phone"
    number={student.father_phone}
  />

  <ContactRow
    label="Mother Phone"
    number={student.mother_phone}
  />
</div>


        {/* Per Enrollment Summary */}
        {summary.map((item, index) => (
          <div key={index} className="space-y-4">

            {/* Academic Info */}
            <div className="bg-white rounded-xl shadow p-5 space-y-2">
              <InfoRow label="Class" value={item.class} />
              <InfoRow label="Section" value={item.section} />
            </div>

            {/* Attendance Summary */}
            <div className="bg-white rounded-xl shadow p-5 space-y-2">
              <h3 className="text-md font-semibold text-gray-700">
                Attendance Summary
              </h3>

              <InfoRow label="Present" value={item.attendance.present} />
              <InfoRow label="Absent" value={item.attendance.absent} />
              <InfoRow label="Leave" value={item.attendance.leave} />
            </div>

            {/* Recent Attendance */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-md font-semibold text-gray-700 mb-2">
                Recent Attendance
              </h3>

              {item.attendance.recent.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No recent attendance records
                </p>
              ) : (
                <ul className="text-sm text-gray-600 space-y-1">
                  {item.attendance.recent.map((a, i) => (
                    <li key={i}>
                      📅 {a.date} —{" "}
                      {a.status === "present" && "✔ Present"}
                      {a.status === "absent" && "❌ Absent"}
                      {a.status === "leave" && "🟡 Leave"}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Fee Status */}
<div className="bg-white rounded-xl shadow p-5">
  <h3 className="text-md font-semibold text-gray-700 mb-2">
    Fee Status
  </h3>

  {item.fees.all_paid ? (
    <p className="text-green-600 text-sm">
      ✔ All fees paid
    </p>
  ) : (
    <>
      <ul className="text-red-600 text-sm space-y-1 mb-3">
        {item.fees.unpaid_months.map((month, i) => (
          <li key={i}>❌ {month}</li>
        ))}
      </ul>

      <button
        onClick={() =>
          window.location.href =
            `/accountant/receive-fee?student_id=${student.id}`
        }
        className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium"
      >
        Collect Fee
      </button>
    </>
  )}
</div>


          </div>
        ))}

      </div>
    </SimpleLayout>
  );
}

/* ---------------- Helper ---------------- */

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">
        {value}
      </span>
    </div>
  );
}
function formatWhatsappNumber(number) {
  if (!number) return null;

  // Remove spaces, dashes, brackets
  let cleaned = number.replace(/[^\d]/g, "");

  // Pakistan formats
  if (cleaned.startsWith("0")) {
    cleaned = "92" + cleaned.slice(1);
  }

  if (cleaned.startsWith("92") && cleaned.length >= 12) {
    return cleaned;
  }

  return null; // invalid
}


function ContactRow({ label, number }) {
  const waNumber = formatWhatsappNumber(number);

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>

      {number ? (
        <div className="flex gap-3">
          {/* Call */}
          <a
            href={`tel:${number}`}
            className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs"
          >
            📞 Call
          </a>

          {/* WhatsApp */}
          {waNumber ? (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 rounded-lg bg-green-600 text-white text-xs"
            >
              💬 WhatsApp
            </a>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-gray-200 text-gray-500 text-xs">
              💬 WhatsApp
            </span>
          )}
        </div>
      ) : (
        <span className="text-gray-400 italic">Not added</span>
      )}
    </div>
  );
}

