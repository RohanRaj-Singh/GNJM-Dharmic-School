import { formatPercent } from "../utils";

/*
 * Kirtan performance section.
 * V1 math: score = attendance*0.6 + lesson*0.4, with rating buckets.
 * Defensive: if data_status === 'no_data', show "Not enough data".
 */
export default function KirtanSection({ kirtanScore, enrolled = true, present = 0 }) {
  if (!enrolled) {
    return (
      <Wrapper title="Kirtan Performance">
        <div className="text-sm text-gray-400">
          Student is not enrolled in Kirtan.
        </div>
      </Wrapper>
    );
  }

  if (!kirtanScore) {
    return (
      <Wrapper title="Kirtan Performance">
        <div className="text-sm text-gray-400">No Kirtan attendance in this range.</div>
      </Wrapper>
    );
  }

  if (kirtanScore.data_status === "no_data") {
    return (
      <Wrapper title="Kirtan Performance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Score"   value="—" />
          <Stat label="Rating"  value="Not enough data" tone="amber" />
          <Stat label="Classes" value="0" />
          <Stat label="Lessons" value={String(kirtanScore.lessons_learned)} />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          No attendance recorded in the selected range.
        </p>
      </Wrapper>
    );
  }

  return (
    <Wrapper title="Kirtan Performance">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat
          label="Score"
          value={formatPercent(kirtanScore.score, 1)}
          tone={ratingTone(kirtanScore.rating)}
        />
        <Stat
          label="Rating"
          value={kirtanScore.rating}
          tone={ratingTone(kirtanScore.rating)}
        />
        <Stat label="Total Classes"  value={String(kirtanScore.total_classes)} />
        <Stat label="Lessons Learned" value={String(kirtanScore.lessons_learned)} tone="blue" />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="border rounded p-3 bg-gray-50">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Attendance component</div>
          <div className="font-medium text-gray-800 mt-0.5">
            {formatPercent(kirtanScore.components.attendance, 1)} <span className="text-xs text-gray-500">× 0.6</span>
          </div>
        </div>
        <div className="border rounded p-3 bg-gray-50">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Lesson component</div>
          <div className="font-medium text-gray-800 mt-0.5">
            {formatPercent(kirtanScore.components.lesson, 1)} <span className="text-xs text-gray-500">× 0.4</span>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

function Wrapper({ title, children }) {
  return (
    <div className="bg-white border rounded mb-4">
      <div className="px-4 py-2 border-b">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    red:   "text-red-700",
    green: "text-green-700",
    blue:  "text-blue-700",
    amber: "text-amber-700",
  };
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${tones[tone] || "text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}

function ratingTone(rating) {
  if (rating === "Excellent")         return "green";
  if (rating === "Good")              return "blue";
  if (rating === "Average")           return "amber";
  if (rating === "Needs Improvement") return "red";
  return null;
}
