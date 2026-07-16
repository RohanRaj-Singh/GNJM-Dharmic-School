export default function ImpactSummary({
  type,
  studentName,
  currentEnrollments = [],
  targetClassName,
  targetSectionName,
  effectiveDate,
  outstandings = 0,
  compact = false,
  students = null,
}) {
  const typeLabels = {
    promote: "Promote",
    passOut: "Pass Out",
  };

  const actionLabel = typeLabels[type] || "Proceed";
  const isBulk = students && students.length > 1;

  const items = [
    { icon: "📋", label: "Action", value: actionLabel },
    { icon: "👤", label: "Student(s)", value: isBulk ? `${students.length} students` : studentName },
    { icon: "📚", label: "Current", value: isBulk ? `${students.length} enrollment(s)` : currentEnrollments.map((e) => `${e.className} — ${e.sectionName}`).join(", ") },
  ];

  if ((type === "promote") && targetClassName) {
    items.push({ icon: "🎯", label: "Target", value: `${targetClassName} — ${targetSectionName || ""}` });
  }

  if (effectiveDate) {
    items.push({ icon: "📅", label: "Date", value: effectiveDate });
  }

  if (outstandings > 0) {
    items.push({ icon: "💰", label: "Outstanding", value: `Rs. ${outstandings.toLocaleString()}`, highlight: true });
  }

  const content = compact ? (
    <div className="bg-gray-50 rounded-lg border divide-y text-sm">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-3 px-3 py-2 ${item.highlight ? "bg-red-50" : ""}`}>
          <span className="text-base">{item.icon}</span>
          <span className="text-gray-500 min-w-[80px]">{item.label}</span>
          <span className={`font-medium ${item.highlight ? "text-red-700" : "text-gray-800"}`}>{item.value}</span>
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Impact Summary</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`border rounded-lg p-3 ${item.highlight ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-sm font-semibold ${item.highlight ? "text-red-700" : "text-gray-800"}`}>{item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isBulk && students && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Affected students:</p>
          <div className="border rounded-lg divide-y max-h-36 overflow-y-auto text-sm">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50">
                <span className="font-medium text-gray-800">{s.name}</span>
                {s.outstandings > 0 && (
                  <span className="text-xs text-red-600">Rs. {s.outstandings.toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
        <p className="font-medium">What will happen:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>{isBulk ? "Previous enrollments" : "Previous enrollment"} will be closed</li>
          <li>All attendance records preserved</li>
          <li>All fee records preserved</li>
          {type === "promote" && <li>{isBulk ? "New enrollments" : "A new enrollment"} will be created for the target class/section</li>}
          {type === "promote" && <li>The new enrollment starts a fresh fee lifecycle</li>}
          {outstandings > 0 && <li>Outstanding fees remain collectible on the previous enrollment(s)</li>}
          <li>Historical reports remain accessible</li>
        </ul>
      </div>
    </div>
  );

  return content;
}
