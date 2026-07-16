export default function EditorBasicInfo({ data, onChange }) {
  const handleChange = (key) => (e) => onChange(key, e.target.value);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Basic Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Student Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.name || ""}
            onChange={handleChange("name")}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Enter student name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Father Name</label>
          <input
            type="text"
            value={data.father_name || ""}
            onChange={handleChange("father_name")}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Enter father name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Father Phone</label>
          <input
            type="text"
            value={data.father_phone || ""}
            onChange={handleChange("father_phone")}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Enter father phone"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Mother Phone</label>
          <input
            type="text"
            value={data.mother_phone || ""}
            onChange={handleChange("mother_phone")}
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Enter mother phone"
          />
        </div>
      </div>
    </div>
  );
}
