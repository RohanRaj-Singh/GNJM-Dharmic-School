import SimpleLayout from "@/Layouts/SimpleLayout";
import { useForm } from "@inertiajs/react";
import { useState } from "react";

export default function CreateStudent({ classes }) {
  const [type, setType] = useState("paid");

  const { data, setData, post, processing } = useForm({
    name: "",
    father_name: "",
    father_phone: "",
    mother_phone: "",
    section_id: "",
    student_type: "paid",
  });

  const selectedClass = classes.find(c =>
    c.sections.some(s => s.id === Number(data.section_id))
  );

  const defaultFee = selectedClass?.default_monthly_fee ?? 0;

  const submit = (e) => {
    e.preventDefault();
    post("/students"); // ✅ backend handles redirect
  };

  return (
    <SimpleLayout title="Add Student">
      <form onSubmit={submit} className="space-y-4">

        <Input
          label="Student Name"
          value={data.name}
          onChange={e => setData("name", e.target.value)}
        />

        <Input
          label="Father Name"
          value={data.father_name}
          onChange={e => setData("father_name", e.target.value)}
        />

        <Input
          label="Father Phone"
          placeholder="Optional"
          value={data.father_phone}
          onChange={e => setData("father_phone", e.target.value)}
        />

        <Input
          label="Mother Phone"
          placeholder="Optional"
          value={data.mother_phone}
          onChange={e => setData("mother_phone", e.target.value)}
        />

        <div>
          <label className="text-sm text-gray-600">Section</label>
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2"
            value={data.section_id}
            onChange={e => setData("section_id", e.target.value)}
            required
          >
            <option value="">Select Section</option>
            {classes.map(cls =>
              cls.sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {cls.name} – {sec.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600">Student Type</label>
          <div className="flex gap-4 mt-2">
            <TypeButton
              label="Paid"
              active={type === "paid"}
              onClick={() => {
                setType("paid");
                setData("student_type", "paid");
              }}
            />
            <TypeButton
              label="Free"
              active={type === "free"}
              onClick={() => {
                setType("free");
                setData("student_type", "free");
              }}
            />
          </div>
        </div>

        {type === "paid" && defaultFee > 0 && (
          <div>
            <label className="text-sm text-gray-600">Monthly Fee</label>
            <input
              type="number"
              value={defaultFee}
              disabled
              className="w-full mt-1 border rounded-lg px-3 py-2 bg-gray-100"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default fee from class
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={processing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          Save Student
        </button>

      </form>
    </SimpleLayout>
  );
}

/* ---------- Helpers ---------- */

function Input({ label, ...props }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        {...props}
        className="w-full mt-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring"
      />
    </div>
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
