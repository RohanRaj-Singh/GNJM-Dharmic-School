/**
 * Phase 1 prototype mock data fixture.
 *
 * Six cases covering the spec §18 stress test plus the five edge cases
 * called out in §11.1 / §9.2:
 *
 *   - HARPREET   (canonical — 3 current + 1 previous, paid/unpaid/historical)
 *   - SIMRAN     (single-class, fully paid)
 *   - GURLEEN    (single-class, one unpaid)
 *   - JASPAL     (multi-class without previous, fully paid)
 *   - AMAN       (multi-class, zero-balance enrollment)
 *   - RAVI       (no fees at all)
 *
 * All amounts are in PKR (Rs). Dates are in `YYYY-MM` for monthly and
 * `YYYY-MM-DD` for collection. The fixture matches the §4.2 Tier 2
 * (Student Fee Sheet) detail payload shape. The Tier 1 (Fees Index)
 * summary shape is derived from this in FeesUxPrototype.jsx via the
 * `summarizeForIndex()` helper — keeping the canonical fixture as a
 * single source of truth.
 *
 * See docs/architecture/16-fee-redesign-implementation-plan.md §4,
 * §9.2, §11.
 */

const HARPREET = {
  student: {
    id: 101,
    name: "Harpreet Singh",
    father_name: "Daljit Singh",
  },
  current_enrollments: [
    {
      student_section_id: 1001,
      class_id: 2,
      class_name: "Class 2",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 11,
      section_name: "Section A",
      started_at: "2025-08-01",
      fee_summary: {
        paid_count: 2,
        paid_amount: 4000,
        unpaid_count: 1,
        unpaid_amount: 2000,
        oldest_unpaid_month: "2026-08",
      },
      fees: [
        {
          id: 5001,
          type: "monthly",
          month: "2026-08",
          title: null,
          amount: 2000,
          paid_at: null,
          class_type: "gurmukhi",
          is_paid: false,
        },
        {
          id: 5002,
          type: "monthly",
          month: "2026-07",
          title: null,
          amount: 2000,
          paid_at: "2026-07-12",
          class_type: "gurmukhi",
          is_paid: true,
        },
        {
          id: 5003,
          type: "monthly",
          month: "2026-06",
          title: null,
          amount: 2000,
          paid_at: "2026-06-15",
          class_type: "gurmukhi",
          is_paid: true,
        },
      ],
    },
    {
      student_section_id: 1002,
      class_id: 12,
      class_name: "Kirtan",
      class_division: "kirtan",
      division_key: "kirtan",
      section_id: 21,
      section_name: "Sunday",
      started_at: "2025-08-01",
      fee_summary: {
        paid_count: 1,
        paid_amount: 500,
        unpaid_count: 0,
        unpaid_amount: 0,
        oldest_unpaid_month: null,
      },
      fees: [
        {
          id: 5010,
          type: "monthly",
          month: "2026-08",
          title: null,
          amount: 500,
          paid_at: "2026-08-04",
          class_type: "kirtan",
          is_paid: true,
        },
      ],
    },
    {
      student_section_id: 1003,
      class_id: 31,
      class_name: "Music",
      class_division: "music",
      division_key: "music",
      section_id: 41,
      section_name: "Section B",
      started_at: "2026-01-15",
      fee_summary: {
        paid_count: 0,
        paid_amount: 0,
        unpaid_count: 1,
        unpaid_amount: 1200,
        oldest_unpaid_month: "2026-08",
      },
      fees: [
        {
          id: 5020,
          type: "monthly",
          month: "2026-08",
          title: null,
          amount: 1200,
          paid_at: null,
          class_type: "music",
          is_paid: false,
        },
      ],
    },
  ],
  previous_enrollments: [
    {
      student_section_id: 900,
      class_id: 1,
      class_name: "Class 1",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 10,
      section_name: "Section A",
      started_at: "2024-08-01",
      transferred_at: "2025-07-31",
      fee_summary: {
        paid_count: 1,
        paid_amount: 2000,
        unpaid_count: 1,
        unpaid_amount: 2000,
        oldest_unpaid_month: "2026-07",
      },
      fees: [
        {
          id: 4900,
          type: "monthly",
          month: "2026-07",
          title: null,
          amount: 2000,
          paid_at: null,
          class_type: "gurmukhi",
          is_paid: false,
        },
        {
          id: 4901,
          type: "monthly",
          month: "2026-06",
          title: null,
          amount: 2000,
          paid_at: "2026-06-20",
          class_type: "gurmukhi",
          is_paid: true,
        },
      ],
    },
  ],
};

const SIMRAN = {
  student: { id: 102, name: "Simran Kaur", father_name: "Manjit Kaur" },
  current_enrollments: [
    {
      student_section_id: 1101,
      class_id: 3,
      class_name: "Class 3",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 12,
      section_name: "Section B",
      started_at: "2024-08-01",
      fee_summary: { paid_count: 3, paid_amount: 6000, unpaid_count: 0, unpaid_amount: 0, oldest_unpaid_month: null },
      fees: [
        { id: 6001, type: "monthly", month: "2026-08", title: null, amount: 2000, paid_at: "2026-08-05", class_type: "gurmukhi", is_paid: true },
        { id: 6002, type: "monthly", month: "2026-07", title: null, amount: 2000, paid_at: "2026-07-08", class_type: "gurmukhi", is_paid: true },
        { id: 6003, type: "monthly", month: "2026-06", title: null, amount: 2000, paid_at: "2026-06-12", class_type: "gurmukhi", is_paid: true },
      ],
    },
  ],
  previous_enrollments: [],
};

