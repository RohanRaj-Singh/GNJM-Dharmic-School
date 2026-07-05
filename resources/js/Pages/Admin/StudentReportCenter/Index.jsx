import AdminLayout from "@/Layouts/AdminLayout";
import { Head } from "@inertiajs/react";
import axios from "axios";
import { useCallback, useMemo, useState } from "react";
import FilterBar from "./components/FilterBar";

/*
 * Student Report Center — V1 page.
 *
 * Mental model (deliberately simple):
 *   1. Pick a student.
 *   2. Pick a date range (preset or month grid).
 *   3. Pick a division.
 *   4. Build → preview.
 *
 * Transport:
 *  - The build endpoint returns plain JSON. We call it via axios.post()
 *    which auto-includes the XSRF cookie. No manual CSRF, no manual
 *    hidden forms.
 *  - PDF download is a plain GET link. No CSRF needed; shareable URL.
 *  - The 401/419 → /login redirect is centralised in bootstrap.js.
 *
 * The state shape is intentionally flat: { studentId, rangeStart,
 * rangeEnd, division }. The old shape had 7 fields for the range
 * (rangeMode, singleYear, singleMonth, rangeFromYear, rangeToYear,
 * rangeStart, rangeEnd) which is what caused the confusion.
 */
const INITIAL_STATE = (currentYear) => {
  const m = String(new Date().getMonth() + 1).padStart(2, "0");
  return {
    studentId: null,
    rangeStart: `${currentYear}-${m}`,
    rangeEnd:   `${currentYear}-${m}`,
    division: "all",
  };
};

