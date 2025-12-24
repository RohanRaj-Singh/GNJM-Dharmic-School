import { useState } from "react";
import SimpleLayout from "@/Layouts/SimpleLayout";

const classType = "kirtan";
const studentsData = [
  { id: 1, name: "Aman Singh", father: "Harjit Singh" },
  { id: 2, name: "Simran Kaur", father: "Gurpreet Singh" },
  { id: 3, name: "Arjun Singh", father: "Manpreet Singh" },
  { id: 4, name: "Jasleen Kaur", father: "Balwinder Singh" },
];

export default function MarkAttendance() {
  const [index, setIndex] = useState(0);
  const [attendance, setAttendance] = useState({});
  const [lessonLearned, setLessonLearned] = useState({});


  const student = studentsData[index];

const markAttendance = (status) => {
  setAttendance({
    ...attendance,
    [student.id]: {
      status,
      lessonLearned:
        classType === "kirtan"
          ? lessonLearned[student.id] ?? false
          : null,
    },
  });
  if (
  classType === "kirtan" &&
  lessonLearned[student.id] === undefined
) {
  return;
}


  if (index < studentsData.length - 1) {
    setIndex(index + 1);
  }
};


  const goNext = () => {
    markAttendance("present");
  };

  const goPrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  const isFinished = index >= studentsData.length;

  return (
    <SimpleLayout title="Attendance">
      {!isFinished ? (
<div
  key={student.id}
  className="bg-white rounded-xl shadow p-6 text-center
             transition-all duration-300 ease-in-out
             animate-fade-in"
>          <div className="mb-4">
            <p className="text-sm text-gray-500">
              Student {index + 1} of {studentsData.length}
            </p>
          </div>
            <div className="mb-3">
  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-blue-600 transition-all duration-300"
      style={{
        width: `${((index + 1) / studentsData.length) * 100}%`,
      }}
    />
  </div>
</div>

          <h2 className="text-2xl font-semibold text-gray-800">
            {student.name}
          </h2>

          <p className="text-gray-500 mb-6">
            Father: {student.father}
          </p>


        {classType === "kirtan" &&
 lessonLearned[student.id] === undefined && (
  <p className="text-sm text-red-500 mt-2">
    Please select Lesson Learned
  </p>
)}


            {classType === "kirtan" && (
  <div className="mb-6">
    <p className="text-sm text-gray-600 mb-2">
      Lesson Learned?
    </p>

    <div className="flex gap-3 justify-center">
      <button
        onClick={() =>
          setLessonLearned({
            ...lessonLearned,
            [student.id]: true,
          })
        }
        className={`px-4 py-2 rounded-lg border ${
          lessonLearned[student.id] === true
            ? "bg-green-600 text-white"
            : "bg-white"
        }`}
      >
        Yes
      </button>

      <button
        onClick={() =>
          setLessonLearned({
            ...lessonLearned,
            [student.id]: false,
          })
        }
        className={`px-4 py-2 rounded-lg border ${
          lessonLearned[student.id] === false
            ? "bg-red-600 text-white"
            : "bg-white"
        }`}
      >
        No
      </button>
    </div>
  </div>
)}





          <div className="space-y-3">
            <button
              onClick={() => markAttendance("present")}
              className="active:scale-95 transition-transform w-full bg-green-600 text-white py-3 rounded-lg text-lg font-medium"
            >
              Present
            </button>

            <button
              onClick={() => markAttendance("absent")}
              className="active:scale-95 transition-transform w-full bg-red-600 text-white py-3 rounded-lg text-lg font-medium"
            >
              Absent
            </button>

            <button
              onClick={() => markAttendance("leave")}
              className="active:scale-95 transition-transform w-full bg-yellow-500 text-white py-3 rounded-lg text-lg font-medium"
            >
              Leave
            </button>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={index === 0}
              className="text-sm text-gray-600 disabled:opacity-40"
            >
              ← Previous
            </button>

            <button
              onClick={goNext}
              className="text-sm text-blue-600"
            >
              Next →
            </button>
          </div>
        </div>
      ) : (
        <AttendanceSummary attendance={attendance} />
      )}
    </SimpleLayout>
  );
}

function AttendanceSummary({ attendance }) {
  const values = Object.values(attendance);

  const present = values.filter((v) => v === "present").length;
  const absent = values.filter((v) => v === "absent").length;
  const leave = values.filter((v) => v === "leave").length;

  return (
    <div className="bg-white rounded-xl shadow p-6 text-center">
      <h2 className="text-2xl font-semibold mb-4">
        Attendance Completed
      </h2>

      <div className="space-y-2 text-lg">
        <p className="text-green-600">Present: {present}</p>
        <p className="text-red-600">Absent: {absent}</p>
        <p className="text-yellow-600">Leave: {leave}</p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="mt-6 bg-blue-600 text-white py-3 px-6 rounded-lg"
      >
        Done
      </button>
    </div>
  );
}