const GURLEEN = {
  student: { id: 103, name: "Gurleen Kaur", father_name: "Balwinder Singh" },
  current_enrollments: [
    {
      student_section_id: 1201,
      class_id: 4,
      class_name: "Class 4",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 13,
      section_name: "Section A",
      started_at: "2024-08-01",
      fee_summary: { paid_count: 0, paid_amount: 0, unpaid_count: 1, unpaid_amount: 2500, oldest_unpaid_month: "2026-08" },
      fees: [
        { id: 7001, type: "monthly", month: "2026-08", title: null, amount: 2500, paid_at: null, class_type: "gurmukhi", is_paid: false },
      ],
    },
  ],
  previous_enrollments: [],
};

const JASPAL = {
  student: { id: 104, name: "Jaspal Singh", father_name: "Harbans Singh" },
  current_enrollments: [
    {
      student_section_id: 1301,
      class_id: 5,
      class_name: "Class 5",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 14,
      section_name: "Section A",
      started_at: "2024-08-01",
      fee_summary: { paid_count: 2, paid_amount: 5000, unpaid_count: 0, unpaid_amount: 0, oldest_unpaid_month: null },
      fees: [
        { id: 8001, type: "monthly", month: "2026-08", title: null, amount: 2500, paid_at: "2026-08-02", class_type: "gurmukhi", is_paid: true },
        { id: 8002, type: "monthly", month: "2026-07", title: null, amount: 2500, paid_at: "2026-07-04", class_type: "gurmukhi", is_paid: true },
      ],
    },
    {
      student_section_id: 1302,
      class_id: 12,
      class_name: "Kirtan",
      class_division: "kirtan",
      division_key: "kirtan",
      section_id: 21,
      section_name: "Sunday",
      started_at: "2025-01-15",
      fee_summary: { paid_count: 1, paid_amount: 500, unpaid_count: 0, unpaid_amount: 0, oldest_unpaid_month: null },
      fees: [
        { id: 8010, type: "monthly", month: "2026-08", title: null, amount: 500, paid_at: "2026-08-04", class_type: "kirtan", is_paid: true },
      ],
    },
  ],
  previous_enrollments: [],
};

const AMAN = {
  student: { id: 105, name: "Amanpreet Singh", father_name: "Surjit Singh" },
  current_enrollments: [
    {
      student_section_id: 1401,
      class_id: 6,
      class_name: "Class 6",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 15,
      section_name: "Section B",
      started_at: "2024-08-01",
      fee_summary: { paid_count: 2, paid_amount: 6000, unpaid_count: 0, unpaid_amount: 0, oldest_unpaid_month: null },
      fees: [
        { id: 9001, type: "monthly", month: "2026-08", title: null, amount: 3000, paid_at: "2026-08-01", class_type: "gurmukhi", is_paid: true },
        { id: 9002, type: "monthly", month: "2026-07", title: null, amount: 3000, paid_at: "2026-07-03", class_type: "gurmukhi", is_paid: true },
      ],
    },
    {
      student_section_id: 1402,
      class_id: 31,
      class_name: "Music",
      class_division: "music",
      division_key: "music",
      section_id: 41,
      section_name: "Section B",
      started_at: "2026-02-01",
      fee_summary: { paid_count: 0, paid_amount: 0, unpaid_count: 0, unpaid_amount: 0, oldest_unpaid_month: null },
      fees: [],
    },
  ],
  previous_enrollments: [],
};

const RAVI = {
  student: { id: 106, name: "Ravi Kumar", father_name: "Shiv Kumar" },
  current_enrollments: [
    {
      student_section_id: 1501,
      class_id: 7,
      class_name: "Class 7",
      class_division: "gurmukhi",
      division_key: "gurmukhi",
      section_id: 16,
      section_name: "Section A",
      started_at: "2026-08-01",
      fee_summary: { paid_count: 0, paid_amount: 0, unpaid_count: 0, unpaid_amount: 0, oldest_unpaid_month: null },
      fees: [],
    },
  ],
  previous_enrollments: [],
};

/**
 * Tier 2 (Student Fee Sheet) detail fixtures — keyed by student_id.
 */
export const detailFixtures = {
  101: HARPREET,
  102: SIMRAN,
  103: GURLEEN,
  104: JASPAL,
  105: AMAN,
  106: RAVI,
};

/**
 * Derive the Tier 1 (Fees Index) summary shape from the detail
 * fixtures. Keeps a single source of truth — the prototype shows the
 * same canonical data in both views.
 *
 *   primary_class / primary_section -> first current enrollment
 *   totals -> aggregated across ALL enrollments (current + previous)
 *
 * This is a client-side derivation only. The real backend will
 * compute these via the controller (see §4.6 of the planning doc).
 */
export function summarizeForIndex(detail) {
  const allEnrollments = [
    ...detail.current_enrollments,
    ...detail.previous_enrollments,
  ];
  const first = detail.current_enrollments[0] ?? detail.previous_enrollments[0] ?? null;
  let paid = 0;
  let unpaid = 0;
  for (const e of allEnrollments) {
    paid += e.fee_summary.paid_amount;
    unpaid += e.fee_summary.unpaid_amount;
  }
  return {
    student_id: detail.student.id,
    student_name: detail.student.name,
    father_name: detail.student.father_name,
    primary_class: first ? first.class_name : "",
    primary_section: first ? first.section_name : "",
    current_enrollment_count: detail.current_enrollments.length,
    previous_enrollment_count: detail.previous_enrollments.length,
    unpaid_amount: unpaid,
    paid_amount: paid,
    total_amount: paid + unpaid,
  };
}

/**
 * Tier 1 fixtures — built by mapping over `detailFixtures` so the
 * canonical data stays in one place.
 */
export const indexFixtures = Object.values(detailFixtures).map(summarizeForIndex);

export const allStudents = Object.values(detailFixtures).map((d) => d.student);