export default function Index({ students, earliestYear, latestYear, currentYear }) {
  const [s, setS] = useState(() => INITIAL_STATE(currentYear));
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));

  const [report, setReport]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]           = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [builtSignature, setBuiltSignature] = useState(null);

  // Compute range month count for the label.
  const rangeMonths = useMemo(() => {
    if (!s.rangeStart || !s.rangeEnd) return 0;
    const [ay, am] = s.rangeStart.split("-").map(Number);
    const [by, bm] = s.rangeEnd.split("-").map(Number);
    return (by - ay) * 12 + (bm - am) + 1;
  }, [s.rangeStart, s.rangeEnd]);

  // Generate PDF: POST to the build endpoint, fetch as Blob, open in new tab.
  const generatePdf = useCallback(() => {
    if (!s.studentId || !s.rangeStart || !s.rangeEnd) return;
    setPdfLoading(true);

    axios
      .post("/admin/student-report-center/export/pdf", {
        student_id: s.studentId,
        range_mode: "range",
        range_start: s.rangeStart,
        range_end: s.rangeEnd,
        division: s.division,
      }, {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
      })
      .then((res) => {
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      })
      .catch((err) => {
        if (err.response?.status === 422) {
          setFieldErrors(err.response.data?.errors || { _all: err.response.data?.message || "Validation failed" });
          setError("PDF generation failed. Please check the filters.");
          return;
        }
        setError(err.response ? `PDF failed: ${err.response.status}` : String(err));
      })
      .finally(() => setPdfLoading(false));
  }, [s]);

  const currentSignature = useMemo(
    () => JSON.stringify({ sid: s.studentId, rs: s.rangeStart, re: s.rangeEnd, d: s.division }),
    [s]
  );
  const isStale = builtSignature !== null && builtSignature !== currentSignature;

  const validateBeforeBuild = useCallback(() => {
    const errs = {};
    if (!s.studentId) errs.student_id = "Pick a student first.";
    if (!s.rangeStart) errs.range_start = "Pick a start month.";
    if (!s.rangeEnd)   errs.range_end   = "Pick an end month.";
    if (s.rangeStart && s.rangeEnd && s.rangeStart > s.rangeEnd) {
      errs.range_end = "End must be on or after start.";
    }
    return errs;
  }, [s]);

  const buildReport = useCallback(() => {
    const errs = validateBeforeBuild();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setError(null);
    setLoading(true);
    setReport(null);

    axios
      .post("/admin/student-report-center/build", {
        student_id: s.studentId,
        range_mode: "range",
        range_start: s.rangeStart,
        range_end: s.rangeEnd,
        division: s.division,
      }, { headers: { Accept: "application/json" } })
      .then((res) => {
        setReport(res.data);
        setBuiltSignature(currentSignature);
      })
      .catch((err) => {
        if (err.response?.status === 422) {
          setFieldErrors(err.response.data?.errors || { _all: err.response.data?.message || "Validation failed" });
          setError("Server rejected the filter. See highlighted fields below.");
          return;
        }
        if (err.response?.status === 419) {
          setError("Session expired. Please refresh the page and try again.");
          return;
        }
        setError(err.response ? `Build failed: ${err.response.status}` : String(err));
      })
      .finally(() => setLoading(false));
  }, [s, validateBeforeBuild, currentSignature]);

  const applyPreset = useCallback((key) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0..11
    const ym = (yr, mo) => `${yr}-${String(mo + 1).padStart(2, "0")}`;

    let start, end;
    switch (key) {
      case "this_month":
        start = end = ym(y, m);
        break;
      case "last_3_months": {
        const startDate = new Date(y, m - 2, 1);
        start = ym(startDate.getFullYear(), startDate.getMonth());
        end   = ym(y, m);
        break;
      }
      case "last_6_months": {
        const startDate = new Date(y, m - 5, 1);
        start = ym(startDate.getFullYear(), startDate.getMonth());
        end   = ym(y, m);
        break;
      }
      case "this_year":
        start = `${y}-01`;
        end   = `${y}-12`;
        break;
      case "last_12_months": {
        const startDate = new Date(y, m - 11, 1);
        start = ym(startDate.getFullYear(), startDate.getMonth());
        end   = ym(y, m);
        break;
      }
      case "all_time": {
        // Earliest year is exposed by the controller (currentYear-10).
        start = `${earliestYear}-01`;
        end   = ym(y, m);
        break;
      }
      default:
        return;
    }

    // Clamp to engine cap of 36 months.
    const totalMonths = ((end.match(/\d{4}/)?.[0] | 0) - (start.match(/\d{4}/)?.[0] | 0)) * 12
                      + (Number(end.slice(5, 7)) - Number(start.slice(5, 7)))
                      + 1;
    if (totalMonths > 36) {
      // Roll start forward to fit.
      const [ey, em] = end.split("-").map(Number);
      const startMonths = (ey * 12 + (em - 1)) - 35;
      const sy = Math.floor((startMonths - 1) / 12);
      const sm = (startMonths - 1) - sy * 12;
      start = ym(sy, sm);
    }

    set({ rangeStart: start, rangeEnd: end });
  }, [earliestYear]);

  const resetFilter = useCallback(() => {
    setS(INITIAL_STATE(currentYear));
    setReport(null);
    setError(null);
    setFieldErrors({});
    setBuiltSignature(null);
  }, [currentYear]);

  return (
    <AdminLayout title="Student Report Center">
      <Head title="Student Report Center" />

      <FilterBar
        students={students}
        earliestYear={earliestYear}
        latestYear={latestYear}
        studentId={s.studentId}
        rangeStart={s.rangeStart}
        rangeEnd={s.rangeEnd}
        rangeMonths={rangeMonths}
        division={s.division}
        loading={loading}
        hasReport={!!report && !isStale}
        setStudentId={(v) => set({ studentId: v })}
        setRangeStart={(v) => set({ rangeStart: v })}
        setRangeEnd={(v) => set({ rangeEnd: v })}
        setDivision={(v) => set({ division: v })}
        applyPreset={applyPreset}
        buildReport={buildReport}
        exportPdf={generatePdf}
        pdfLoading={pdfLoading}
        canExport={!!report && !isStale && !!s.studentId}
        resetFilter={resetFilter}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
          {error}
          {error.includes("Session expired") && (
            <button
              onClick={() => window.location.reload()}
              className="ml-2 underline font-medium"
            >
              Refresh page
            </button>
          )}
        </div>
      )}

      {Object.keys(fieldErrors).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 mb-4 text-sm">
          <ul className="list-disc pl-5">
            {Object.entries(fieldErrors).map(([k, v]) => (
              <li key={k}>
                <b>{k}</b>: {Array.isArray(v) ? v.join(", ") : String(v)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isStale && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 mb-4 text-sm">
          Filter changed since the last build. Click <b>Build Report</b> to refresh, or <b>Reset</b> to start over.
        </div>
      )}

      {!report && !loading && !error && (
        <div className="bg-white border rounded p-6 text-center text-sm text-gray-400">
          Pick a student and a date range, then click <b>Build Report</b>.
        </div>
      )}

      {report && !isStale && <ReportBody report={report} />}
    </AdminLayout>
  );
}

function ReportBody({ report }) {
  const identity = report.identity;
  const gurmukhi  = report.divisions?.gurmukhi;
  const kirtan    = report.divisions?.kirtan;
  const isFree    = identity.student_type === "free";

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm text-blue-800">
        <b>{report.meta.range_label}</b>
        <span className="text-blue-600"> · Generated {report.meta.generated_at}</span>
      </div>

      <IdentityBlock identity={identity} />

      {gurmukhi && (
        <Section title="Gurmukhi (Academic)" enrolled={gurmukhi.enrolled}>
          <AttendanceSectionLite
            title="Gurmukhi"
            attendance={gurmukhi.attendance}
            enrolled={gurmukhi.enrolled}
            monthCount={report.range.total_months}
          />
          <FeeSectionLite
            title="Gurmukhi"
            fees={gurmukhi.fees}
            enrolled={gurmukhi.enrolled}
            isFree={isFree}
          />
          <CalendarSectionLite
            title="Gurmukhi"
            months={gurmukhi.months}
            enrolled={gurmukhi.enrolled}
            showLesson={false}
          />
        </Section>
      )}

      {kirtan && (
        <Section title="Kirtan (Spiritual)" enrolled={kirtan.enrolled}>
          <AttendanceSectionLite
            title="Kirtan"
            attendance={kirtan.attendance}
            enrolled={kirtan.enrolled}
            monthCount={report.range.total_months}
          />
          <FeeSectionLite
            title="Kirtan"
            fees={kirtan.fees}
            enrolled={kirtan.enrolled}
            isFree={isFree}
          />
          <KirtanSectionLite
            kirtanScore={kirtan.kirtan_score}
            enrolled={kirtan.enrolled}
          />
          <CalendarSectionLite
            title="Kirtan"
            months={kirtan.months}
            enrolled={kirtan.enrolled}
            showLesson={true}
          />
        </Section>
      )}
    </>
  );
}

function Section({ title, enrolled, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {!enrolled && (
          <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-500">
            Not enrolled
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// --- Section components (simplified, inlined for the new layout) ---

import IdentityBlock from "./components/IdentityBlock";
import AttendanceSectionLite from "./components/AttendanceSection";
import FeeSectionLite from "./components/FeeSection";
import KirtanSectionLite from "./components/KirtanSection";
import CalendarSectionLite from "./components/CalendarSection";
