/**
 * Phase 1 prototype: integrated Fees UX mockup.
 *
 * This is a SELF-CONTAINED reviewable artifact for Phase 1 of the
 * redesign. It is NOT wired into any route. It is NOT a production
 * surface. See:
 *   - docs/architecture/16-fee-redesign-implementation-plan.md §5 (Phase 1)
 *   - docs/architecture/16-fee-redesign-implementation-plan.md §5.8 (mount)
 *   - docs/architecture/16-fee-redesign-implementation-plan.md §11 (gate)
 *
 * To preview locally, you have three options:
 *
 *   (a) Open `__prototypes__/preview.html` in a browser after running
 *       `npx vite` from the project root and importing this file. The
 *       `preview.html` ships with the prototype.
 *
 *   (b) Drop the `<FeesUxPrototype />` element into any existing
 *       dev-only route behind `import.meta.env.DEV && window.location
 *       .search.includes('feesPrototype=1')`.
 *
 *   (c) Copy pieces into CodeSandbox / StackBlitz.
 *
 * What this prototype demonstrates:
 *   - Mobile Fees Index (StudentCard list at 375px)
 *   - Desktop Fees Index (DataTable at 1280px)
 *   - Compact status pill row + month chip
 *   - Filters Sheet (slide-up modal)
 *   - Active Filter Chips
 *   - Student Fee Sheet (modal with Current + Previous Enrollments)
 *   - Enrollment Fee List (drill-down, "View older fees" expansion)
 *   - Collect Fee modal (with student + enrollment context header)
 *
 * No backend calls. No routes. No persistence. No `window.confirm()`.
 */

import { useMemo, useState } from "react";
import Modal from "@/Components/Modal";
import DataTable from "@/Components/DataTable";
import { divisionMeta } from "@/utils/divisionType";
import { formatMonthLabel } from "../components/feesFormatters";
import { detailFixtures, indexFixtures, allStudents } from "./feeFixture";

/* ============================================================
 *  Constants and helpers
 * ============================================================ */

const CURRENCY = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK")}`;

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
];

const CURRENT_MONTH = "2026-08";

const FILTER_LABELS = {
  year: (v) => `Year ${v}`,
  class_id: (v) => `Class #${v}`,
  section_id: (v) => `Section #${v}`,
  search: (v) => `"${v}"`,
  status: (v) => v ? v[0].toUpperCase() + v.slice(1) : "All",
  month: (v) => formatMonthLabel(v),
  month_from: (v) => `From ${formatMonthLabel(v)}`,
  month_to: (v) => `To ${formatMonthLabel(v)}`,
  paid_from: (v) => `Paid from ${v}`,
  paid_to: (v) => `Paid to ${v}`,
};

/* ============================================================
 *  Top-level prototype page
 * ============================================================ */

