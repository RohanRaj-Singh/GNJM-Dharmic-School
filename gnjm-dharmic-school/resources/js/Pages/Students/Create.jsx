import SimpleLayout from "@/Layouts/SimpleLayout";
import { useForm } from "@inertiajs/react";
import { useEffect } from "react";

export default function CreateStudent({ classes }) {

  const { data, setData, post, processing } = useForm({
    name: "",
    father_name: "",
    class_id: classes[0]?.id ?? "",
    section_id: "",
    student_type: "paid",
    monthly_fee: 0,
  });

  const selectedClass = classes.find(
    (c) => c.id === data.class_id
  );

  const defaultFee = selectedClass?.default_monthly_fee ?? 0;

  // auto-sync fee from class
  useEffect(() => {
    setData("monthly_fee", defaultFee);
  }, [defaultFee]);

  return (
    <SimpleLayout title="Add Student">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          post("/students");
        }}
      >

        {/* Student Name */}
        <div>
          <label className="text-sm text-gray-600">
            Student Name
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => setData("name", e.target.value)}
            className="w-full mt-1 border rounded-lg px-3 py-2"
          />
        </div>

        {/* Father Name */}
        <div>
          <label className="text-sm text-gray-600">
            Father Name
          </label>
          <input
            type="text"
            value={data.father_name}
            onChange={(e) => setData("father_name", e.target.value)}
            className="w-full mt-1 border rounded-lg px-3 py-2"
          />
        </div>

        {/* Class */}
        <div>
          <label className="text-sm text-gray-600">
            Class
          </label>
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2"
            value={data.class_id}
            onChange={(e) => {
              setData("class_id", Number(e.target.value));
              setData("section_id", "");
            }}
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section */}
        <div>
          <label className="text-sm text-gray-600">
            Section
          </label>
          <select
            className="w-full mt-1 border rounded-lg px-3 py-2"
            value={data.section_id}
            onChange={(e) =>
              setData("section_id", Number(e.target.value))
            }
          >
            <option value="">Select Section</option>
            {selectedClass?.sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
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
              active={data.student_type === "paid"}
              onClick={() => setData("student_type", "paid")}
            />
            <TypeButton
              label="Free"
              active={data.student_type === "free"}
              onClick={() => setData("student_type", "free")}
            />
          </div>
        </div>

        {/* Monthly Fee */}
        {data.student_type === "paid" && defaultFee > 0 && (
          <div>
            <label className="text-sm text-gray-600">
              Monthly Fee
            </label>
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

        {/* Submit */}
        <button
          type="submit"
          disabled={processing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          {processing ? "Saving..." : "Save Student"}
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
