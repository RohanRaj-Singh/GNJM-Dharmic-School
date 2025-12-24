import SimpleLayout from "@/Layouts/SimpleLayout";
import { useState } from "react";

export default function CreateStudent() {
  const classFees = {
  Gurmukhi: 600,
  Kirtan: 0, // Kirtan has no monthly fee
};
  
    const [type, setType] = useState("Paid");
    const [selectedClass, setSelectedClass] = useState("Gurmukhi");
const [monthlyFee, setMonthlyFee] = useState(classFees["Gurmukhi"]);
    


  return (
    <SimpleLayout title="Add Student">
      <form className="space-y-4">

        {/* Student Name */}
        <div>
          <label className="text-sm text-gray-600">
            Student Name
          </label>
          <input
            type="text"
            placeholder="Enter student name"
            className="w-full mt-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
          />
        </div>

        {/* Father Name */}
        <div>
          <label className="text-sm text-gray-600">
            Father Name
          </label>
          <input
            type="text"
            placeholder="Enter father name"
            className="w-full mt-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
          />
        </div>

        {/* Class */}
        <div>
          <label className="text-sm text-gray-600">
            Class
          </label>
          <select
  className="w-full mt-1 border rounded-lg px-3 py-2"
  value={selectedClass}
  onChange={(e) => {
    const cls = e.target.value;
    setSelectedClass(cls);
    setMonthlyFee(classFees[cls] ?? 0);
  }}
>
  <option value="Gurmukhi">Gurmukhi</option>
  <option value="Kirtan">Kirtan</option>
</select>

        </div>

        {/* Section */}
        <div>
          <label className="text-sm text-gray-600">
            Section
          </label>
          <select className="w-full mt-1 border rounded-lg px-3 py-2">
            <option>Section A</option>
            <option>Section B</option>
            <option>Tabla</option>
            <option>Dil Rubab</option>
          </select>
        </div>

        {/* Student Type */}
        <div>
          <label className="text-sm text-gray-600">
            Student Type
          </label>
          <div className="flex gap-4 mt-2">
            <TypeButton
              label="Paid"
              active={type === "Paid"}
              onClick={() => setType("Paid")}
            />
            <TypeButton
              label="Free"
              active={type === "Free"}
              onClick={() => setType("Free")}
            />
          </div>
        </div>

        {/* Monthly Fee (Paid Only) */}
        {type === "Paid" && monthlyFee > 0 && (
  <div>
    <label className="text-sm text-gray-600">
      Monthly Fee
    </label>
    <input
      type="number"
      value={monthlyFee}
      onChange={(e) => setMonthlyFee(e.target.value)}
      className="w-full mt-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
    />
    <p className="text-xs text-gray-400 mt-1">
      Default fee from class (can be changed)
    </p>
  </div>
)}


        {/* Submit */}
        <button
          type="button"
          disabled
          className="w-full bg-blue-600 text-white py-3 rounded-lg opacity-60"
        >
          Save Student (Demo)
        </button>

      </form>
    </SimpleLayout>
  );
}

function TypeButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}