export default function FeesUxPrototype() {
  const [filters, setFilters] = useState({
    status: "unpaid",
    month: CURRENT_MONTH,
  });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [collectFee, setCollectFee] = useState(null); // { fee, student, enrollment }
  const [collectionDate, setCollectionDate] = useState(() => new Date().toISOString().slice(0, 10));

  /* Apply client-side filter for prototype realism */
  const filteredIndex = useMemo(() => {
    let rows = [...indexFixtures];
    if (filters.status === "unpaid") rows = rows.filter((r) => r.unpaid_amount > 0);
    if (filters.status === "paid") rows = rows.filter((r) => r.paid_amount > 0 && r.unpaid_amount === 0);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter((r) =>
        r.student_name.toLowerCase().includes(q) ||
        r.father_name.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [filters]);

  const totals = useMemo(() => {
    let unpaid = 0, paid = 0;
    for (const r of filteredIndex) { unpaid += r.unpaid_amount; paid += r.paid_amount; }
    return { unpaid, paid, count: filteredIndex.length };
  }, [filteredIndex]);

  const selectedDetail = selectedStudentId ? detailFixtures[selectedStudentId] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Surrogate AdminLayout chrome — purely visual */}
      <header className="bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-gray-500 sm:hidden" aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span className="text-base font-semibold text-gray-800">Fees (prototype)</span>
        </div>
        <span className="text-xs text-gray-500 hidden sm:inline">Phase 1 — mock data only</span>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <PageHeader />
        <SearchBar
          value={filters.search ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, search: v || undefined }))}
        />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <PrimaryFilterBar
            status={filters.status ?? ""}
            month={filters.month ?? ""}
            onStatusChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))}
            onMonthChange={(v) => setFilters((f) => ({ ...f, month: v || undefined }))}
          />
          <FiltersButton onClick={() => setFiltersModalOpen(true)} />
        </div>
        <SummaryTiles unpaid={totals.unpaid} paid={totals.paid} count={totals.count} />
        <ActiveFilterChips
          filters={filters}
          onRemove={(k) => setFilters((f) => { const n = { ...f }; delete n[k]; return n; })}
          onReset={() => setFilters({})}
        />

        {/* Mobile card list */}
        <div className="md:hidden space-y-3">
          {filteredIndex.map((r) => (
            <StudentCard
              key={r.student_id}
              row={r}
              onOpen={() => setSelectedStudentId(r.student_id)}
            />
          ))}
          {filteredIndex.length === 0 && <EmptyState />}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <DesktopStudentTable
            rows={filteredIndex}
            onOpen={(id) => setSelectedStudentId(id)}
          />
          {filteredIndex.length === 0 && <EmptyState />}
        </div>
      </main>

      {/* Filters sheet */}
      <Modal
        show={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        maxWidth="md"
      >
        <FiltersSheet
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onClose={() => setFiltersModalOpen(false)}
        />
      </Modal>

      {/* Student Fee Sheet */}
      <Modal
        show={!!selectedDetail}
        onClose={() => setSelectedStudentId(null)}
        maxWidth="lg"
      >
        {selectedDetail && (
          <StudentFeeSheet
            detail={selectedDetail}
            onClose={() => setSelectedStudentId(null)}
            onCollect={(fee, enrollment) => setCollectFee({ fee, student: selectedDetail.student, enrollment })}
          />
        )}
      </Modal>

      {/* Collect Fee modal */}
      <Modal
        show={!!collectFee}
        onClose={() => setCollectFee(null)}
        maxWidth="md"
      >
        {collectFee && (
          <CollectFeeSheet
            fee={collectFee.fee}
            student={collectFee.student}
            enrollment={collectFee.enrollment}
            collectionDate={collectionDate}
            onCollectionDateChange={setCollectionDate}
            onClose={() => setCollectFee(null)}
            onConfirm={() => { setCollectFee(null); }}
          />
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
 *  Page chrome pieces
 * ============================================================ */

function PageHeader() {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-base sm:text-lg font-semibold text-gray-800">Fees</h1>
      <button
        type="button"
        className="text-xs text-gray-500 underline-offset-2 hover:underline min-h-[44px] sm:min-h-[36px] inline-flex items-center"
      >
        Generate Monthly Fees
      </button>
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <div className="mb-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search student or father name"
        className="w-full rounded-lg border bg-white px-3 py-3 text-sm min-h-[44px]"
      />
    </div>
  );
}

function PrimaryFilterBar({ status, month, onStatusChange, onMonthChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_OPTIONS.map((opt) => {
          const active = (status || "") === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              className={`rounded-md px-4 py-2 text-sm transition min-h-[44px] sm:min-h-[36px] inline-flex items-center ${
                active ? "bg-white font-medium text-blue-600 shadow" : "text-gray-600"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <select
        value={month || ""}
        onChange={(e) => onMonthChange(e.target.value)}
        className="rounded-lg border bg-white px-3 py-2 text-sm min-h-[44px] sm:min-h-[36px]"
      >
        <option value="">Any month</option>
        <option value="2026-08">Aug 2026</option>
        <option value="2026-07">Jul 2026</option>
        <option value="2026-06">Jun 2026</option>
      </select>
    </div>
  );
}

function ActiveFilterChips({ filters, onRemove, onReset }) {
  const activeKeys = Object.keys(filters).filter((k) => filters[k]);
  if (activeKeys.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">Active:</span>
      {activeKeys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onRemove(k)}
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 min-h-[32px]"
        >
          {FILTER_LABELS[k] ? FILTER_LABELS[k](filters[k]) : `${k}=${filters[k]}`}
          <span aria-hidden="true" className="text-blue-500">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="text-xs text-gray-500 underline-offset-2 hover:underline min-h-[32px] inline-flex items-center"
      >
        Reset all
      </button>
    </div>
  );
}

function FiltersButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px] sm:min-h-[36px] inline-flex items-center gap-2"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 5h18M6 12h12M10 19h4" />
      </svg>
      More filters
    </button>
  );
}

function SummaryTiles({ unpaid, paid, count }) {
  return (
    <div className="mt-1 mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile label="Total Unpaid" value={CURRENCY(unpaid)} accent="text-red-600" />
      <Tile label="Total Paid" value={CURRENCY(paid)} accent="text-green-600" />
      <Tile label="Students shown" value={String(count)} accent="text-gray-800" />
    </div>
  );
}

function Tile({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-0.5 text-base font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border bg-white px-4 py-12 text-center text-sm text-gray-500">
      No students match the current filters.
    </div>
  );
}

/* ============================================================
 *  Mobile card / Desktop table
 * ============================================================ */

function StudentCard({ row, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-xl border bg-white p-4 text-left shadow-sm hover:shadow transition min-h-[80px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate">{row.student_name}</div>
          <div className="mt-1 text-xs text-gray-500">
            {row.primary_class}
            {row.primary_section ? ` · ${row.primary_section}` : ""}
            {row.current_enrollment_count > 1 && (
              <span className="ml-1 text-gray-400">+{row.current_enrollment_count - 1} more</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {row.unpaid_amount > 0 ? (
            <>
              <div className="text-xs uppercase tracking-wide text-gray-500">Unpaid</div>
              <div className="text-base font-semibold text-red-600">{CURRENCY(row.unpaid_amount)}</div>
            </>
          ) : (
            <>
              <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
              <div className="text-base font-semibold text-green-600">Paid</div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function DesktopStudentTable({ rows, onOpen }) {
  const columns = useMemo(
    () => [
      { header: "#", cell: ({ row }) => row.index + 1 },
      { accessorKey: "student_name", header: "Student" },
      { header: "Class / Section", cell: ({ row }) => (
        <span>
          {row.original.primary_class} · {row.original.primary_section}
          {row.original.current_enrollment_count > 1 && (
            <span className="ml-1 text-xs text-gray-400">+{row.original.current_enrollment_count - 1}</span>
          )}
        </span>
      )},
      { header: "Unpaid", cell: ({ row }) => (
        row.original.unpaid_amount > 0 ? (
          <span className="font-semibold text-red-600">{CURRENCY(row.original.unpaid_amount)}</span>
        ) : (
          <span className="text-sm text-green-600">Paid</span>
        )
      )},
      { header: "", cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onOpen(row.original.student_id)}
          className="text-blue-600 hover:underline min-h-[44px] sm:min-h-[36px] inline-flex items-center"
        >
          View →
        </button>
      )},
    ],
    [onOpen]
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      emptyMessage="No students match the current filters."
      containerClassName="bg-white border rounded-lg overflow-x-auto"
      tableClassName="min-w-[640px] text-sm"
      theadClassName="bg-gray-50 border-b"
    />
  );
}

/* ============================================================
 *  Filters sheet
 * ============================================================ */

function FiltersSheet({ filters, onChange, onClose }) {
  return (
    <div className="px-5 py-4">
      <div className="border-b pb-3">
        <h2 className="text-base font-semibold text-gray-800">Filters</h2>
        <p className="mt-1 text-xs text-gray-500">Less common filters live here. Active filters also appear as chips above the list.</p>
      </div>

      <div className="py-4 space-y-4">
        <Field label="Year">
          <select
            value={filters.year ?? ""}
            onChange={(e) => onChange({ year: e.target.value || undefined })}
            className="w-full rounded-lg border px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">All years</option>
            <option>2025</option>
            <option>2026</option>
          </select>
        </Field>

        <Field label="Class">
          <select
            value={filters.class_id ?? ""}
            onChange={(e) => onChange({ class_id: e.target.value || undefined })}
            className="w-full rounded-lg border px-3 py-2 text-sm min-h-[44px]"
          >
            <option value="">All classes</option>
            <option value={2}>Class 2</option>
            <option value={12}>Kirtan</option>
            <option value={31}>Music</option>
          </select>
        </Field>

        <Field label="Month range (advanced)">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="month"
              value={filters.month_from ?? ""}
              onChange={(e) => onChange({ month_from: e.target.value || undefined })}
              className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
            />
            <input
              type="month"
              value={filters.month_to ?? ""}
              onChange={(e) => onChange({ month_to: e.target.value || undefined })}
              className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
        </Field>

        <Field label="Collection date range (advanced)">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filters.paid_from ?? ""}
              onChange={(e) => onChange({ paid_from: e.target.value || undefined })}
              className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
            />
            <input
              type="date"
              value={filters.paid_to ?? ""}
              onChange={(e) => onChange({ paid_to: e.target.value || undefined })}
              className="rounded-lg border px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[44px]"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

/* ============================================================
 *  Student Fee Sheet (Level 1 + Level 2)
 * ============================================================ */

function StudentFeeSheet({ detail, onClose, onCollect }) {
  const [drillEnrollmentId, setDrillEnrollmentId] = useState(null);

  if (drillEnrollmentId) {
    const enrollment = [...detail.current_enrollments, ...detail.previous_enrollments]
      .find((e) => e.student_section_id === drillEnrollmentId);
    if (enrollment) {
      return (
        <EnrollmentFeeList
          enrollment={enrollment}
          student={detail.student}
          onBack={() => setDrillEnrollmentId(null)}
          onClose={onClose}
          onCollect={(fee) => onCollect(fee, enrollment)}
        />
      );
    }
  }

  return (
    <div className="px-5 py-4">
      <SheetHeader title={detail.student.name} subtitle={detail.student.father_name} onClose={onClose} />

      {detail.current_enrollments.length > 0 && (
        <SectionLabel>Current Enrollments</SectionLabel>
      )}
      <div className="space-y-2">
        {detail.current_enrollments.map((e) => (
          <EnrollmentRow
            key={e.student_section_id}
            enrollment={e}
            onOpen={() => setDrillEnrollmentId(e.student_section_id)}
            current
          />
        ))}
      </div>

      {detail.previous_enrollments.length > 0 && (
        <>
          <SectionLabel muted>Previous Enrollments</SectionLabel>
          <div className="space-y-2">
            {detail.previous_enrollments.map((e) => (
              <EnrollmentRow
                key={e.student_section_id}
                enrollment={e}
                onOpen={() => setDrillEnrollmentId(e.student_section_id)}
                current={false}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SheetHeader({ title, subtitle, onClose, backLabel, onBack }) {
  return (
    <div className="border-b pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-blue-600 hover:underline min-h-[44px] sm:min-h-[36px] inline-flex items-center -ml-1 px-1"
          >
            ← {backLabel || "Back"}
          </button>
        )}
        <h2 className="text-base font-semibold text-gray-800 truncate">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>
    </div>
  );
}

function SectionLabel({ children, muted }) {
  return (
    <div className={`mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wide ${muted ? "text-gray-400" : "text-gray-500"}`}>
      {children}
    </div>
  );
}

function EnrollmentRow({ enrollment, onOpen, current }) {
  const meta = divisionMeta(enrollment.division_key);
  const unpaid = enrollment.fee_summary.unpaid_amount;
  const paid = enrollment.fee_summary.paid_amount;
  const total = unpaid + paid;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-lg border bg-white px-3 py-3 text-left hover:shadow-sm transition min-h-[64px] ${
        current ? "" : "bg-gray-50/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${meta.pillBg} ${meta.pillText}`}
        >
          {meta.title.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 truncate">
            {enrollment.class_name} · {enrollment.section_name}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {current ? "Current" : `Transferred ${enrollment.transferred_at}`}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {unpaid > 0 ? (
            <div className="text-sm font-semibold text-red-600">
              Unpaid {CURRENCY(unpaid)}
            </div>
          ) : total > 0 ? (
            <div className="text-sm font-medium text-green-600">Paid</div>
          ) : (
            <div className="text-sm text-gray-400">No fees</div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ============================================================
 *  Enrollment Fee List (Level 2 drill-down)
 * ============================================================ */

function EnrollmentFeeList({ enrollment, student, onBack, onClose, onCollect }) {
  const [showOlder, setShowOlder] = useState(false);
  const meta = divisionMeta(enrollment.division_key);

  const sorted = [...enrollment.fees].sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
  const RECENT_LIMIT = 3;
  const visible = showOlder ? sorted : sorted.slice(0, RECENT_LIMIT);
  const olderCount = Math.max(0, sorted.length - RECENT_LIMIT);

  const unpaid = enrollment.fee_summary.unpaid_amount;
  const paid = enrollment.fee_summary.paid_amount;

  return (
    <div className="px-5 py-4">
      <SheetHeader
        title={`${enrollment.class_name} · ${enrollment.section_name}`}
        subtitle={`${student.name} · ${meta.title} · Unpaid ${CURRENCY(unpaid)} · Paid ${CURRENCY(paid)}`}
        onClose={onClose}
        onBack={onBack}
        backLabel="Enrollments"
      />

      <SectionLabel>Recent Fees</SectionLabel>
      <div className="space-y-2">
        {visible.map((fee) => (
          <FeeRow
            key={fee.id}
            fee={fee}
            divisionKey={enrollment.division_key}
            onCollect={() => onCollect(fee)}
          />
        ))}
        {sorted.length === 0 && (
          <div className="rounded-lg border bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
            No fees on this enrollment.
          </div>
        )}
      </div>

      {olderCount > 0 && (
        <button
          type="button"
          onClick={() => setShowOlder((v) => !v)}
          className="mt-3 text-sm text-blue-600 hover:underline min-h-[44px] sm:min-h-[36px] inline-flex items-center"
        >
          {showOlder ? "Hide older fees" : `View older fees (${olderCount})`}
        </button>
      )}
    </div>
  );
}

function FeeRow({ fee, divisionKey, onCollect }) {
  const monthLabel = fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 min-h-[56px]">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{monthLabel}</div>
        <div className="mt-0.5 text-xs text-gray-500">
          {fee.type === "monthly" ? "Monthly Fee" : fee.title} · {CURRENCY(fee.amount)}
          {fee.is_paid && fee.paid_at && (
            <span className="ml-1 text-gray-400">· Paid {fee.paid_at}</span>
          )}
        </div>
      </div>
      {fee.is_paid ? (
        <span className="shrink-0 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 min-h-[36px] inline-flex items-center">
          Paid
        </span>
      ) : (
        <button
          type="button"
          onClick={onCollect}
          className="shrink-0 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 min-h-[44px] sm:min-h-[36px] inline-flex items-center"
        >
          Collect
        </button>
      )}
    </div>
  );
}

/* ============================================================
 *  Collect Fee Sheet
 * ============================================================ */

function CollectFeeSheet({ fee, student, enrollment, collectionDate, onCollectionDateChange, onClose, onConfirm }) {
  const monthLabel = fee.type === "monthly" ? formatMonthLabel(fee.month) : fee.title;

  return (
    <div className="px-5 py-4">
      <SheetHeader
        title="Collect Fee"
        subtitle={`${student.name} · ${enrollment.class_name} · ${enrollment.section_name}`}
        onClose={onClose}
      />

      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
        <div className="font-medium text-gray-900">{monthLabel}</div>
        <div className="text-xs text-gray-500">
          {fee.type === "monthly" ? "Monthly Fee" : fee.title}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Field label="Amount">
          <div className="w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-800 min-h-[44px] inline-flex items-center">
            {CURRENCY(fee.amount)}
          </div>
        </Field>

        <Field label="Payment date">
          <input
            type="date"
            value={collectionDate}
            onChange={(e) => onCollectionDateChange(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm min-h-[44px]"
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!collectionDate}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 min-h-[44px]"
        >
          Collect
        </button>
      </div>
    </div>
  );
}